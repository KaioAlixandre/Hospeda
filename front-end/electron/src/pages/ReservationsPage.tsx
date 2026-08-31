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
import type { Reservation } from "../types";
import { NewReservationModal } from "./reservations/NewReservationModal";
import { ReservationDetail } from "./reservations/ReservationDetail";

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Pendentes" },
  { value: "CONFIRMED", label: "Confirmadas" },
  { value: "COMPLETED", label: "Concluídas" },
  { value: "CANCELLED", label: "Canceladas" },
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

export function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReservations(await api.reservations.list(status || undefined));
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
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
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

      <Feedback error={error} message={message} />

      <Panel>
        {loading && reservations.length === 0 ? (
          <Loading />
        ) : reservations.length === 0 ? (
          <EmptyState message="Nenhuma reserva encontrada." />
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
                      {reservation.nights} diária
                      {reservation.nights > 1 ? "s" : ""}
                    </span>
                  </td>
                  <td>
                    {reservation.room
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
