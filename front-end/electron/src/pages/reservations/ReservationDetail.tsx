import {
  Ban,
  BadgeCheck,
  CalendarPlus,
  CircleDollarSign,
  CreditCard,
  LogIn,
  LogOut,
  Minus,
  Pencil,
  Plus,
  Printer,
  Scale,
  Search,
  ShoppingCart,
  Trash2,
  Undo2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  Field,
  Icon,
  Loading,
  Modal,
} from "../../components/ui";
import {
  brl,
  moneyInputMask,
  notificationFeedback,
  parseMoneyInput,
  dateBR,
  dateTimeBR,
} from "../../lib/format";
import type {
  Charge,
  ChargeCategory,
  Product,
  Reservation,
  Room,
} from "../../types";

function toDateInput(value: string): string {
  return value.slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type CartItem =
  | {
      key: string;
      kind: "product";
      productId: string;
      name: string;
      unitPrice: number;
      quantity: number;
    }
  | {
      key: string;
      kind: "manual";
      categoryId: string;
      description: string;
      amount: number;
      quantity: number;
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
  const [chargeTab, setChargeTab] = useState<"products" | "manual">("products");
  const [chargeCategoryId, setChargeCategoryId] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [categories, setCategories] = useState<ChargeCategory[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [productCategoryId, setProductCategoryId] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
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
    setChargeDescription("");
    setChargeAmount("");
    setCart([]);
    setProductSearch("");
    setChargeTab("products");
  }

  function startEditCharge(charge: Charge) {
    setEditingChargeId(charge.id);
    setChargeTab("manual");
    setChargeCategoryId(charge.categoryId ?? categories[0]?.id ?? "");
    setChargeDescription(charge.description);
    setChargeAmount(String(charge.amount));
  }

  const loadCatalog = useCallback(async () => {
    const [cats, prods] = await Promise.all([
      api.chargeCategories.list({ active: true }),
      api.products.list({ active: true }),
    ]);
    setCategories(cats);
    setCatalogProducts(prods);
    setChargeCategoryId((prev) => prev || cats[0]?.id || "");
    setProductCategoryId((prev) => prev || cats[0]?.id || "");
  }, []);

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

  useEffect(() => {
    if (!chargesOpen) return;
    void loadCatalog().then(() => {
      requestAnimationFrame(() => searchRef.current?.focus());
    });
  }, [chargesOpen, loadCatalog]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      if (productCategoryId && p.categoryId !== productCategoryId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.code?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [catalogProducts, productCategoryId, productSearch]);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, item) => {
        if (item.kind === "product") {
          return sum + item.unitPrice * item.quantity;
        }
        return sum + item.amount * item.quantity;
      }, 0),
    [cart],
  );

  function addProductToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.kind === "product" && item.productId === product.id,
      );
      if (existing && existing.kind === "product") {
        return prev.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: Math.min(99, item.quantity + 1) }
            : item,
        );
      }
      return [
        ...prev,
        {
          key: `p-${product.id}`,
          kind: "product" as const,
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.price),
          quantity: 1,
        },
      ];
    });
  }

  function setCartQty(key: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key
            ? { ...item, quantity: Math.max(0, Math.min(99, quantity)) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }
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
    if (!window.staydesck?.print?.reservation) {
      setError(
        "Impressão disponível apenas no aplicativo desktop. Configure em Configurações → Impressão.",
      );
      return;
    }
    setPrinting(true);
    setError(null);
    try {
      const result = await window.staydesck.print.reservation({
        ...reservation,
        hotel: {
          name: hotel?.name ?? "StayDesck",
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
        <p className="muted charges-modal-intro">
          Produtos cadastrados ou texto livre. Diárias automáticas não podem ser
          alteradas aqui.
        </p>

        {reservation.status !== "CANCELLED" && !editingChargeId ? (
          <>
            <div className="charges-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={chargeTab === "products" ? "active" : undefined}
                aria-selected={chargeTab === "products"}
                onClick={() => setChargeTab("products")}
              >
                Produtos
              </button>
              <button
                type="button"
                role="tab"
                className={chargeTab === "manual" ? "active" : undefined}
                aria-selected={chargeTab === "manual"}
                onClick={() => setChargeTab("manual")}
              >
                Manual
              </button>
            </div>

            {chargeTab === "products" ? (
              <div className="charges-products-pane">
                <label className="products-search charges-product-search">
                  <Search size={16} />
                  <input
                    ref={searchRef}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar nome ou código (Enter adiciona)"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const first = filteredProducts[0];
                        if (first) addProductToCart(first);
                      }
                    }}
                  />
                </label>
                <div className="charges-category-pills">
                  <button
                    type="button"
                    className={
                      productCategoryId === "" ? "chip active" : "chip"
                    }
                    onClick={() => setProductCategoryId("")}
                  >
                    Todas
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={
                        productCategoryId === cat.id ? "chip active" : "chip"
                      }
                      onClick={() => setProductCategoryId(cat.id)}
                    >
                      {cat.icon ? <Icon name={cat.icon} size={14} /> : null}
                      {cat.name}
                    </button>
                  ))}
                </div>
                <div className="charges-product-grid">
                  {filteredProducts.length === 0 ? (
                    <p className="muted">Nenhum produto nesta busca.</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="charges-product-btn"
                        onClick={() => addProductToCart(product)}
                      >
                        <strong>{product.name}</strong>
                        <span>{brl(product.price)}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="mini-form">
                <select
                  value={chargeCategoryId}
                  onChange={(e) => setChargeCategoryId(e.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Descrição"
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                />
                <input
                  inputMode="numeric"
                  placeholder="Valor"
                  value={chargeAmount}
                  onChange={(e) =>
                    setChargeAmount(moneyInputMask(e.target.value))
                  }
                />
                <Button
                  icon={<Plus size={15} />}
                  disabled={
                    !isConfirmed ||
                    !chargeCategoryId ||
                    !chargeDescription ||
                    !(parseMoneyInput(chargeAmount) > 0)
                  }
                  onClick={() => {
                    const amount = parseMoneyInput(chargeAmount);
                    if (!(amount > 0) || !chargeCategoryId) return;
                    setCart((prev) => [
                      ...prev,
                      {
                        key: `m-${Date.now()}`,
                        kind: "manual",
                        categoryId: chargeCategoryId,
                        description: chargeDescription.trim(),
                        amount,
                        quantity: 1,
                      },
                    ]);
                    setChargeDescription("");
                    setChargeAmount("");
                  }}
                >
                  Ao carrinho
                </Button>
              </div>
            )}

            <div className="charges-cart">
              <header>
                <ShoppingCart size={16} />
                <strong>Carrinho</strong>
                <span className="muted">{cart.length} item(ns)</span>
              </header>
              {cart.length === 0 ? (
                <p className="muted">Nada selecionado ainda.</p>
              ) : (
                <ul className="list compact">
                  {cart.map((item) => (
                    <li key={item.key}>
                      <div>
                        <strong>
                          {item.kind === "product"
                            ? item.name
                            : item.description}
                        </strong>
                        <span className="muted">
                          {item.kind === "product"
                            ? brl(item.unitPrice)
                            : brl(item.amount)}{" "}
                          · un.
                        </span>
                      </div>
                      <div className="cell-actions charges-cart-qty">
                        <Button
                          icon={<Minus size={14} />}
                          onClick={() =>
                            setCartQty(item.key, item.quantity - 1)
                          }
                        />
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={item.quantity}
                          onChange={(e) =>
                            setCartQty(item.key, Number(e.target.value) || 1)
                          }
                        />
                        <Button
                          icon={<Plus size={14} />}
                          onClick={() =>
                            setCartQty(item.key, item.quantity + 1)
                          }
                        />
                        <span>
                          {brl(
                            item.kind === "product"
                              ? item.unitPrice * item.quantity
                              : item.amount * item.quantity,
                          )}
                        </span>
                        <Button
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setCartQty(item.key, 0)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <footer className="charges-cart-foot">
                <strong>Total {brl(cartTotal)}</strong>
                <Button
                  variant="primary"
                  icon={<Plus size={15} />}
                  loading={busy}
                  disabled={!isConfirmed || cart.length === 0}
                  onClick={() =>
                    run(async () => {
                      await api.reservations.addChargesBatch(reservation.id, {
                        items: cart.map((item) =>
                          item.kind === "product"
                            ? {
                                productId: item.productId,
                                quantity: item.quantity,
                              }
                            : {
                                categoryId: item.categoryId,
                                description: item.description,
                                amount: Number(
                                  (item.amount * item.quantity).toFixed(2),
                                ),
                                quantity: item.quantity,
                              },
                        ),
                      });
                      resetChargeForm();
                    }, "Lançamentos adicionados.")
                  }
                >
                  Lançar
                </Button>
              </footer>
            </div>
          </>
        ) : null}

        {editingChargeId && reservation.status !== "CANCELLED" ? (
          <div className="mini-form">
            <select
              value={chargeCategoryId}
              onChange={(e) => setChargeCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Descrição"
              value={chargeDescription}
              onChange={(e) => setChargeDescription(e.target.value)}
            />
            <input
              inputMode="numeric"
              placeholder="Valor"
              value={chargeAmount}
              onChange={(e) =>
                setChargeAmount(moneyInputMask(e.target.value))
              }
            />
            <Button
              variant="primary"
              icon={<Pencil size={15} />}
              loading={busy}
              disabled={
                !chargeDescription || !(parseMoneyInput(chargeAmount) > 0)
              }
              onClick={() =>
                run(async () => {
                  await api.reservations.updateCharge(
                    reservation.id,
                    editingChargeId,
                    {
                      categoryId: chargeCategoryId || undefined,
                      description: chargeDescription,
                      amount: parseMoneyInput(chargeAmount),
                    },
                  );
                  resetChargeForm();
                }, "Lançamento atualizado.")
              }
            >
              Salvar
            </Button>
            <Button icon={<X size={15} />} disabled={busy} onClick={resetChargeForm}>
              Cancelar
            </Button>
          </div>
        ) : null}

        {reservation.status === "CANCELLED" ? (
          <p className="muted">
            Reserva cancelada — lançamentos não podem ser alterados.
          </p>
        ) : null}

        {!isConfirmed && reservation.status !== "CANCELLED" && !editingChargeId ? (
          <p className="muted">
            Confirme a reserva para adicionar novos lançamentos.
          </p>
        ) : null}

        <h4 className="charges-list-title">Já lançados</h4>

        {reservation.charges.length === 0 ? (
          <EmptyState message="Sem lançamentos." />
        ) : (
          <ul className="list compact">
            {reservation.charges.map((charge) => {
              const isRoom = charge.type === "ROOM";
              const canManage =
                !isRoom && reservation.status !== "CANCELLED";
              const qty = charge.quantity ?? 1;
              const label =
                charge.category?.name ??
                (isRoom ? "Diárias" : charge.type);
              return (
                <li key={charge.id}>
                  <div>
                    <strong>
                      {qty > 1 ? `${qty}× ` : ""}
                      {charge.description}
                    </strong>
                    <span className="muted">
                      {label}
                      {isRoom ? " · automático" : ""}
                    </span>
                  </div>
                  <div className="cell-actions">
                    <span>
                      {charge.type === "DISCOUNT" ||
                      charge.category?.group === "DISCOUNT"
                        ? "− "
                        : ""}
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