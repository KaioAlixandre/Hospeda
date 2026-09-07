import {
  Calendar,
  CheckCircle2,
  LayoutGrid,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SprayCan,
  Trash2,
  User,
  UserCheck,
  Users,
  Wrench,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../components/ui";
import type { HousekeepingBoard, RoomStatus, Zelador } from "../types";
import { dateBR, notificationFeedback } from "../lib/format";

type HousekeepingTab = "board" | "zeladores";

const TABS: Array<{
  id: HousekeepingTab;
  label: string;
  shortLabel: string;
  icon: ReactNode;
}> = [
  {
    id: "board",
    label: "Quadro de quartos",
    shortLabel: "Quadro",
    icon: <LayoutGrid size={16} />,
  },
  {
    id: "zeladores",
    label: "Zeladores",
    shortLabel: "Zeladores",
    icon: <Users size={16} />,
  },
];

const SUMMARY_META: Array<{
  key: RoomStatus;
  label: string;
  tone: string;
}> = [
  { key: "AVAILABLE", label: "disponível", tone: "green" },
  { key: "OCCUPIED", label: "ocupado", tone: "red" },
  { key: "CLEANING", label: "em limpeza", tone: "yellow" },
  { key: "RESERVED", label: "reservado", tone: "blue" },
  { key: "MAINTENANCE", label: "bloqueado", tone: "gray" },
];

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

export function HousekeepingPage() {
  const [activeTab, setActiveTab] = useState<HousekeepingTab>("board");
  const [board, setBoard] = useState<HousekeepingBoard | null>(null);
  const [zeladores, setZeladores] = useState<Zelador[]>([]);
  const [filter, setFilter] = useState<RoomStatus | "">("");
  const [zeladorSearch, setZeladorSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingZelador, setEditingZelador] = useState<Zelador | null | "new">(
    null,
  );
  const [deletingZelador, setDeletingZelador] = useState<Zelador | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [boardData, zeladorList] = await Promise.all([
        api.housekeeping.board(),
        api.housekeeping.zeladores.list(),
      ]);
      setBoard(boardData);
      setZeladores(zeladorList);
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

  const visibleRooms = useMemo(() => {
    if (!board) return [];
    if (!filter) return board.rooms;
    return board.rooms.filter((room) => room.status === filter);
  }, [board, filter]);

  const filteredZeladores = useMemo(() => {
    const query = zeladorSearch.trim().toLowerCase();
    if (!query) return zeladores;
    return zeladores.filter(
      (zelador) =>
        zelador.name.toLowerCase().includes(query) ||
        zelador.phone.toLowerCase().includes(query),
    );
  }, [zeladores, zeladorSearch]);

  const cleaningCount = board?.summary.CLEANING ?? 0;
  const availableCount = board?.summary.AVAILABLE ?? 0;
  const maintenanceCount = board?.summary.MAINTENANCE ?? 0;

  async function run(action: () => Promise<unknown>, feedback: string) {
    setError(null);
    try {
      const result = await action();
      setMessage(notificationFeedback(feedback, result));
      await load();
    } catch (err) {
      setError((err as Error).message);
      setMessage(null);
    }
  }

  async function confirmDeleteZelador() {
    if (!deletingZelador) return;
    setDeleting(true);
    setError(null);
    try {
      await api.housekeeping.zeladores.remove(deletingZelador.id);
      setMessage(`Zelador ${deletingZelador.name} removido.`);
      setDeletingZelador(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="page settings-page rooms-tabs-page">
      <header className="settings-page-header">
        <h1>Controle de limpeza</h1>
        <p className="muted">
          Quadro operacional dos quartos e gestão da equipe de zeladores.
        </p>
      </header>

      <Feedback error={error} message={message} />

      <div className="settings-shell">
        <div className="settings-tabs-bar rooms-tabs-bar">
          <nav
            className="settings-tabs"
            role="tablist"
            aria-label="Seções de limpeza"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "active" : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  <span className="settings-tab-short">{tab.shortLabel}</span>
                  <span className="settings-tab-full">{tab.label}</span>
                  {active ? <span className="settings-tab-indicator" /> : null}
                </button>
              );
            })}
          </nav>
          <div className="rooms-tabs-actions">
            {activeTab === "board" ? (
              <Button
                icon={<RefreshCw size={16} />}
                onClick={load}
                loading={loading}
              >
                Atualizar
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setEditingZelador("new")}
              >
                Novo zelador
              </Button>
            )}
          </div>
        </div>

        <div className="settings-tab-panel">
          {activeTab === "board" ? (
            <div role="tabpanel" className="rooms-tab-panel">
              {board ? (
                <div className="status-strip room-status-legend">
                  <button
                    type="button"
                    className={`status-chip filter-chip${filter === "" ? " active" : ""}`}
                    onClick={() => setFilter("")}
                  >
                    <span>todos</span>
                    <strong>{board.rooms.length}</strong>
                  </button>
                  {SUMMARY_META.map((meta) => (
                    <button
                      type="button"
                      key={meta.key}
                      className={`status-chip filter-chip tone-${meta.tone}${
                        filter === meta.key ? " active" : ""
                      }`}
                      onClick={() =>
                        setFilter((current) =>
                          current === meta.key ? "" : meta.key,
                        )
                      }
                    >
                      <span className="status-dot" />
                      <span>{meta.label}</span>
                      <strong>{board.summary[meta.key] ?? 0}</strong>
                    </button>
                  ))}
                </div>
              ) : null}

              {loading && !board ? (
                <Loading />
              ) : !board || visibleRooms.length === 0 ? (
                <EmptyState message="Nenhum quarto neste filtro." />
              ) : (
                <div className="room-board-grid">
                  {visibleRooms.map((room) => (
                    <article
                      key={room.roomId}
                      className={`room-board-card tone-${room.statusColor}`}
                    >
                      <header className="room-board-head">
                        <strong>Quarto {room.number}</strong>
                      </header>
                      <div className="room-board-body">
                        <p className="room-board-empty muted">
                          {room.type}
                          {room.floor !== null
                            ? ` · ${room.floor}º andar`
                            : ""}
                        </p>
                        <div className="room-board-meta muted">
                          <span>{room.statusLabel}</span>
                        </div>
                        <footer className="room-board-actions housekeeping-actions">
                          {room.status === "CLEANING" ? (
                            <button
                              type="button"
                              className="room-board-cta primary"
                              onClick={() =>
                                void run(
                                  () => api.housekeeping.ready(room.roomId),
                                  `Quarto ${room.number} liberado.`,
                                )
                              }
                            >
                              <CheckCircle2 size={14} /> liberar UH
                            </button>
                          ) : null}
                          {["AVAILABLE", "OCCUPIED"].includes(room.status) ? (
                            <button
                              type="button"
                              className="room-board-cta"
                              onClick={() =>
                                void run(
                                  () =>
                                    api.housekeeping.startCleaning(room.roomId),
                                  `Quarto ${room.number} em limpeza.`,
                                )
                              }
                            >
                              <SprayCan size={14} /> limpeza
                            </button>
                          ) : null}
                          {room.status === "MAINTENANCE" ? (
                            <button
                              type="button"
                              className="room-board-cta primary"
                              onClick={() =>
                                void run(
                                  () =>
                                    api.housekeeping.releaseMaintenance(
                                      room.roomId,
                                    ),
                                  `Quarto ${room.number} liberado da manutenção.`,
                                )
                              }
                            >
                              liberar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="room-board-cta"
                              disabled={["OCCUPIED", "RESERVED"].includes(
                                room.status,
                              )}
                              onClick={() =>
                                void run(
                                  () =>
                                    api.housekeeping.maintenance(room.roomId),
                                  `Quarto ${room.number} em manutenção.`,
                                )
                              }
                            >
                              <Wrench size={14} /> manutenção
                            </button>
                          )}
                        </footer>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "zeladores" ? (
            <div role="tabpanel" className="rooms-tab-panel">
              <div className="guests-metrics">
                <article className="guests-metric">
                  <span className="guests-metric-icon tone-brand">
                    <Users size={16} />
                  </span>
                  <div>
                    <p>Total</p>
                    <strong>{zeladores.length}</strong>
                  </div>
                </article>
                <article className="guests-metric">
                  <span className="guests-metric-icon tone-green">
                    <UserCheck size={16} />
                  </span>
                  <div>
                    <p>Disponíveis</p>
                    <strong>{availableCount}</strong>
                  </div>
                </article>
                <article className="guests-metric">
                  <span className="guests-metric-icon tone-amber">
                    <SprayCan size={16} />
                  </span>
                  <div>
                    <p>Em limpeza</p>
                    <strong>{cleaningCount}</strong>
                  </div>
                </article>
                <article className="guests-metric">
                  <span className="guests-metric-icon tone-violet">
                    <Wrench size={16} />
                  </span>
                  <div>
                    <p>Manutenção</p>
                    <strong>{maintenanceCount}</strong>
                  </div>
                </article>
              </div>

              <div className="guests-panel">
                {zeladores.length > 0 ? (
                  <div className="guests-panel-toolbar">
                    <label className="guests-search">
                      <Search size={16} strokeWidth={1.9} />
                      <input
                        value={zeladorSearch}
                        onChange={(event) =>
                          setZeladorSearch(event.target.value)
                        }
                        placeholder="Buscar por nome ou telefone..."
                        aria-label="Pesquisar zeladores"
                      />
                    </label>
                  </div>
                ) : null}

                {loading && zeladores.length === 0 ? (
                  <div className="guests-empty">
                    <Loading label="Carregando zeladores…" />
                  </div>
                ) : filteredZeladores.length === 0 ? (
                  <div className="guests-empty">
                    <div className="guests-empty-icon">
                      {zeladores.length === 0 ? (
                        <User size={28} />
                      ) : (
                        <Search size={28} />
                      )}
                    </div>
                    <p>
                      {zeladores.length === 0
                        ? "Nenhum zelador cadastrado"
                        : "Nenhum resultado encontrado"}
                    </p>
                    <span className="muted">
                      {zeladores.length === 0
                        ? "Comece adicionando o primeiro zelador à equipe"
                        : "Tente buscar com outros termos"}
                    </span>
                    {zeladores.length === 0 ? (
                      <Button
                        variant="primary"
                        icon={<Plus size={16} />}
                        onClick={() => setEditingZelador("new")}
                      >
                        Adicionar zelador
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <ul className="guests-mobile-list">
                      {filteredZeladores.map((zelador) => (
                        <li key={zelador.id} className="guests-mobile-card">
                          <div className="guests-mobile-top">
                            <span
                              className={`guest-avatar tone-${avatarTone(zelador.id)}`}
                            >
                              {getInitials(zelador.name)}
                            </span>
                            <div className="guests-mobile-copy">
                              <strong>{zelador.name}</strong>
                              <p className="guest-contact">
                                <Phone size={13} /> {zelador.phone}
                              </p>
                              <p className="guest-contact">
                                <Calendar size={13} /> Cadastro:{" "}
                                {dateBR(zelador.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="guests-mobile-actions zelador-mobile-actions">
                            <button
                              type="button"
                              className="guest-action-btn"
                              onClick={() => setEditingZelador(zelador)}
                            >
                              <Pencil size={14} /> Editar
                            </button>
                            <button
                              type="button"
                              className="guest-action-btn danger"
                              onClick={() => setDeletingZelador(zelador)}
                            >
                              <Trash2 size={14} /> Remover
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="guests-table-wrap">
                      <table className="guests-table">
                        <thead>
                          <tr>
                            <th>Zelador</th>
                            <th>Telefone</th>
                            <th>Cadastro</th>
                            <th className="text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredZeladores.map((zelador) => (
                            <tr key={zelador.id}>
                              <td>
                                <div className="guest-identity">
                                  <span
                                    className={`guest-avatar tone-${avatarTone(zelador.id)}`}
                                  >
                                    {getInitials(zelador.name)}
                                  </span>
                                  <strong>{zelador.name}</strong>
                                </div>
                              </td>
                              <td>
                                <span className="guest-contact">
                                  <Phone size={13} /> {zelador.phone}
                                </span>
                              </td>
                              <td>
                                <span className="guest-contact">
                                  <Calendar size={13} />{" "}
                                  {dateBR(zelador.createdAt)}
                                </span>
                              </td>
                              <td className="text-center">
                                <div className="guest-row-actions">
                                  <button
                                    type="button"
                                    className="guest-icon-btn"
                                    title="Editar"
                                    onClick={() => setEditingZelador(zelador)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    className="guest-icon-btn danger"
                                    title="Remover"
                                    onClick={() => setDeletingZelador(zelador)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <footer className="guests-panel-footer">
                      <p className="muted">
                        {filteredZeladores.length === zeladores.length
                          ? `${filteredZeladores.length} zelador${
                              filteredZeladores.length === 1 ? "" : "es"
                            }`
                          : `${filteredZeladores.length} de ${zeladores.length} zelador${
                              zeladores.length === 1 ? "" : "es"
                            }`}
                      </p>
                      <p className="muted">
                        Quartos em limpeza: <strong>{cleaningCount}</strong>
                      </p>
                    </footer>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {editingZelador !== null ? (
        <ZeladorForm
          initial={editingZelador === "new" ? null : editingZelador}
          onClose={() => setEditingZelador(null)}
          onSaved={async (feedback) => {
            setEditingZelador(null);
            setMessage(feedback);
            await load();
          }}
        />
      ) : null}

      {deletingZelador ? (
        <Modal title="Remover zelador" onClose={() => setDeletingZelador(null)}>
          <p>
            Tem certeza que deseja remover{" "}
            <strong>{deletingZelador.name}</strong>? Esta ação não pode ser
            desfeita.
          </p>
          <footer className="modal-foot">
            <Button
              onClick={() => setDeletingZelador(null)}
              disabled={deleting}
            >
              Voltar
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              onClick={() => void confirmDeleteZelador()}
            >
              Confirmar remoção
            </Button>
          </footer>
        </Modal>
      ) : null}
    </section>
  );
}

function ZeladorForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Zelador | null;
  onClose: () => void;
  onSaved: (feedback: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.housekeeping.zeladores.update(initial.id, { name, phone });
        await onSaved("Zelador atualizado.");
      } else {
        await api.housekeeping.zeladores.create({ name, phone });
        await onSaved("Zelador cadastrado.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? "Editar zelador" : "Novo zelador"}
      onClose={onClose}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        {initial
          ? "Atualize as informações do zelador"
          : "Preencha os dados para cadastrar"}
      </p>
      <Feedback error={error} />
      <div className="form-grid">
        <Field label="Nome">
          <div className="input-with-icon">
            <User size={16} />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do zelador"
            />
          </div>
        </Field>
        <Field label="Telefone" hint="Com DDD">
          <div className="input-with-icon">
            <Phone size={16} />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
            />
          </div>
        </Field>
      </div>
      <footer className="modal-foot">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          loading={saving}
          disabled={!name.trim() || phone.trim().length < 8}
          onClick={submit}
        >
          {initial ? "Salvar" : "Cadastrar"}
        </Button>
      </footer>
    </Modal>
  );
}
