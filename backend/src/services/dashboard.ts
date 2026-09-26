import {
  civilDateToUtcMidnight,
  hotelDayIso,
  hotelDayRange,
  addUtcDays,
} from "../lib/datetime.js";
import { prisma } from "../lib/prisma.js";
import { reconcileHotelRoomsBoard } from "./reservations.js";
import { getTopProducts } from "./topProducts.js";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const stayInclude = {
  guest: true,
  roomType: true,
  room: true,
} as const;

export async function getAdminDashboard(hotelId: string, dateIso?: string) {
  // O "hoje" do hotel é o dia civil no fuso dele, não o dia UTC do servidor.
  const dayLabel = dateIso ?? hotelDayIso();

  // Para colunas @db.Date (checkInDate/checkOutDate): meia-noite UTC do dia.
  const day = civilDateToUtcMidnight(dayLabel);

  // Para colunas de data/hora: a janela absoluta do dia no fuso do hotel.
  const { start: dayStart, end: dayEnd } = hotelDayRange(dayLabel);

  await reconcileHotelRoomsBoard(hotelId);

  // Poucas queries em paralelo para não esgotar o pool
  const [
    roomGroups,
    todayReservations,
    checkedInToday,
    checkedOutToday,
    inHouseReservations,
    paymentsToday,
    createdToday,
    cancelledToday,
    topProducts,
  ] = await Promise.all([
    prisma.room.groupBy({
      by: ["status"],
      where: { hotelId },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: {
        hotelId,
        status: { in: ["PENDING", "CONFIRMED"] },
        checkInDate: { lte: day },
        checkOutDate: { gt: day },
      },
      include: stayInclude,
      orderBy: { checkInDate: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, checkedInAt: { gte: dayStart, lt: dayEnd } },
      include: stayInclude,
      orderBy: { checkedInAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, checkedOutAt: { gte: dayStart, lt: dayEnd } },
      include: stayInclude,
      orderBy: { checkedOutAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        hotelId,
        status: "CONFIRMED",
        checkedInAt: { not: null },
        checkedOutAt: null,
      },
      include: stayInclude,
    }),
    prisma.payment.findMany({
      where: {
        reservation: { hotelId },
        OR: [
          { status: "CONFIRMED", paidAt: { gte: dayStart, lt: dayEnd } },
          { status: "REFUNDED", refundedAt: { gte: dayStart, lt: dayEnd } },
        ],
      },
    }),
    prisma.reservation.count({
      where: {
        hotelId,
        createdAt: { gte: dayStart, lt: dayEnd },
        status: { not: "CANCELLED" },
      },
    }),
    prisma.reservation.count({
      where: {
        hotelId,
        status: "CANCELLED",
        updatedAt: { gte: dayStart, lt: dayEnd },
      },
    }),
    getTopProducts(hotelId, addUtcDays(dayStart, -30), dayEnd, 8),
  ]);

  const [arrivalsToday, departuresToday] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        hotelId,
        status: { in: ["PENDING", "CONFIRMED"] },
        checkInDate: day,
        checkedInAt: null,
      },
      include: stayInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        hotelId,
        status: "CONFIRMED",
        checkOutDate: day,
        checkedInAt: { not: null },
        checkedOutAt: null,
      },
      include: stayInclude,
      orderBy: { checkOutDate: "asc" },
    }),
  ]);

  const roomStatus = {
    AVAILABLE: 0,
    OCCUPIED: 0,
    RESERVED: 0,
    CLEANING: 0,
    MAINTENANCE: 0,
  };

  for (const group of roomGroups) {
    if (group.status in roomStatus) {
      roomStatus[group.status as keyof typeof roomStatus] = group._count._all;
    }
  }

  const totalRooms = Object.values(roomStatus).reduce((sum, n) => sum + n, 0);
  const occupiedRooms = roomStatus.OCCUPIED;
  const maintenanceRooms = roomStatus.MAINTENANCE;

  const confirmedPaymentsToday = paymentsToday.filter((p) => p.status === "CONFIRMED");
  const refundsToday = paymentsToday.filter((p) => p.status === "REFUNDED");

  const revenueGross = confirmedPaymentsToday.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const revenueRefunds = refundsToday.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const revenue = Number((revenueGross - revenueRefunds).toFixed(2));

  const sellableRooms = Math.max(totalRooms - maintenanceRooms, 0);
  const occupancyRate =
    sellableRooms === 0
      ? 0
      : Number(((occupiedRooms / sellableRooms) * 100).toFixed(1));

  const guestsInHouse = inHouseReservations.reduce(
    (sum, reservation) => sum + reservation.guests,
    0,
  );

  const adrSource =
    inHouseReservations.length > 0 ? inHouseReservations : todayReservations;
  const adr =
    adrSource.length === 0
      ? 0
      : Number(
          (
            adrSource.reduce(
              (sum, reservation) => sum + Number(reservation.nightlyRate),
              0,
            ) / adrSource.length
          ).toFixed(2),
        );
  const revpar =
    sellableRooms === 0
      ? 0
      : Number(((adr * occupiedRooms) / sellableRooms).toFixed(2));

  const mapStay = (reservation: (typeof todayReservations)[number]) => ({
    id: reservation.id,
    code: reservation.code,
    guestName: reservation.guest.name,
    roomNumber: reservation.room?.number ?? null,
    roomType: reservation.roomType.name,
    guests: reservation.guests,
    status: reservation.status,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
  });

  return {
    date: dayLabel,
    cards: {
      occupancyRate: {
        label: "Taxa de ocupação",
        icon: "layers",
        tone: "teal",
        value: occupancyRate,
        formatted: `${occupancyRate.toFixed(1)} %`,
      },
      revpar: {
        label: "RevPAR",
        icon: "grid",
        tone: "teal",
        value: revpar,
        formatted: formatBRL(revpar),
      },
      revenue: {
        label: "Receitas",
        icon: "credit-card",
        tone: "teal",
        value: revenue,
        formatted: formatBRL(revenue),
      },
      newReservations: {
        label: "Novas reservas",
        icon: "calendar-days",
        tone: "teal",
        value: createdToday,
      },
      guestsInHouse: {
        label: "Nº de hóspedes",
        icon: "users",
        tone: "blue",
        value: guestsInHouse,
      },
      adr: {
        label: "Diária média",
        icon: "trending-up",
        tone: "orange",
        value: adr,
        formatted: formatBRL(adr),
      },
      checkOutsToday: {
        label: "Check-outs do dia",
        icon: "log-out",
        tone: "pink",
        value: checkedOutToday.length,
      },
      cancelledToday: {
        label: "Reservas canceladas",
        icon: "calendar-x",
        tone: "purple",
        value: cancelledToday,
      },
    },
    roomStatus,
    occupancy: {
      occupiedRooms,
      sellableRooms,
      rate: occupancyRate,
      rateLabel: `${occupancyRate}%`,
    },
    revenue: {
      gross: Number(revenueGross.toFixed(2)),
      refunds: Number(revenueRefunds.toFixed(2)),
      net: revenue,
      formatted: formatBRL(revenue),
    },
    chart: {
      label: `Movimento do dia (${dayLabel.split("-").reverse().join("/")})`,
      series: [
        { key: "new", label: "Novas", tone: "teal", value: createdToday },
        {
          key: "cancelled",
          label: "Canceladas",
          tone: "pink",
          value: cancelledToday,
        },
        {
          key: "checkIns",
          label: "Check-ins",
          tone: "orange",
          value: checkedInToday.length,
        },
      ],
    },
    today: {
      activeReservations: todayReservations.map(mapStay),
      arrivalsExpected: arrivalsToday.map(mapStay),
      departuresExpected: departuresToday.map(mapStay),
      checkIns: checkedInToday.map((reservation) => ({
        ...mapStay(reservation),
        checkedInAt: reservation.checkedInAt,
      })),
      checkOuts: checkedOutToday.map((reservation) => ({
        ...mapStay(reservation),
        checkedOutAt: reservation.checkedOutAt,
      })),
      guestsInHouse: inHouseReservations.map(mapStay),
    },
    topProducts: {
      label: "Mais vendidos (30 dias)",
      items: topProducts,
    },
  };
}
