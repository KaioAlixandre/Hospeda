import { Plus, RefreshCw, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  Button,
  EmptyState,
  Feedback,
  Loading,
  Panel,
} from "../components/ui";
import { dateBR } from "../lib/format";
import type { Reservation } from "../types";
import { NewReservationModal } from "./reservations/NewReservationModal";
import { ReservationDetail } from "./reservations/ReservationDetail";

type DisplayStatus =
  | "PENDING"
  | "RESERVED"
  | "STAYING"
  | "COMPLETED"
  | "CANCELLED";

type StatusFilter = DisplayStatus | "ALL";

const STATUS_META: Array<{
  value: DisplayStatus;
  label: string;
  tone: string;
}> = [
  { value: "PENDING", label: "pré-reservado", tone: "yellow" },
  { value: "RESERVED", label: "reservado", tone: "blue" },
  { value: "STAYING", label: "hospedado", tone: "red" },
  { value: "COMPLETED", label: "finalizado", tone: "green" },
  { value: "CANCELLED", label: "cancelado", tone: "gray" },
];

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  ALL: "Nenhuma reserva encontrada.",
  PENDING: "Nenhuma pré-reserva encontrada.",
  RESERVED: "Nenhuma reserva confirmada encontrada.",
  STAYING: "Nenhum hóspede hospedado no momento.",
  COMPLETED: "Nenhuma reserva finalizada encontrada.",
  CANCELLED: "Nenhuma reserva cancelada encontrada.",
};

function displayStatus(reservation: Reservation): DisplayStatus {
  if (reservation.status === "PENDING") return "PENDING";
  if (reservation.status === "CANCELLED") return "CANCELLED";
  if (reservation.status === "COMPLETED") return "COMPLETED";
  if (reservation.checkedInAt && !reservation.checkedOutAt) return "STAYING";
  return "RESERVED";
}

function roomLabel(reservation: Reservation): string {
  if (reservation.roomSelection.length > 0) {
    return reservation.roomSelection
      .map((entry) => `Quarto ${entry.roomNumber}`)
      .join(" + ");
  }
  if (reservation.room) return `Quarto ${reservation.room.number}`;
  return reservation.roomType.name;
}

function matchesSearch(reservation: Reservation, query: string): boolean {
  if (!query) return true;
  const haystack = [
    reservation.code,
    reservation.guest.name,
    roomLabel(reservation),
    reservation.room?.number ?? "",
    ...reservation.roomSelection.map((entry) => entry.roomNumber),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReservations(await api.reservations.list());
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

  const query = search.trim().toLowerCase();

  const summary = useMemo(() => {
    const counts: Record<DisplayStatus, number> = {
      PENDING: 0,
      RESERVED: 0,
      STAYING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const reservation of reservations) {
      if (!matchesSearch(reservation, query)) continue;
      counts[displayStatus(reservation)] += 1;
    }
    return counts;
  }, [reservations, query]);

  const visible = useMemo(() => {
    return reservations.filter((reservation) => {
      if (!matchesSearch(reservation, query)) return false;
      if (status === "ALL") return true;
      return displayStatus(reservation) === status;
    });
  }, [reservations, query, status]);

  const guestsTotal = useMemo(
    () => visible.reduce((sum, item) => sum + item.guests, 0),
    [visible],
  );

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operação</p>
          <h1>Reservas</h1>
        </div>
        <div className="header-actions">
          <Button icon={<RefreshCw size={16} />} onClick={load} loading={loading}>
            Atualizar
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setShowForm(true)}
          >
            Nova reserva
          </Button>
        </div>
      </header>

      <div className="reservations-toolbar">
        <label className="reservations-search">
          <Search size={16} strokeWidth={1.9} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquise por nº, UH ou nome do hóspede"
            aria-label="Pesquisar reservas"
          />
        </label>
      </div>

      <div className="status-strip room-status-legend">
        <button
          type="button"
          className={`status-chip filter-chip${status === "ALL" ? " active" : ""}`}
          onClick={() => setStatus("ALL")}
        >
          <span>todos</span>
          <strong>
            {Object.values(summary).reduce((sum, count) => sum + count, 0)}
          </strong>
        </button>
        {STATUS_META.map((meta) => (
          <button
            type="button"
            key={meta.value}
            className={`status-chip filter-chip tone-${meta.tone}${
              status === meta.value ? " active" : ""
            }`}
            onClick={() =>
              setStatus((current) =>
                current === meta.value ? "ALL" : meta.value,
              )
            }
          >
            <span className="status-dot" />
            <span>{meta.label}</span>
            <strong>{summary[meta.value]}</strong>
          </button>
        ))}
      </div>

      <Feedback error={error} message={message} />

      <Panel
        title="Lista de reservas"
        action={
          <span className="reservations-count muted">
            <Users size={14} strokeWidth={1.9} />
            {visible.length} reserva{visible.length === 1 ? "" : "s"} ·{" "}
            {guestsTotal} hóspede{guestsTotal === 1 ? "" : "s"}
          </span>
        }
      >
        {loading && reservations.length === 0 ? (
          <Loading />
        ) : visible.length === 0 ? (
          <EmptyState message={EMPTY_MESSAGES[status]} />
        ) : (
          <div className="reservations-table-wrap">
            <table className="table reservations-table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Hóspede</th>
                  <th>UH</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((reservation) => {
                  const display = displayStatus(reservation);
                  const tone =
                    STATUS_META.find((meta) => meta.value === display)?.tone ??
                    "gray";
                  return (
                    <tr
                      key={reservation.id}
                      className="reservations-row"
                      onClick={() => setDetailId(reservation.id)}
                    >
                      <td>
                        <span className="reservations-code-cell">
                          <span
                            className={`status-square tone-${tone}`}
                            title={
                              STATUS_META.find((meta) => meta.value === display)
                                ?.label
                            }
                          />
                          <button
                            type="button"
                            className="reservations-code-link"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDetailId(reservation.id);
                            }}
                          >
                            {reservation.code}
                          </button>
                        </span>
                      </td>
                      <td>
                        <strong>{reservation.guest.name}</strong>
                      </td>
                      <td>{roomLabel(reservation)}</td>
                      <td>{dateBR(reservation.checkInDate)}</td>
                      <td>{dateBR(reservation.checkOutDate)}</td>
                      <td>{reservation.guests}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {showForm ? (
        <NewReservationModal
          onClose={() => setShowForm(false)}
          onCreated={async (feedback) => {
            setShowForm(false);
            setMessage(feedback);
            await load();
          }}
        />
      ) : null}

      {detailId ? (
        <ReservationDetail
          reservationId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      ) : null}
    </section>
  );
}
