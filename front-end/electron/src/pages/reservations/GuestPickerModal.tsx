import { Plus, Search, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../../components/ui";
import { cpfMask, ptError } from "../../lib/format";
import type { Guest } from "../../types";

export function GuestPickerModal({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId?: string;
  onSelect: (guest: Guest) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.guests
      .list()
      .then((list) => {
        if (!cancelled) setGuests(list);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(ptError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    const digits = q.replace(/\D/g, "");
    return guests.filter((guest) => {
      const hay = [
        guest.name,
        guest.phone,
        guest.email,
        guest.cpf,
        guest.address.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      if (digits && (guest.phone ?? "").replace(/\D/g, "").includes(digits)) {
        return true;
      }
      if (digits && (guest.cpf ?? "").replace(/\D/g, "").includes(digits)) {
        return true;
      }
      return false;
    });
  }, [guests, search]);

  if (mode === "create") {
    return (
      <GuestCreateForm
        onClose={() => setMode("list")}
        onCreated={(guest) => {
          setGuests((prev) =>
            prev.some((g) => g.id === guest.id) ? prev : [guest, ...prev],
          );
          onSelect(guest);
        }}
      />
    );
  }

  return (
    <Modal title="Escolher hóspede" onClose={onClose} wide>
      <div className="guest-picker">
        <div className="guest-picker-toolbar">
          <label className="guest-picker-search">
            <Search size={16} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone, CPF ou e-mail…"
            />
          </label>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setMode("create")}
          >
            Novo hóspede
          </Button>
        </div>

        {error ? <p className="muted">{error}</p> : null}
        {loading ? <Loading label="Carregando hóspedes…" /> : null}

        {!loading && filtered.length === 0 ? (
          <EmptyState
            message={
              search.trim()
                ? "Nenhum hóspede encontrado para esta busca."
                : "Nenhum hóspede cadastrado. Clique em Novo hóspede."
            }
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <ul className="guest-picker-list">
            {filtered.map((guest) => {
              const selected = guest.id === selectedId;
              return (
                <li key={guest.id}>
                  <button
                    type="button"
                    className={
                      selected
                        ? "guest-picker-item selected"
                        : "guest-picker-item"
                    }
                    onClick={() => onSelect(guest)}
                  >
                    <span className="guest-picker-avatar">
                      <User size={16} />
                    </span>
                    <span className="guest-picker-info">
                      <strong>{guest.name}</strong>
                      <span className="muted">
                        {[
                          guest.phone,
                          guest.cpf ? `CPF ${cpfMask(guest.cpf)}` : null,
                          guest.email,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sem contato"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <footer className="modal-foot">
          <Button onClick={onClose}>Cancelar</Button>
        </footer>
      </div>
    </Modal>
  );
}

function GuestCreateForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (guest: Guest) => void;
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
      const guest = await api.guests.create(payload);
      onCreated(guest);
    } catch (err) {
      setError(ptError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal wide title="Novo hóspede" onClose={onClose}>
      <Feedback error={error} />
      <p className="muted form-required-note">
        Campos com <abbr title="Obrigatório">*</abbr> são obrigatórios. Depois
        de salvar, o hóspede já entra na reserva.
      </p>
      <div className="form-grid">
        <Field label="Nome" required>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
          />
        </Field>
        <Field label="CPF" optional hint="Preencher até o check-in">
          <input
            value={form.cpf}
            onChange={(e) => set("cpf", e.target.value)}
            placeholder="12345678901"
          />
        </Field>
        <Field label="Telefone" required hint="Com DDD">
          <input
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="11999999999"
            required
          />
        </Field>
        <Field label="E-mail" optional>
          <input
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="Rua" optional>
          <input
            value={form.street}
            onChange={(e) => set("street", e.target.value)}
          />
        </Field>
        <Field label="Número" optional>
          <input
            value={form.number}
            onChange={(e) => set("number", e.target.value)}
          />
        </Field>
        <Field label="Complemento" optional>
          <input
            value={form.complement}
            onChange={(e) => set("complement", e.target.value)}
          />
        </Field>
        <Field label="Bairro" optional>
          <input
            value={form.neighborhood}
            onChange={(e) => set("neighborhood", e.target.value)}
          />
        </Field>
        <Field label="Cidade" optional>
          <input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="UF" optional hint="2 letras">
          <input
            maxLength={2}
            value={form.state}
            onChange={(e) => set("state", e.target.value.toUpperCase())}
          />
        </Field>
        <Field label="CEP" optional>
          <input
            value={form.zipCode}
            onChange={(e) => set("zipCode", e.target.value)}
          />
        </Field>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose} disabled={saving}>
          Voltar
        </Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={
            !form.name.trim() ||
            !form.phone.trim() ||
            form.phone.replace(/\D/g, "").length < 8
          }
          onClick={() => void submit()}
        >
          Cadastrar e selecionar
        </Button>
      </footer>
    </Modal>
  );
}
