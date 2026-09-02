import {
  Ban,
  BadgeCheck,
  CreditCard,
  LogIn,
  LogOut,
  Plus,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Loading,
  Modal,
} from "../../components/ui";
import { brl, dateBR, dateTimeBR, notificationFeedback } from "../../lib/format";
import type { Reservation, Room } from "../../types";

const CHARGE_TYPES = [
  { value: "MINIBAR", label: "Frigobar" },
  { value: "RESTAURANT", label: "Restaurante" },
  { value: "LAUNDRY", label: "Lavanderia" },
  { value: "SERVICE", label: "Serviço" },
  { value: "OTHER", label: "Outro" },
  { value: "DISCOUNT", label: "Desconto" },
];

const CHARGE_LABEL: Record<string, string> = {
  ROOM: "Diárias",
  MINIBAR: "Frigobar",
  RESTAURANT: "Restaurante",
  LAUNDRY: "Lavanderia",
  SERVICE: "Serviço",
  OTHER: "Outro",
  DISCOUNT: "Desconto",
};

const PAYMENT_METHODS = [
  { value: "PIX", label: "PIX" },
  { value: "CARD", label: "Cartão" },
  { value: "CASH", label: "Dinheiro" },
];

const PAYMENT_TONE: Record<string, string> = {
  PENDING: "yellow",
  CONFIRMED: "green",
  CANCELLED: "gray",
  REFUNDED: "red",
};

const BILL_TONE: Record<string, string> = {
  QUITADO: "green",
  PARCIAL: "yellow",
  PENDENTE: "red",
};

export function ReservationDetail({
  reservationId,
  onClose,
  onChanged,
}: {
  reservationId: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [chargeType, setChargeType] = useState("MINIBAR");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);

  const load = useCallback(async () => {
    try {
      const detail = await api.reservations.detail(reservationId);
      setReservation(detail);
      setRoomId(detail.room?.id ?? "");
      setPaymentAmount(
        detail.bill.balance > 0 ? String(detail.bill.balance) : "",
      );
      const available = await api.rooms.list();
      setRooms(available);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [reservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, feedback: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      setMessage(notificationFeedback(feedback, result));
      await load();
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  if (!reservation) {
    return (
      <Modal wide title="Reserva" onClose={onClose}>
        {error ? <Feedback error={error} /> : <Loading />}
      </Modal>
    );
  }

  const { bill } = reservation;
  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isInHouse = isConfirmed && Boolean(reservation.checkedInAt);
  const canCheckIn = (isPending || isConfirmed) && !reservation.checkedInAt;
  const hasAssignedRooms = reservation.roomSelection.length > 0;
  const assignedRoomLabel =
    reservation.roomSelection.length > 1 ? "Quartos atribuídos" : "Quarto atribuído";

  return (
    <Modal
      wide
      title={`Reserva ${reservation.code}`}
      onClose={onClose}
    >
      <Feedback error={error} message={message} />

      <div className="detail-head">
        <div>
          <h3>{reservation.guest.name}</h3>
          <p className="muted">
            {reservation.roomSelection.length > 0
              ? reservation.roomSelection
                  .map(
                    (entry) =>
                      `Quarto ${entry.roomNumber} — ${entry.roomTypeName} (${entry.guests} hósp.)`,
                  )
                  .join(" · ")
              : reservation.room
                ? `Quarto ${reservation.room.number} — ${reservation.roomType.name}`
                : `Tipo ${reservation.roomType.name} (sem quarto atribuído)`}
          </p>
          <p className="muted">
            {dateBR(reservation.checkInDate)} — {dateBR(reservation.checkOutDate)} ·{" "}
            {reservation.pricingSummary}
          </p>
          {isInHouse ? (
            <p className="muted">
              Diárias cobradas: {reservation.billedNights} de até{" "}
              {reservation.plannedNights} · valor aumenta a cada dia de estadia
            </p>
          ) : !reservation.checkedInAt && reservation.status !== "CANCELLED" ? (
            <p className="muted">
              Estimativa máxima: {brl(reservation.maxRoomTotal)} ({reservation.plannedNights}{" "}
              diária{reservation.plannedNights > 1 ? "s" : ""}) — cobrança diária após check-in
            </p>
          ) : null}
        </div>
        <div className="detail-status">
          <Badge tone={statusTone(reservation.status)}>
            {reservation.statusLabel}
          </Badge>
          <Badge tone={BILL_TONE[bill.paymentStatus] ?? "gray"}>
            {bill.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="action-bar">
        {isPending ? (
          <Button
            variant="primary"
            icon={<BadgeCheck size={15} />}
            loading={busy}
            onClick={() =>
              run(
                () =>
                  api.reservations.confirm(
                    reservation.id,
                    !hasAssignedRooms && roomId ? { roomId } : undefined,
                  ),
                "Reserva confirmada.",
              )
            }
          >
            Confirmar
          </Button>
        ) : null}

        {canCheckIn ? (
          <Button
            variant="primary"
            icon={<LogIn size={15} />}
            loading={busy}
            onClick={() =>
              run(
                () =>
                  api.reservations.checkIn(
                    reservation.id,
                    !hasAssignedRooms && roomId ? { roomId } : undefined,
                  ),
                "Check-in registrado. Quarto ocupado.",
              )
            }
          >
            Check-in
          </Button>
        ) : null}

        {isInHouse ? (
          <Button
            variant="primary"
            icon={<LogOut size={15} />}
            loading={busy}
            onClick={() =>
              run(
                () => api.reservations.checkOut(reservation.id),
                "Check-out concluído. Quarto enviado para limpeza.",
              )
            }
          >
            Check-out
          </Button>
        ) : null}

        {(isPending || isConfirmed) && !reservation.checkedInAt ? (
          <Button
            variant="danger"
            icon={<Ban size={15} />}
            loading={busy}
            onClick={() =>
              run(() => api.reservations.cancel(reservation.id), "Reserva cancelada.")
            }
          >
            Cancelar reserva
          </Button>
        ) : null}
      </div>

      {!reservation.checkedOutAt ? (
        hasAssignedRooms ? (
          <Field label={assignedRoomLabel}>
            <ul className="list compact assigned-rooms">
              {reservation.roomSelection.map((entry) => {
                const room = rooms.find((item) => item.id === entry.roomId);
                return (
                  <li key={entry.roomId}>
                    <div>
                      <strong>Quarto {entry.roomNumber}</strong>
                      <span className="muted block">
                        {entry.roomTypeName} · {entry.guests} hóspede
                        {entry.guests > 1 ? "s" : ""}
                        {room ? ` · capacidade ${room.capacity}` : ""}
                      </span>
                    </div>
                    {room ? (
                      <Badge tone={room.statusColor} icon={room.statusIcon}>
                        {room.statusLabel}
                      </Badge>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Field>
        ) : (
          <Field label="Quarto atribuído" hint="Usado na confirmação e no check-in">
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Selecionar quarto…</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.number} · {room.statusLabel} · capacidade {room.capacity}
                </option>
              ))}
            </select>
          </Field>
        )
      ) : null}

      <div className="split">
        <section className="panel">
          <header className="panel-head">
            <h2>Conta do hóspede</h2>
          </header>
          <ul className="bill">
            <li>
              <span>Diárias</span>
              <strong>{brl(bill.roomNights)}</strong>
            </li>
            <li>
              <span>Consumo</span>
              <strong>{brl(bill.consumption)}</strong>
            </li>
            <li>
              <span>Serviços</span>
              <strong>{brl(bill.services)}</strong>
            </li>
            <li>
              <span>Descontos</span>
              <strong>− {brl(bill.discounts)}</strong>
            </li>
            <li className="bill-total">
              <span>Total</span>
              <strong>{brl(bill.total)}</strong>
            </li>
            <li>
              <span>Pago</span>
              <strong>{brl(bill.paid)}</strong>
            </li>
            <li className="bill-total">
              <span>Saldo</span>
              <strong>{brl(bill.balance)}</strong>
            </li>
          </ul>

          {isConfirmed ? (
            <div className="mini-form">
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value)}
              >
                {CHARGE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                placeholder="Descrição"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Valor"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
              <Button
                icon={<Plus size={15} />}
                loading={busy}
                disabled={!chargeDescription || !chargeAmount}
                onClick={() =>
                  run(async () => {
                    await api.reservations.addCharge(reservation.id, {
                      type: chargeType,
                      description: chargeDescription,
                      amount: Number(chargeAmount),
                    });
                    setChargeDescription("");
                    setChargeAmount("");
                  }, "Lançamento adicionado.")
                }
              >
                Lançar
              </Button>
            </div>
          ) : null}

          {reservation.charges.length === 0 ? (
            <EmptyState message="Sem lançamentos." />
          ) : (
            <ul className="list compact">
              {reservation.charges.map((charge) => (
                <li key={charge.id}>
                  <div>
                    <strong>{charge.description}</strong>
                    <span className="muted">
                      {CHARGE_LABEL[charge.type] ?? charge.type}
                    </span>
                  </div>
                  <span>
                    {charge.type === "DISCOUNT" ? "− " : ""}
                    {brl(charge.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Pagamentos</h2>
          </header>

          {reservation.status !== "CANCELLED" &&
          reservation.status !== "COMPLETED" ? (
            <div className="mini-form">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Valor"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={paymentConfirmed}
                  onChange={(e) => setPaymentConfirmed(e.target.checked)}
                />
                Recebido
              </label>
              <Button
                icon={<CreditCard size={15} />}
                loading={busy}
                disabled={!paymentAmount}
                onClick={() =>
                  run(async () => {
                    await api.payments.create(reservation.id, {
                      method: paymentMethod,
                      amount: Number(paymentAmount),
                      status: paymentConfirmed ? "CONFIRMED" : "PENDING",
                    });
                    setPaymentAmount("");
                  }, "Pagamento registrado.")
                }
              >
                Registrar
              </Button>
            </div>
          ) : null}

          {reservation.payments.length === 0 ? (
            <EmptyState message="Nenhum pagamento registrado." />
          ) : (
            <ul className="list compact">
              {reservation.payments.map((payment) => (
                <li key={payment.id}>
                  <div>
                    <strong>
                      {payment.methodLabel} · {brl(payment.amount)}
                    </strong>
                    <span className="muted">
                      {payment.paidAt ? dateTimeBR(payment.paidAt) : "Aguardando"}
                    </span>
                  </div>
                  <div className="cell-actions">
                    <Badge tone={PAYMENT_TONE[payment.status] ?? "gray"}>
                      {payment.statusLabel}
                    </Badge>
                    {payment.status === "PENDING" ? (
                      <>
                        <Button
                          loading={busy}
                          onClick={() =>
                            run(
                              () => api.payments.confirm(payment.id),
                              "Pagamento confirmado.",
                            )
                          }
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="danger"
                          loading={busy}
                          onClick={() =>
                            run(
                              () => api.payments.cancel(payment.id),
                              "Pagamento cancelado.",
                            )
                          }
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : null}
                    {payment.status === "CONFIRMED" && !payment.refundOfId ? (
                      <Button
                        icon={<Undo2 size={15} />}
                        loading={busy}
                        onClick={() =>
                          run(
                            () => api.payments.refund(payment.id),
                            "Estorno registrado.",
                          )
                        }
                      >
                        Estornar
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}

function statusTone(status: string): string {
  if (status === "CONFIRMED") return "green";
  if (status === "PENDING") return "yellow";
  if (status === "CANCELLED") return "red";
  return "blue";
}
