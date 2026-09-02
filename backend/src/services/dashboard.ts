import { prisma } from "../lib/prisma.js";

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

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
  const day = dateIso
    ? new Date(`${dateIso}T00:00:00.000Z`)
    : startOfUtcDay(new Date());
  const nextDay = addUtcDays(day, 1);
  const dayLabel = day.toISOString().slice(0, 10);

  // Poucas queries em paralelo para não esgotar o pool
  const [
    roomGroups,
    todayReservations,
    checkedInToday,
    checkedOutToday,
    inHouseReservations,
    paymentsToday,
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
      where: { hotelId, checkedInAt: { gte: day, lt: nextDay } },
      include: stayInclude,
      orderBy: { checkedInAt: "asc" },
    }),
    prisma.reservation.findMany({
      where: { hotelId, checkedOutAt: { gte: day, lt: nextDay } },
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
          { status: "CONFIRMED", paidAt: { gte: day, lt: nextDay } },
          { status: "REFUNDED", refundedAt: { gte: day, lt: nextDay } },
        ],
      },
    }),
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
  const availableRooms = roomStatus.AVAILABLE;
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
      totalRooms: {
        label: "Total de quartos",
        icon: "hotel",
        value: totalRooms,
      },
      availableRooms: {
        label: "Quartos disponíveis",
        icon: "door-open",
        value: availableRooms,
      },
      occupiedRooms: {
        label: "Quartos ocupados",
        icon: "bed-double",
        value: occupiedRooms,
      },
      todayReservations: {
        label: "Reservas de hoje",
        icon: "calendar-days",
        value: todayReservations.length,
      },
      revenue: {
        label: "Faturamento",
        icon: "wallet",
        value: revenue,
        formatted: formatBRL(revenue),
      },
      guestsInHouse: {
        label: "Hóspedes hospedados",
        icon: "users",
        value: guestsInHouse,
      },
      occupancyRate: {
        label: "Taxa de ocupação",
        icon: "trending-up",
        value: occupancyRate,
        formatted: `${occupancyRate}%`,
      },
      checkInsToday: {
        label: "Check-ins do dia",
        icon: "log-in",
        value: checkedInToday.length,
      },
      checkOutsToday: {
        label: "Check-outs do dia",
        icon: "log-out",
        value: checkedOutToday.length,
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
  };
}
