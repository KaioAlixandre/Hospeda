import {
  Ban,
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  CreditCard,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Printer,
  Scale,
  Trash2,
  Undo2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
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

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  const { hotel } = useAuth();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [chargeType, setChargeType] = useState("MINIBAR");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editGuests, setEditGuests] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [chargesOpen, setChargesOpen] = useState(false);
  const [editingChargeId, setEditingChargeId] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);
  const [extendCheckOut, setExtendCheckOut] = useState("");

  function resetChargeForm() {
    setEditingChargeId(null);
    setChargeType("MINIBAR");
    setChargeDescription("");
    setChargeAmount("");
  }

  function startEditCharge(charge: {
    id: string;
    type: string;
    description: string;
    amount: string | number;
  }) {
    setEditingChargeId(charge.id);
    setChargeType(charge.type === "ROOM" ? "OTHER" : charge.type);
    setChargeDescription(charge.description);
    setChargeAmount(String(charge.amount));
  }

  const load = useCallback(async () => {
    try {
      const detail = await api.reservations.detail(reservationId);
      setReservation(detail);
      setRoomId(detail.room?.id ?? "");
      setEditCheckIn(toDateInput(detail.checkInDate));
      setEditCheckOut(toDateInput(detail.checkOutDate));
      setEditGuests(String(detail.guests));
      setEditNotes(detail.notes ?? "");
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

  async function printDetails() {
    if (!reservation) return;
    if (!window.hospeda?.print?.reservation) {
      setError(
        "Impressão disponível apenas no aplicativo desktop. Configure em Configurações → Impressão.",
      );
      return;
    }
    setPrinting(true);
    setError(null);
    try {
      const result = await window.hospeda.print.reservation({
        ...reservation,
        hotel: {
          name: hotel?.name ?? "Hospeda",
          cnpj: hotel?.cnpj ?? null,
          cnpjFormatted: hotel?.cnpjFormatted ?? null,
        },
      });
      setMessage(
        result.copies > 1
          ? "Detalhes da reserva impressos (2 vias)."
          : "Detalhes da reserva enviados à impressora.",
      );
    } catch (err) {
      setError((err as Error).message);
      setMessage(null);
    } finally {
      setPrinting(false);
    }
  }

  if (!reservation) {
    return (
      <Modal xl title="Reserva" onClose={onClose}>
        <Feedback error={error} />
        {error ? (
          <EmptyState message="Não foi possível carregar esta reserva." />
        ) : (
          <Loading />
        )}
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

  const canEdit =
    (isPending || isConfirmed) && !reservation.checkedOutAt;
  const canDelete =
    reservation.status === "CANCELLED" ||
    reservation.status === "COMPLETED" ||
    (isPending && !reservation.checkedInAt);

  const displayTone = isInHouse
    ? "red"
    : statusTone(reservation.status);

  return (
    <>
    <Modal
      xl
      title={`Reserva ${reservation.code}`}
      onClose={onClose}
    >
      <Feedback error={error} message={message} />

      <div className={`detail-head tone-${displayTone}`}>
        <div className="detail-head-main">
          <span className={`status-square tone-${displayTone}`} />
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
        </div>
        <div className="detail-status">
          <Badge tone={displayTone}>
            {isInHouse ? "Hospedado" : reservation.statusLabel}
          </Badge>
          <Badge tone={BILL_TONE[bill.paymentStatus] ?? "gray"}>
            {bill.paymentStatus}
          </Badge>
        </div>
      </div>

      <div className="detail-kpi-grid">
        <article className="detail-kpi">
          <span className="detail-kpi-icon">
            <Wallet size={14} />
          </span>
          <strong>{brl(bill.total)}</strong>
          <span>Total</span>
        </article>
        <article className="detail-kpi">
          <span className="detail-kpi-icon">
            <CircleDollarSign size={14} />
          </span>
          <strong>{brl(bill.paid)}</strong>
          <span>Pago</span>
        </article>
        <article className="detail-kpi tone-balance">
          <span className="detail-kpi-icon">
            <Scale size={14} />
          </span>
          <strong>{brl(bill.balance)}</strong>
          <span>Saldo</span>
        </article>
        <article className="detail-kpi">
          <span className="detail-kpi-icon">
            <Users size={14} />
          </span>
          <strong>{reservation.guests}</strong>
          <span>Hóspedes</span>
        </article>
      </div>

      <div className="action-bar">
        <div className="action-bar-group">
          <Button
            icon={<Printer size={15} />}
            loading={printing}
            disabled={busy}
            onClick={() => void printDetails()}
          >
            Imprimir
          </Button>

          {canEdit ? (
            <Button
              icon={<Pencil size={15} />}
              loading={busy}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Fechar edição" : "Editar"}
            </Button>
          ) : null}

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
            <>
              <Button
                icon={<CalendarPlus size={15} />}
                loading={busy}
                onClick={() => {
                  setExtendCheckOut(
                    addDaysISO(toDateInput(reservation.checkOutDate), 1),
                  );
                  setExtending(true);
                }}
              >
                Prorrogar
              </Button>
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
            </>
          ) : null}
        </div>

        {((isPending || isConfirmed) && !reservation.checkedInAt) || canDelete ? (
          <div className="action-bar-group danger-group">
            {(isPending || isConfirmed) && !reservation.checkedInAt ? (
              <Button
                variant="danger"
                icon={<Ban size={15} />}
                loading={busy}
                onClick={() =>
                  run(
                    () => api.reservations.cancel(reservation.id),
                    "Reserva cancelada.",
                  )
                }
              >
                Cancelar reserva
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="danger"
                icon={<Trash2 size={15} />}
                loading={busy}
                onClick={() => {
                  if (!window.confirm(`Excluir a reserva ${reservation.code}?`)) {
                    return;
                  }
                  void run(async () => {
                    await api.reservations.remove(reservation.id);
                    await onChanged();
                    onClose();
                  }, "Reserva excluída.");
                }}
              >
                Excluir
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editing && canEdit ? (
        <div className="edit-panel">
          <p className="modal-section-title">Editar reserva</p>
          <div className="form-grid">
            <Field label="Data de entrada">
              <input
                type="date"
                value={editCheckIn}
                disabled={Boolean(reservation.checkedInAt)}
                onChange={(e) => setEditCheckIn(e.target.value)}
              />
            </Field>
            <Field label="Data de saída">
              <input
                type="date"
                value={editCheckOut}
                disabled={Boolean(reservation.checkedInAt)}
                onChange={(e) => setEditCheckOut(e.target.value)}
              />
            </Field>
            <Field label="Hóspedes">
              <input
                type="number"
                min={1}
                value={editGuests}
                disabled={Boolean(reservation.checkedInAt)}
                onChange={(e) => setEditGuests(e.target.value)}
              />
            </Field>
            <Field label="Observações">
              <input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </Field>
          </div>
          <div className="edit-panel-actions">
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                run(async () => {
                  await api.reservations.update(reservation.id, {
                    ...(reservation.checkedInAt
                      ? {}
                      : {
                          checkInDate: editCheckIn,
                          checkOutDate: editCheckOut,
                          guests: Number(editGuests),
                        }),
                    notes: editNotes || null,
                  });
                  setEditing(false);
                }, "Reserva atualizada.")
              }
            >
              Salvar alterações
            </Button>
          </div>
        </div>
      ) : null}

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

          <div className="charges-launch">
            <Button
              icon={<Plus size={15} />}
              onClick={() => setChargesOpen(true)}
            >
              {reservation.charges.length === 0
                ? "Abrir lançamentos"
                : `Lançamentos (${reservation.charges.length})`}
            </Button>
          </div>
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

    {chargesOpen ? (
      <Modal
        wide
        title={`Lançamentos · ${reservation.code}`}
        onClose={() => {
          resetChargeForm();
          setChargesOpen(false);
        }}
      >
        <Feedback error={error} message={message} />
        <p className="muted charges-modal-intro">
          Consumos, serviços e descontos da conta do hóspede. Diárias
          automáticas não podem ser alteradas aqui.
        </p>

        {reservation.status !== "CANCELLED" ? (
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
            {editingChargeId ? (
              <>
                <Button
                  variant="primary"
                  icon={<Pencil size={15} />}
                  loading={busy}
                  disabled={!chargeDescription || !chargeAmount}
                  onClick={() =>
                    run(async () => {
                      await api.reservations.updateCharge(
                        reservation.id,
                        editingChargeId,
                        {
                          type: chargeType,
                          description: chargeDescription,
                          amount: Number(chargeAmount),
                        },
                      );
                      resetChargeForm();
                    }, "Lançamento atualizado.")
                  }
                >
                  Salvar
                </Button>
                <Button
                  icon={<X size={15} />}
                  disabled={busy}
                  onClick={resetChargeForm}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                icon={<Plus size={15} />}
                loading={busy}
                disabled={
                  !isConfirmed || !chargeDescription || !chargeAmount
                }
                onClick={() =>
                  run(async () => {
                    await api.reservations.addCharge(reservation.id, {
                      type: chargeType,
                      description: chargeDescription,
                      amount: Number(chargeAmount),
                    });
                    resetChargeForm();
                  }, "Lançamento adicionado.")
                }
              >
                Lançar
              </Button>
            )}
          </div>
        ) : (
          <p className="muted">
            Reserva cancelada — lançamentos não podem ser alterados.
          </p>
        )}

        {!isConfirmed && reservation.status !== "CANCELLED" && !editingChargeId ? (
          <p className="muted">
            Confirme a reserva para adicionar novos lançamentos.
          </p>
        ) : null}

        {reservation.charges.length === 0 ? (
          <EmptyState message="Sem lançamentos." />
        ) : (
          <ul className="list compact">
            {reservation.charges.map((charge) => {
              const isRoom = charge.type === "ROOM";
              const canManage =
                !isRoom && reservation.status !== "CANCELLED";
              return (
                <li key={charge.id}>
                  <div>
                    <strong>{charge.description}</strong>
                    <span className="muted">
                      {CHARGE_LABEL[charge.type] ?? charge.type}
                      {isRoom ? " · automático" : ""}
                    </span>
                  </div>
                  <div className="cell-actions">
                    <span>
                      {charge.type === "DISCOUNT" ? "− " : ""}
                      {brl(charge.amount)}
                    </span>
                    {canManage ? (
                      <>
                        <Button
                          icon={<Pencil size={14} />}
                          loading={busy}
                          disabled={editingChargeId === charge.id}
                          onClick={() => startEditCharge(charge)}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          loading={busy}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Excluir o lançamento "${charge.description}"?`,
                              )
                            ) {
                              return;
                            }
                            void run(async () => {
                              await api.reservations.removeCharge(
                                reservation.id,
                                charge.id,
                              );
                              if (editingChargeId === charge.id) {
                                resetChargeForm();
                              }
                            }, "Lançamento excluído.");
                          }}
                        >
                          Excluir
                        </Button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <footer className="modal-foot">
          <Button
            onClick={() => {
              resetChargeForm();
              setChargesOpen(false);
            }}
          >
            Fechar
          </Button>
        </footer>
      </Modal>
    ) : null}

    {extending ? (
      <Modal
        title={`Prorrogar estadia · ${reservation.code}`}
        onClose={() => setExtending(false)}
      >
        <p className="muted charges-modal-intro">
          Saída prevista atual:{" "}
          <strong>{dateBR(reservation.checkOutDate)}</strong>. Escolha uma data
          posterior; o sistema verifica se o(s) quarto(s) continua(m)
          disponível(is).
        </p>
        <Field label="Nova data de saída" required>
          <input
            type="date"
            min={addDaysISO(toDateInput(reservation.checkOutDate), 1)}
            value={extendCheckOut}
            onChange={(e) => setExtendCheckOut(e.target.value)}
          />
        </Field>
        <footer className="modal-foot">
          <Button onClick={() => setExtending(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            icon={<CalendarPlus size={15} />}
            loading={busy}
            disabled={
              !extendCheckOut ||
              extendCheckOut <= toDateInput(reservation.checkOutDate)
            }
            onClick={() =>
              void run(async () => {
                await api.reservations.extend(reservation.id, {
                  checkOutDate: extendCheckOut,
                });
                setExtending(false);
              }, "Estadia prorrogada.")
            }
          >
            Confirmar prorrogação
          </Button>
        </footer>
      </Modal>
    ) : null}
    </>
  );
}

function statusTone(status: string): string {
  if (status === "CONFIRMED") return "green";
  if (status === "PENDING") return "yellow";
  if (status === "CANCELLED") return "red";
  return "blue";
}