import { History, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
  Panel,
} from "../components/ui";
import { brl, cpfMask, dateBR } from "../lib/format";
import type { Guest } from "../types";

const RESERVATION_TONE: Record<string, string> = {
  PENDING: "yellow",
  CONFIRMED: "green",
  CANCELLED: "red",
  COMPLETED: "blue",
};

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [historyGuest, setHistoryGuest] = useState<Guest | null>(null);

  const load = useCallback(async (term?: string) => {
    setLoading(true);
    try {
      setGuests(await api.guests.list(term));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(guest: Guest) {
    const hasHistory = guest.staysCount > 0;
    const ok = window.confirm(
      hasHistory
        ? `Excluir ${guest.name}? O histórico de hospedagens finalizadas/canceladas também será removido.`
        : `Excluir o hóspede ${guest.name}?`,
    );
    if (!ok) return;

    setError(null);
    try {
      await api.guests.remove(guest.id);
      if (historyGuest?.id === guest.id) setHistoryGuest(null);
      setMessage(`Hóspede ${guest.name} removido.`);
      await load(search);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Cadastro</p>
          <h1>Hóspedes</h1>
        </div>
        <div className="header-actions">
          <div className="search">
            <Search size={16} />
            <input
              value={search}
              placeholder="Nome, CPF, telefone…"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load(search);
              }}
            />
          </div>
          <Button onClick={() => load(search)}>Buscar</Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowForm(true)}
          >
            Novo hóspede
          </Button>
        </div>
      </header>

      <Feedback error={error} message={message} />

      <Panel>
        {loading ? (
          <Loading />
        ) : guests.length === 0 ? (
          <EmptyState message="Nenhum hóspede cadastrado." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Telefone</th>
                <th>Endereço</th>
                <th>Hospedagens</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr key={guest.id}>
                  <td>
                    <strong>{guest.name}</strong>
                    {guest.email ? (
                      <span className="muted block">{guest.email}</span>
                    ) : null}
                  </td>
                  <td>{cpfMask(guest.cpf)}</td>
                  <td>{guest.phone ?? "—"}</td>
                  <td className="muted">{guest.address.formatted ?? "—"}</td>
                  <td>{guest.staysCount}</td>
                  <td>
                    <div className="cell-actions">
                      <Button
                        icon={<History size={15} />}
                        onClick={() => setHistoryGuest(guest)}
                      >
                        Histórico
                      </Button>
                      <Button
                        variant="danger"
                        icon={<Trash2 size={15} />}
                        onClick={() => void handleDelete(guest)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {showForm ? (
        <GuestForm
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            setMessage("Hóspede cadastrado.");
            await load(search);
          }}
        />
      ) : null}

      {historyGuest ? (
        <Modal
          wide
          title={`Histórico — ${historyGuest.name}`}
          onClose={() => setHistoryGuest(null)}
        >
          {historyGuest.stayHistory.length === 0 ? (
            <EmptyState message="Nenhuma hospedagem registrada." />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Período</th>
                  <th>Quarto</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyGuest.stayHistory.map((stay) => (
                  <tr key={stay.id}>
                    <td>
                      <code>{stay.code}</code>
                    </td>
                    <td>
                      {dateBR(stay.checkInDate)} — {dateBR(stay.checkOutDate)}
                    </td>
                    <td>
                      {stay.room
                        ? `${stay.room.number} · ${stay.roomType.name}`
                        : stay.roomType.name}
                    </td>
                    <td>{brl(stay.bill.total)}</td>
                    <td>
                      <Badge tone={RESERVATION_TONE[stay.status] ?? "gray"}>
                        {stay.statusLabel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      ) : null}
    </section>
  );
}

function GuestForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ""),
      );
      await api.guests.create(payload);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal wide title="Novo hóspede" onClose={onClose}>
      <Feedback error={error} />
      <div className="form-grid">
        <Field label="Nome">
          <input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="CPF" hint="Somente números">
          <input
            value={form.cpf}
            onChange={(e) => set("cpf", e.target.value)}
            placeholder="12345678901"
          />
        </Field>
        <Field label="Telefone">
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Rua">
          <input value={form.street} onChange={(e) => set("street", e.target.value)} />
        </Field>
        <Field label="Número">
          <input
            value={form.number}
            onChange={(e) => set("number", e.target.value)}
          />
        </Field>
        <Field label="Complemento">
          <input
            value={form.complement}
            onChange={(e) => set("complement", e.target.value)}
          />
        </Field>
        <Field label="Bairro">
          <input
            value={form.neighborhood}
            onChange={(e) => set("neighborhood", e.target.value)}
          />
        </Field>
        <Field label="Cidade">
          <input value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="UF" hint="2 letras">
          <input
            maxLength={2}
            value={form.state}
            onChange={(e) => set("state", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="CEP">
          <input
            value={form.zipCode}
            onChange={(e) => set("zipCode", e.target.value)}
          />
        </Field>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} onClick={submit}>
          Cadastrar hóspede
        </Button>
      </footer>
    </Modal>
  );
}
