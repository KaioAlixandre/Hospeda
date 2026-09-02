import type {
  FolioCharge,
  Guest,
  Payment,
  Reservation,
  Room,
  RoomType,
} from "../generated/prisma/client.js";
import { parseRoomSelection } from "./roomSelection.js";

const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  OCCUPIED: "Ocupado",
  CLEANING: "Limpeza",
  MAINTENANCE: "Manutenção",
};

const ROOM_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "green",
  OCCUPIED: "red",
  CLEANING: "yellow",
  RESERVED: "blue",
  MAINTENANCE: "gray",
};

/// Chave de ícone para o cliente resolver (sem emoji no payload)
const ROOM_STATUS_ICON: Record<string, string> = {
  AVAILABLE: "door-open",
  OCCUPIED: "bed-double",
  CLEANING: "spray-can",
  RESERVED: "calendar-check",
  MAINTENANCE: "wrench",
};

const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDateBR(value: Date | string): string {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Diárias já lançadas na conta (cobranças tipo ROOM). */
export function billedRoomNightsFromCharges(
  charges: FolioCharge[],
  nightlyRate: number,
): number {
  const roomTotal = sumByType(charges, (c) => c.type === "ROOM");
  if (roomTotal <= 0 || nightlyRate <= 0) return 0;
  return Math.round(roomTotal / nightlyRate);
}

/** Diárias que devem estar cobradas conforme o andamento da estadia. */
export function computeBillableRoomNights(
  reservation: {
    checkInDate: Date;
    checkOutDate: Date;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
  },
  asOf: Date = new Date(),
): number {
  if (!reservation.checkedInAt) return 0;

  const checkIn = startOfUtcDay(reservation.checkInDate);
  const plannedOut = startOfUtcDay(reservation.checkOutDate);
  const maxNights = nightsBetween(checkIn, plannedOut);

  if (reservation.checkedOutAt) {
    const actualOut = startOfUtcDay(reservation.checkedOutAt);
    return Math.min(maxNights, Math.max(1, nightsBetween(checkIn, actualOut)));
  }

  const today = startOfUtcDay(asOf);
  const includeTonight = addUtcDays(today, 1);
  const nightsSoFar = nightsBetween(checkIn, includeTonight);

  return Math.min(maxNights, Math.max(1, nightsSoFar));
}

export function roomChargeDescription(nights: number, nightlyRate: number): string {
  return nights === 1
    ? `1 diária × R$ ${nightlyRate}`
    : `${nights} diárias × R$ ${nightlyRate}`;
}

export function roomChargeAmount(nights: number, nightlyRate: number): number {
  return Number((nightlyRate * nights).toFixed(2));
}

type RoomWithType = Room & { roomType: RoomType };

/** Monta a visão de cadastro do quarto (campos efetivos). */
export function presentRoom(room: RoomWithType) {
  const typeAmenities = asStringArray(room.roomType.amenities);
  const roomAmenities = asStringArray(room.amenities);
  const typePhotos = asStringArray(room.roomType.photos);
  const roomPhotos = asStringArray(room.photos);

  const capacity = room.capacity ?? room.roomType.capacity;
  const dailyPrice = Number(room.dailyPrice ?? room.roomType.basePrice);

  return {
    id: room.id,
    number: room.number,
    floor: room.floor,
    type: {
      id: room.roomType.id,
      name: room.roomType.name,
      description: room.roomType.description,
    },
    capacity,
    dailyPrice,
    amenities: [...new Set([...typeAmenities, ...roomAmenities])],
    photos: roomPhotos.length > 0 ? roomPhotos : typePhotos,
    status: room.status,
    statusLabel: ROOM_STATUS_LABEL[room.status] ?? room.status,
    statusIcon: ROOM_STATUS_ICON[room.status] ?? "circle",
    statusColor: ROOM_STATUS_COLOR[room.status] ?? "gray",
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

export function presentHousekeepingRoom(room: RoomWithType) {
  const presented = presentRoom(room);
  return {
    roomId: presented.id,
    number: presented.number,
    floor: presented.floor,
    type: presented.type.name,
    status: presented.status,
    statusLabel: presented.statusLabel,
    statusIcon: presented.statusIcon,
    statusColor: presented.statusColor,
    line: `${presented.number} — ${presented.statusLabel}`,
  };
}

export function presentHousekeepingBoard(rooms: RoomWithType[]) {
  const items = rooms.map(presentHousekeepingRoom);
  const summary = {
    AVAILABLE: 0,
    OCCUPIED: 0,
    CLEANING: 0,
    RESERVED: 0,
    MAINTENANCE: 0,
  };

  for (const room of items) {
    if (room.status in summary) {
      summary[room.status as keyof typeof summary] += 1;
    }
  }

  return {
    summary,
    rooms: items,
    board: items.map((room) => room.line),
  };
}

export function presentRoomType(roomType: RoomType & { _count?: { rooms: number } }) {
  return {
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    capacity: roomType.capacity,
    dailyPrice: Number(roomType.basePrice),
    amenities: asStringArray(roomType.amenities),
    photos: asStringArray(roomType.photos),
    roomsCount: roomType._count?.rooms,
    createdAt: roomType.createdAt,
    updatedAt: roomType.updatedAt,
  };
}

/** Cotação de um quarto disponível no período. */
export function presentAvailabilityOption(
  room: RoomWithType,
  checkInDate: string,
  checkOutDate: string,
) {
  const presented = presentRoom(room);
  const nights = nightsBetween(
    new Date(`${checkInDate}T00:00:00.000Z`),
    new Date(`${checkOutDate}T00:00:00.000Z`),
  );
  const nightlyRate = presented.dailyPrice;
  const total = Number((nightlyRate * nights).toFixed(2));
  const diariasLabel = nights === 1 ? "1 diária" : `${nights} diárias`;

  return {
    room: presented,
    label: `Quarto ${presented.number} — ${presented.type.name}`,
    checkInDate,
    checkOutDate,
    periodLabel: `${formatDateBR(checkInDate)} → ${formatDateBR(checkOutDate)}`,
    nights,
    nightlyRate,
    total,
    summary: `${diariasLabel} × ${formatBRL(nightlyRate)} = ${formatBRL(total)} (estimativa máxima)`,
  };
}

type ReservationFull = Reservation & {
  guest: Guest;
  roomType: RoomType;
  room: (Room & { roomType: RoomType }) | null;
  charges?: FolioCharge[];
  payments?: Payment[];
  roomSelection?: unknown;
};

const CONSUMPTION_TYPES = new Set(["MINIBAR", "RESTAURANT"]);
const SERVICE_TYPES = new Set(["LAUNDRY", "SERVICE", "OTHER"]);

/** Diárias + consumo + serviços − descontos = total */
export function buildBill(reservation: {
  charges?: FolioCharge[];
  payments?: Payment[];
}) {
  const charges = reservation.charges ?? [];
  const payments = reservation.payments ?? [];

  const roomNights = sumByType(charges, (c) => c.type === "ROOM");
  const consumption = sumByType(charges, (c) => CONSUMPTION_TYPES.has(c.type));
  const services = sumByType(charges, (c) => SERVICE_TYPES.has(c.type));
  const discounts = sumByType(charges, (c) => c.type === "DISCOUNT");

  const total = Number(
    (roomNights + consumption + services - discounts).toFixed(2),
  );

  const confirmed = payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const refunded = payments
    .filter((p) => p.status === "REFUNDED" && p.refundOfId)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const paid = Number((confirmed - refunded).toFixed(2));
  const balance = Number((total - paid).toFixed(2));

  return {
    roomNights,
    consumption,
    services,
    discounts,
    total,
    paid,
    pending,
    refunded: Number(refunded.toFixed(2)),
    balance,
    paymentStatus:
      balance <= 0 ? "QUITADO" : paid > 0 || pending > 0 ? "PARCIAL" : "PENDENTE",
    formula: "Diárias + consumo + serviços − descontos = total",
    summary: `${formatBRL(roomNights)} + ${formatBRL(consumption)} + ${formatBRL(services)} − ${formatBRL(discounts)} = ${formatBRL(total)}`,
    isPaid: balance <= 0,
  };
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD: "Cartão",
  CASH: "Dinheiro",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

export function presentPayment(payment: Payment) {
  return {
    id: payment.id,
    reservationId: payment.reservationId,
    method: payment.method,
    methodLabel: PAYMENT_METHOD_LABEL[payment.method] ?? payment.method,
    amount: Number(payment.amount),
    status: payment.status,
    statusLabel: PAYMENT_STATUS_LABEL[payment.status] ?? payment.status,
    paidAt: payment.paidAt,
    cancelledAt: payment.cancelledAt,
    refundedAt: payment.refundedAt,
    refundOfId: payment.refundOfId,
    notes: payment.notes,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

function sumByType(
  charges: FolioCharge[],
  predicate: (charge: FolioCharge) => boolean,
): number {
  return Number(
    charges
      .filter(predicate)
      .reduce((sum, c) => sum + Number(c.amount), 0)
      .toFixed(2),
  );
}

export function presentReservation(reservation: ReservationFull) {
  const plannedNights = nightsBetween(
    reservation.checkInDate,
    reservation.checkOutDate,
  );
  const nightlyRate = Number(reservation.nightlyRate);
  const maxRoomTotal = roomChargeAmount(plannedNights, nightlyRate);
  const bill = buildBill(reservation);
  const billedNights = billedRoomNightsFromCharges(
    reservation.charges ?? [],
    nightlyRate,
  );
  const roomTotal = bill.roomNights;
  const diariasLabel =
    billedNights > 0
      ? billedNights === 1
        ? "1 diária"
        : `${billedNights} diárias`
      : plannedNights === 1
        ? "1 diária"
        : `${plannedNights} diárias`;
  const pricingSummary =
    billedNights > 0
      ? `${diariasLabel} × ${formatBRL(nightlyRate)} = ${formatBRL(roomTotal)}`
      : `até ${plannedNights === 1 ? "1 diária" : `${plannedNights} diárias`} × ${formatBRL(nightlyRate)} = ${formatBRL(maxRoomTotal)}`;

  const charges = reservation.charges ?? [];
  const payments = reservation.payments ?? [];
  const roomSelection = parseRoomSelection(reservation.roomSelection);

  const roomPresented = reservation.room
    ? presentRoom(reservation.room)
    : null;

  const roomLabel =
    roomSelection.length > 1
      ? roomSelection
          .map((entry) => `Quarto ${entry.roomNumber} (${entry.roomTypeName})`)
          .join(" + ")
      : roomPresented
        ? `Quarto ${roomPresented.number} — ${roomPresented.type.name}`
        : `Tipo ${reservation.roomType.name}`;

  return {
    id: reservation.id,
    code: reservation.code,
    hotelId: reservation.hotelId,
    guest: {
      id: reservation.guest.id,
      name: reservation.guest.name,
      phone: reservation.guest.phone,
      cpf: reservation.guest.cpf,
      email: reservation.guest.email,
    },
    roomType: presentRoomType(reservation.roomType),
    room: roomPresented,
    roomSelection,
    guests: reservation.guests,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    periodLabel: `${formatDateBR(reservation.checkInDate)} → ${formatDateBR(reservation.checkOutDate)}`,
    nights: plannedNights,
    plannedNights,
    billedNights,
    nightlyRate,
    roomTotal,
    maxRoomTotal,
    pricingSummary,
    label: `${roomLabel}\n${formatDateBR(reservation.checkInDate)} → ${formatDateBR(reservation.checkOutDate)}\n${pricingSummary}`,
    status: reservation.status,
    statusLabel: RESERVATION_STATUS_LABEL[reservation.status] ?? reservation.status,
    notes: reservation.notes,
    checkedInAt: reservation.checkedInAt,
    checkedOutAt: reservation.checkedOutAt,
    charges,
    payments: payments.map(presentPayment),
    bill,
    totalCharges: bill.total,
    totalPayments: bill.paid,
    balance: bill.balance,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

function formatAddress(guest: Guest): string | null {
  const parts = [
    guest.street
      ? `${guest.street}${guest.number ? `, ${guest.number}` : ""}`
      : null,
    guest.complement,
    guest.neighborhood,
    guest.city && guest.state ? `${guest.city}/${guest.state}` : guest.city,
    guest.zipCode
      ? guest.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2")
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" — ") : null;
}

type GuestWithHistory = Guest & {
  reservations?: Array<
    Reservation & {
      roomType: RoomType;
      room: (Room & { roomType: RoomType }) | null;
      charges?: FolioCharge[];
      payments?: Payment[];
    }
  >;
};

export function presentGuest(guest: GuestWithHistory) {
  const stays = (guest.reservations ?? []).map((reservation) =>
    presentReservation({
      ...reservation,
      guest,
    }),
  );

  return {
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    cpf: guest.cpf,
    email: guest.email,
    address: {
      street: guest.street,
      number: guest.number,
      complement: guest.complement,
      neighborhood: guest.neighborhood,
      city: guest.city,
      state: guest.state,
      zipCode: guest.zipCode,
      formatted: formatAddress(guest),
    },
    stayHistory: stays,
    staysCount: stays.length,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt,
  };
}
