export type RoomStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "CLEANING"
  | "MAINTENANCE";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "COMPLETED";

export type PaymentMethod = "PIX" | "CARD" | "CASH";

export type PaymentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED";

export type ChargeType =
  | "ROOM"
  | "MINIBAR"
  | "RESTAURANT"
  | "LAUNDRY"
  | "SERVICE"
  | "OTHER"
  | "DISCOUNT";

export type RoomType = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  dailyPrice: number;
  amenities: string[];
  photos: string[];
  roomsCount?: number;
};

export type Room = {
  id: string;
  number: string;
  floor: number | null;
  type: { id: string; name: string; description: string | null };
  capacity: number;
  dailyPrice: number;
  amenities: string[];
  photos: string[];
  status: RoomStatus;
  statusLabel: string;
  statusIcon: string;
  statusColor: string;
};

export type Charge = {
  id: string;
  type: ChargeType;
  description: string;
  amount: string | number;
  postedAt: string;
};

export type Payment = {
  id: string;
  reservationId: string;
  method: PaymentMethod;
  methodLabel: string;
  amount: number;
  status: PaymentStatus;
  statusLabel: string;
  paidAt: string | null;
  refundOfId: string | null;
  notes: string | null;
  createdAt: string;
};

export type Bill = {
  roomNights: number;
  consumption: number;
  services: number;
  discounts: number;
  total: number;
  paid: number;
  pending: number;
  refunded: number;
  balance: number;
  paymentStatus: "QUITADO" | "PARCIAL" | "PENDENTE";
  formula: string;
  summary: string;
  isPaid: boolean;
};

export type MessageNotification = {
  sent: boolean;
  skipped?: "not_configured" | "no_phone" | "api_error";
  channel?: "whatsapp";
  to?: string;
  reason?: string;
};

export type BulkMessageNotification = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  recipients: MessageNotification[];
};

export type Reservation = {
  id: string;
  code: string;
  guest: {
    id: string;
    name: string;
    phone: string | null;
    cpf: string;
    email: string | null;
  };
  roomType: RoomType;
  room: Room | null;
  roomSelection: RoomSelectionEntry[];
  guests: number;
  checkInDate: string;
  checkOutDate: string;
  periodLabel: string;
  nights: number;
  plannedNights: number;
  billedNights: number;
  nightlyRate: number;
  roomTotal: number;
  maxRoomTotal: number;
  pricingSummary: string;
  status: ReservationStatus;
  statusLabel: string;
  notes: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  charges: Charge[];
  payments: Payment[];
  bill: Bill;
  balance: number;
  notification?: MessageNotification;
};

export type Guest = {
  id: string;
  name: string;
  phone: string | null;
  cpf: string;
  email: string | null;
  address: {
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    formatted: string | null;
  };
  stayHistory: Reservation[];
  staysCount: number;
};

export type RoomSelectionEntry = {
  roomId: string;
  roomTypeId: string;
  guests: number;
  nightlyRate: number;
  roomNumber: string;
  roomTypeName: string;
};

export type AvailabilityOption = {
  room: Room;
  label: string;
  periodLabel: string;
  nights: number;
  nightlyRate: number;
  total: number;
  summary: string;
};

export type AvailabilitySelection = {
  id: string;
  kind: "single" | "combination";
  rooms: AvailabilityOption[];
  roomIds: string[];
  label: string;
  description: string;
  periodLabel: string;
  nights: number;
  guests: number;
  totalCapacity: number;
  totalNightlyRate: number;
  total: number;
  summary: string;
};

export type Availability = {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  availableCount: number;
  options: AvailabilitySelection[];
};

export type HousekeepingRoom = {
  roomId: string;
  number: string;
  floor: number | null;
  type: string;
  status: RoomStatus;
  statusLabel: string;
  statusIcon: string;
  statusColor: string;
  line: string;
};

export type Zelador = {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type HousekeepingBoard = {
  summary: Record<RoomStatus, number>;
  rooms: HousekeepingRoom[];
  board: string[];
};

type MetricCard = {
  label: string;
  icon: string;
  value: number;
  formatted?: string;
};

export type StaySummary = {
  id: string;
  code: string;
  guestName: string;
  roomNumber: string | null;
  roomType: string;
  guests: number;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
};

export type Dashboard = {
  date: string;
  cards: {
    totalRooms: MetricCard;
    availableRooms: MetricCard;
    occupiedRooms: MetricCard;
    todayReservations: MetricCard;
    revenue: MetricCard;
    guestsInHouse: MetricCard;
    occupancyRate: MetricCard;
    checkInsToday: MetricCard;
    checkOutsToday: MetricCard;
  };
  roomStatus: Record<RoomStatus, number>;
  occupancy: {
    occupiedRooms: number;
    sellableRooms: number;
    rate: number;
    rateLabel: string;
  };
  revenue: { gross: number; refunds: number; net: number; formatted: string };
  today: {
    activeReservations: StaySummary[];
    arrivalsExpected: StaySummary[];
    departuresExpected: StaySummary[];
    checkIns: StaySummary[];
    checkOuts: StaySummary[];
    guestsInHouse: StaySummary[];
  };
};
