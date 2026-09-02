import { Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Loading,
  Panel,
} from "../components/ui";
import { brl, dateBR } from "../lib/format";
import type { Reservation, ReservationStatus } from "../types";
import { NewReservationModal } from "./reservations/NewReservationModal";
import { ReservationDetail } from "./reservations/ReservationDetail";

type StatusFilter = ReservationStatus | "ALL";

const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
  tone: string;
}> = [
  { value: "CONFIRMED", label: "Confirmadas", tone: "green" },
  { value: "PENDING", label: "Pendentes", tone: "yellow" },
  { value: "COMPLETED", label: "Concluídas", tone: "blue" },
  { value: "CANCELLED", label: "Canceladas", tone: "red" },
  { value: "ALL", label: "Todas", tone: "gray" },
];

const STATUS_TONE: Record<string, string> = {
  PENDING: "yellow",
  CONFIRMED: "green",
  CANCELLED: "red",
  COMPLETED: "blue",
};

const BILL_TONE: Record<string, string> = {
  QUITADO: "green",
  PARCIAL: "yellow",
  PENDENTE: "red",
};

const EMPTY_MESSAGES: Record<StatusFilter, string> = {
  CONFIRMED: "Nenhuma reserva confirmada encontrada.",
  PENDING: "Nenhuma reserva pendente encontrada.",
  COMPLETED: "Nenhuma reserva concluída encontrada.",
  CANCELLED: "Nenhuma reserva cancelada encontrada.",
  ALL: "Nenhuma reserva encontrada.",
};

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState<StatusFilter>("CONFIRMED");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReservations(
        await api.reservations.list(status === "ALL" ? undefined : status),
      );
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

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

      <div className="filter-bar" role="tablist" aria-label="Filtrar reservas por status">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={status === filter.value}
            className={
              status === filter.value
                ? `filter-tab active tone-${filter.tone}`
                : `filter-tab tone-${filter.tone}`
            }
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <Feedback error={error} message={message} />

      <Panel>
        {loading && reservations.length === 0 ? (
          <Loading />
        ) : reservations.length === 0 ? (
          <EmptyState message={EMPTY_MESSAGES[status]} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Hóspede</th>
                <th>Período</th>
                <th>Quarto</th>
                <th>Hóspedes</th>
                <th>Total</th>
                <th>Saldo</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    <code>{reservation.code}</code>
                  </td>
                  <td>
                    <strong>{reservation.guest.name}</strong>
                  </td>
                  <td>
                    {dateBR(reservation.checkInDate)} —{" "}
                    {dateBR(reservation.checkOutDate)}
                    <span className="muted block">
                      {reservation.billedNights > 0
                        ? `${reservation.billedNights} diária${reservation.billedNights > 1 ? "s" : ""} cobrada${reservation.billedNights > 1 ? "s" : ""}`
                        : `até ${reservation.plannedNights} diária${reservation.plannedNights > 1 ? "s" : ""}`}
                    </span>
                  </td>
                  <td>
                    {reservation.roomSelection.length > 0
                      ? reservation.roomSelection
                          .map(
                            (entry) =>
                              `${entry.roomNumber} · ${entry.roomTypeName}`,
                          )
                          .join(" + ")
                      : reservation.room
                        ? `${reservation.room.number} · ${reservation.roomType.name}`
                        : reservation.roomType.name}
                  </td>
                  <td>{reservation.guests}</td>
                  <td>{brl(reservation.bill.total)}</td>
                  <td>
                    <Badge
                      tone={BILL_TONE[reservation.bill.paymentStatus] ?? "gray"}
                    >
                      {brl(reservation.bill.balance)}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[reservation.status] ?? "gray"}>
                      {reservation.statusLabel}
                    </Badge>
                  </td>
                  <td>
                    <Button onClick={() => setDetailId(reservation.id)}>
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
