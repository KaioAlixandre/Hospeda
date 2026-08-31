import {
  CheckCircle2,
  Plus,
  RefreshCw,
  SprayCan,
  Trash2,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Icon,
  Loading,
  Modal,
  Panel,
} from "../components/ui";
import type { HousekeepingBoard, RoomStatus, Zelador } from "../types";
import { notificationFeedback } from "../lib/format";

const SUMMARY_META: Array<{ key: RoomStatus; label: string; icon: string; tone: string }> = [
  { key: "AVAILABLE", label: "Disponível", icon: "door-open", tone: "green" },
  { key: "OCCUPIED", label: "Ocupado", icon: "bed-double", tone: "red" },
  { key: "CLEANING", label: "Limpeza", icon: "spray-can", tone: "yellow" },
  { key: "RESERVED", label: "Reservado", icon: "calendar-check", tone: "blue" },
  { key: "MAINTENANCE", label: "Manutenção", icon: "wrench", tone: "gray" },
];

const FILTERS = [
  { value: "", label: "Todos" },
  ...SUMMARY_META.map((meta) => ({ value: meta.key, label: meta.label })),
];

export function HousekeepingPage() {
  const [board, setBoard] = useState<HousekeepingBoard | null>(null);
  const [zeladores, setZeladores] = useState<Zelador[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showZeladorForm, setShowZeladorForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [boardData, zeladorList] = await Promise.all([
        api.housekeeping.board(filter || undefined),
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
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function removeZelador(zelador: Zelador) {
    setError(null);
    try {
      await api.housekeeping.zeladores.remove(zelador.id);
      setMessage(`Zelador ${zelador.name} removido.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Governança</p>
          <h1>Controle de limpeza</h1>
        </div>
        <div className="header-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button icon={<RefreshCw size={16} />} onClick={load} loading={loading}>
            Atualizar
          </Button>
        </div>
      </header>

      <Feedback error={error} message={message} />

      {board ? (
        <div className="status-strip">
          {SUMMARY_META.map((meta) => (
            <div key={meta.key} className={`status-chip tone-${meta.tone}`}>
              <Icon name={meta.icon} size={16} />
              <span>{meta.label}</span>
              <strong>{board.summary[meta.key] ?? 0}</strong>
            </div>
          ))}
        </div>
      ) : null}

      <Panel
        title="Zeladores"
        action={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowZeladorForm(true)}
          >
            Novo zelador
          </Button>
        }
      >
        {loading && zeladores.length === 0 ? (
          <Loading />
        ) : zeladores.length === 0 ? (
          <EmptyState message="Nenhum zelador cadastrado." />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zeladores.map((zelador) => (
                <tr key={zelador.id}>
                  <td>
                    <strong>{zelador.name}</strong>
                  </td>
                  <td>{zelador.phone}</td>
                  <td>
                    <Button
                      variant="danger"
                      icon={<Trash2 size={15} />}
                      onClick={() => void removeZelador(zelador)}
                    >
                      Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Quadro de quartos">
        {loading && !board ? (
          <Loading />
        ) : !board || board.rooms.length === 0 ? (
          <EmptyState message="Nenhum quarto neste filtro." />
        ) : (
          <div className="board-grid">
            {board.rooms.map((room) => (
              <article key={room.roomId} className={`board-card tone-${room.statusColor}`}>
                <header>
                  <strong>{room.number}</strong>
                  <Badge tone={room.statusColor} icon={room.statusIcon}>
                    {room.statusLabel}
                  </Badge>
                </header>
                <p className="muted">
                  {room.type}
                  {room.floor !== null ? ` · ${room.floor}º andar` : ""}
                </p>
                <footer className="board-actions">
                  {room.status === "CLEANING" ? (
                    <Button
                      variant="primary"
                      icon={<CheckCircle2 size={15} />}
                      onClick={() =>
                        run(
                          () => api.housekeeping.ready(room.roomId),
                          `Quarto ${room.number} liberado.`,
                        )
                      }
                    >
                      Limpeza pronta
                    </Button>
                  ) : null}

                  {["AVAILABLE", "OCCUPIED"].includes(room.status) ? (
                    <Button
                      icon={<SprayCan size={15} />}
                      onClick={() =>
                        run(
                          () => api.housekeeping.startCleaning(room.roomId),
                          `Quarto ${room.number} em limpeza.`,
                        )
                      }
                    >
                      Iniciar limpeza
                    </Button>
                  ) : null}

                  {room.status === "MAINTENANCE" ? (
                    <Button
                      icon={<CheckCircle2 size={15} />}
                      onClick={() =>
                        run(
                          () => api.housekeeping.releaseMaintenance(room.roomId),
                          `Quarto ${room.number} liberado da manutenção.`,
                        )
                      }
                    >
                      Liberar manutenção
                    </Button>
                  ) : (
                    <Button
                      icon={<Wrench size={15} />}
                      disabled={["OCCUPIED", "RESERVED"].includes(room.status)}
                      onClick={() =>
                        run(
                          () => api.housekeeping.maintenance(room.roomId),
                          `Quarto ${room.number} em manutenção.`,
                        )
                      }
                    >
                      Manutenção
                    </Button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </Panel>

      {showZeladorForm ? (
        <ZeladorForm
          onClose={() => setShowZeladorForm(false)}
          onSaved={async () => {
            setShowZeladorForm(false);
            setMessage("Zelador cadastrado.");
            await load();
          }}
        />
      ) : null}
    </section>
  );
}

function ZeladorForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.housekeeping.zeladores.create({ name, phone });
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Novo zelador" onClose={onClose}>
      <Feedback error={error} />
      <div className="form-grid">
        <Field label="Nome">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Telefone" hint="Com DDD">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="11999999999"
          />
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
          Cadastrar
        </Button>
      </footer>
    </Modal>
  );
}
