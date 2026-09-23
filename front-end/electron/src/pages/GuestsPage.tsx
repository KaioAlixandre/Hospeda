import {
  BedDouble,
  ChevronLeft,
  ChevronRight,
  History,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../components/ui";
import { brl, cpfMask, dateBR } from "../lib/format";
import type { Guest } from "../types";

const RESERVATION_TONE: Record<string, string> = {
  PENDING: "yellow",
  CONFIRMED: "green",
  CANCELLED: "red",
  COMPLETED: "blue",
};

const AVATAR_TONES = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "cyan",
  "violet",
  "pink",
  "teal",
] as const;

const PAGE_SIZE = 10;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "??";
}

function avatarTone(id: string): (typeof AVATAR_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash + id.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  }
  return AVATAR_TONES[hash];
}

function guestSpend(guest: Guest): number {
  return guest.stayHistory.reduce(
    (sum, stay) => sum + Number(stay.bill?.total ?? 0),
    0,
  );
}

export function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [historyGuest, setHistoryGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGuests(await api.guests.list());
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

  const enriched = useMemo(
    () =>
      [...guests]
        .map((guest) => {
          const totalSpent = guestSpend(guest);
          const stays = guest.staysCount;
          return {
            ...guest,
            totalSpent,
            ticketAverage: stays > 0 ? totalSpent / stays : 0,
          };
        })
        .sort((a, b) => {
          if (b.staysCount !== a.staysCount) return b.staysCount - a.staysCount;
          return b.totalSpent - a.totalSpent;
        }),
    [guests],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enriched;
    return enriched.filter((guest) => {
      const haystack = [
        guest.name,
        guest.phone ?? "",
        guest.email ?? "",
        guest.cpf,
        guest.address.formatted ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [enriched, search]);

  useEffect(() => {
    setPage(1);
  }, [search, filtered.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filtered.length);
  const pageItems = filtered.slice(startIndex, endIndex);

  const pageNumbers = useMemo(() => {
    const pages: Array<number | "..."> = [];
    if (totalPages <= 7) {
      for (let p = 1; p <= totalPages; p += 1) pages.push(p);
      return pages;
    }
    pages.push(1);
    const left = Math.max(2, safePage - 1);
    const right = Math.min(totalPages - 1, safePage + 1);
    if (left > 2) pages.push("...");
    for (let p = left; p <= right; p += 1) pages.push(p);
    if (right < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  }, [safePage, totalPages]);

  const totalGuests = enriched.length;
  const staysTotal = enriched.reduce((sum, guest) => sum + guest.staysCount, 0);
  const activeGuests = enriched.filter((guest) => guest.staysCount > 0).length;
  const revenueTotal = enriched.reduce((sum, guest) => sum + guest.totalSpent, 0);
  const averageLtv = totalGuests > 0 ? revenueTotal / totalGuests : 0;

  async function confirmDelete() {
    if (!deletingGuest) return;
    setDeleting(true);
    setError(null);
    try {
      await api.guests.remove(deletingGuest.id);
      if (historyGuest?.id === deletingGuest.id) setHistoryGuest(null);
      if (editingGuest?.id === deletingGuest.id) setEditingGuest(null);
      setMessage(`Hóspede ${deletingGuest.name} removido.`);
      setDeletingGuest(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="page guests-page">
      <header className="guests-header">
        <div>
          <h1>Hóspedes</h1>
          <p className="muted">Acompanhe e gerencie sua base de hóspedes</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setShowForm(true)}
        >
          Novo hóspede
        </Button>
      </header>

      <Feedback error={error} message={message} />

      <div className="guests-metrics">
        <article className="guests-metric">
          <span className="guests-metric-icon tone-brand">
            <Users size={16} />
          </span>
          <div>
            <p>Total de hóspedes</p>
            <strong>{totalGuests}</strong>
          </div>
        </article>
        <article className="guests-metric">
          <span className="guests-metric-icon tone-green">
            <BedDouble size={16} />
          </span>
          <div>
            <p>Hospedagens</p>
            <strong>{staysTotal}</strong>
          </div>
        </article>
        <article className="guests-metric">
          <span className="guests-metric-icon tone-violet">
            <UserCheck size={16} />
          </span>
          <div>
            <p>Hóspedes ativos</p>
            <strong>{activeGuests}</strong>
          </div>
        </article>
        <article className="guests-metric">
          <span className="guests-metric-icon tone-amber">
            <Trophy size={16} />
          </span>
          <div>
            <p>LTV médio</p>
            <strong>{brl(averageLtv)}</strong>
          </div>
        </article>
      </div>

      <div className="guests-panel">
        <div className="guests-panel-toolbar">
          <label className="guests-search">
            <Search size={16} strokeWidth={1.9} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, telefone, CPF ou e-mail..."
              aria-label="Pesquisar hóspedes"
            />
          </label>
        </div>

        {loading ? (
          <div className="guests-empty">
            <Loading />
          </div>
        ) : filtered.length === 0 ? (
          <div className="guests-empty">
            <div className="guests-empty-icon">
              <Users size={28} />
            </div>
            <p>
              {search.trim()
                ? "Nenhum hóspede encontrado"
                : "Nenhum hóspede cadastrado"}
            </p>
            {search.trim() ? (
              <span className="muted">Tente buscar com outros termos</span>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="guests-mobile-list">
              {pageItems.map((guest) => {
                const rank = filtered.findIndex((item) => item.id === guest.id);
                const isTop3 = rank < 3 && guest.staysCount > 0;
                return (
                  <li key={guest.id} className="guests-mobile-card">
                    <div className="guests-mobile-top">
                      <span
                        className={`guest-avatar tone-${avatarTone(guest.id)}`}
                      >
                        {getInitials(guest.name)}
                      </span>
                      <div className="guests-mobile-copy">
                        <div className="guests-name-row">
                          {isTop3 ? (
                            <Trophy
                              size={14}
                              className={`guest-rank-icon rank-${rank}`}
                            />
                          ) : (
                            <span className="guest-rank">#{rank + 1}</span>
                          )}
                          <strong>{guest.name}</strong>
                        </div>
                        {guest.phone ? (
                          <p className="guest-contact">
                            <Phone size={13} /> {guest.phone}
                          </p>
                        ) : null}
                        {guest.email ? (
                          <p className="guest-contact">
                            <Mail size={13} /> {guest.email}
                          </p>
                        ) : null}
                        {!guest.phone && !guest.email ? (
                          <p className="muted">Sem contato</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="guests-mobile-stats">
                      <div>
                        <span>Hospedagens</span>
                        <strong
                          className={guest.staysCount > 0 ? "accent" : undefined}
                        >
                          {guest.staysCount}
                        </strong>
                      </div>
                      <div>
                        <span>Total gasto</span>
                        <strong>{brl(guest.totalSpent)}</strong>
                      </div>
                      <div>
                        <span>Ticket médio</span>
                        <strong>
                          {guest.staysCount > 0
                            ? brl(guest.ticketAverage)
                            : "—"}
                        </strong>
                      </div>
                    </div>
                    <div className="guests-mobile-actions">
                      <button
                        type="button"
                        className="guest-action-btn"
                        onClick={() => setHistoryGuest(guest)}
                      >
                        <History size={14} /> Histórico
                      </button>
                      <button
                        type="button"
                        className="guest-action-btn"
                        onClick={() => setEditingGuest(guest)}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        type="button"
                        className="guest-action-btn danger"
                        onClick={() => setDeletingGuest(guest)}
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="guests-table-wrap">
              <table className="guests-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Hóspede</th>
                    <th>Contato</th>
                    <th className="text-center">Hospedagens</th>
                    <th className="text-right">Total gasto</th>
                    <th className="text-right">Ticket médio</th>
                    <th className="text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((guest) => {
                    const rank = filtered.findIndex(
                      (item) => item.id === guest.id,
                    );
                    const isTop3 = rank < 3 && guest.staysCount > 0;
                    return (
                      <tr key={guest.id}>
                        <td className="text-center">
                          {isTop3 ? (
                            <Trophy
                              size={15}
                              className={`guest-rank-icon rank-${rank}`}
                            />
                          ) : (
                            <span className="guest-rank">{rank + 1}</span>
                          )}
                        </td>
                        <td>
                          <div className="guest-identity">
                            <span
                              className={`guest-avatar tone-${avatarTone(guest.id)}`}
                            >
                              {getInitials(guest.name)}
                            </span>
                            <div>
                              <strong>{guest.name}</strong>
                              <span className="muted block">
                                CPF {cpfMask(guest.cpf)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="guest-contact-stack">
                            {guest.phone ? (
                              <span>
                                <Phone size={13} /> {guest.phone}
                              </span>
                            ) : null}
                            {guest.email ? (
                              <span>
                                <Mail size={13} /> {guest.email}
                              </span>
                            ) : null}
                            {!guest.phone && !guest.email ? (
                              <span className="muted">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-center">
                          <span
                            className={`guest-stays-pill${
                              guest.staysCount > 0 ? " active" : ""
                            }`}
                          >
                            {guest.staysCount}
                          </span>
                        </td>
                        <td className="text-right">
                          <strong>{brl(guest.totalSpent)}</strong>
                        </td>
                        <td className="text-right muted">
                          {guest.staysCount > 0
                            ? brl(guest.ticketAverage)
                            : "—"}
                        </td>
                        <td className="text-center">
                          <div className="guest-row-actions">
                            <button
                              type="button"
                              className="guest-icon-btn"
                              title="Histórico"
                              onClick={() => setHistoryGuest(guest)}
                            >
                              <History size={15} />
                            </button>
                            <button
                              type="button"
                              className="guest-icon-btn"
                              title="Editar"
                              onClick={() => setEditingGuest(guest)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="guest-icon-btn danger"
                              title="Remover"
                              onClick={() => setDeletingGuest(guest)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <footer className="guests-panel-footer">
              <p className="muted">
                Mostrando{" "}
                <strong>
                  {startIndex + 1}–{endIndex}
                </strong>{" "}
                de <strong>{filtered.length}</strong> hóspede
                {filtered.length === 1 ? "" : "s"}
              </p>
              <div className="guests-footer-right">
                <p className="muted guests-revenue">
                  Receita total: <strong>{brl(revenueTotal)}</strong>
                </p>
                {totalPages > 1 ? (
                  <div className="guests-pagination">
                    <button
                      type="button"
                      className="guests-page-btn"
                      disabled={safePage === 1}
                      aria-label="Página anterior"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {pageNumbers.map((item, index) =>
                      item === "..." ? (
                        <span key={`e-${index}`} className="guests-page-ellipsis">
                          …
                        </span>
                      ) : (
                        <button
                          type="button"
                          key={item}
                          className={`guests-page-btn${
                            item === safePage ? " active" : ""
                          }`}
                          onClick={() => setPage(item)}
                        >
                          {item}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      className="guests-page-btn"
                      disabled={safePage === totalPages}
                      aria-label="Próxima página"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
            </footer>
          </>
        )}
      </div>

      {showForm ? (
        <GuestForm
          onClose={() => setShowForm(false)}
          onSaved={async () => {
            setShowForm(false);
            setMessage("Hóspede cadastrado.");
            await load();
          }}
        />
      ) : null}

      {editingGuest ? (
        <GuestForm
          initial={editingGuest}
          onClose={() => setEditingGuest(null)}
          onSaved={async () => {
            setEditingGuest(null);
            setMessage("Hóspede atualizado.");
            await load();
          }}
        />
      ) : null}

      {deletingGuest ? (
        <Modal title="Excluir hóspede" onClose={() => setDeletingGuest(null)}>
          <p>
            Tem certeza que deseja excluir{" "}
            <strong>{deletingGuest.name}</strong>? Esta ação não pode ser
            desfeita.
          </p>
          {deletingGuest.staysCount > 0 ? (
            <p className="muted spaced">
              O histórico de {deletingGuest.staysCount} hospedagem
              {deletingGuest.staysCount === 1 ? "" : "ens"} também será removido.
            </p>
          ) : null}
          <footer className="modal-foot">
            <Button onClick={() => setDeletingGuest(null)} disabled={deleting}>
              Voltar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => void confirmDelete()}
            >
              Confirmar exclusão
            </Button>
          </footer>
        </Modal>
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
            <div className="reservations-table-wrap">
              <table className="table data-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Período</th>
                    <th>UH</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyGuest.stayHistory.map((stay) => (
                    <tr key={stay.id}>
                      <td>
                        <span className="reservations-code-cell">
                          <span
                            className={`status-square tone-${
                              RESERVATION_TONE[stay.status] ?? "gray"
                            }`}
                          />
                          <span className="reservations-code-link">
                            {stay.code}
                          </span>
                        </span>
                      </td>
                      <td>
                        {dateBR(stay.checkInDate)} — {dateBR(stay.checkOutDate)}
                      </td>
                      <td>
                        {stay.room
                          ? `Quarto ${stay.room.number}`
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
            </div>
          )}
        </Modal>
      ) : null}
    </section>
  );
}

function GuestForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Guest | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    cpf: initial?.cpf ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    street: initial?.address.street ?? "",
    number: initial?.address.number ?? "",
    complement: initial?.address.complement ?? "",
    neighborhood: initial?.address.neighborhood ?? "",
    city: initial?.address.city ?? "",
    state: initial?.address.state ?? "",
    zipCode: initial?.address.zipCode ?? "",
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
      if (initial) {
        await api.guests.update(initial.id, payload);
      } else {
        await api.guests.create(payload);
      }
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={initial ? "Editar hóspede" : "Novo hóspede"}
      onClose={onClose}
    >
      <Feedback error={error} />
      <p className="muted form-required-note">
        Campos com <abbr title="Obrigatório">*</abbr> são obrigatórios.
      </p>
      <div className="form-grid">
        <Field label="Nome" required>
          <input
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
            disabled={Boolean(initial)}
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={
            !form.name.trim() ||
            !form.phone.trim() ||
            form.phone.replace(/\D/g, "").length < 8
          }
          onClick={submit}
        >
          {initial ? "Salvar" : "Cadastrar hóspede"}
        </Button>
      </footer>
    </Modal>
  );
}
