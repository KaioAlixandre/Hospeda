import { hasFeature } from "../lib/plans.js";
import {
  presentPublicAvailabilityOption,
  presentPublicHotel,
  presentPublicRoomTypeDetail,
  presentPublicRoomTypes,
} from "../lib/publicPresenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  notifyGuestOnlineReservationReceived,
  notifyHotelNewOnlineReservation,
} from "./messaging.js";
import { createReservation, findAvailableRooms } from "./reservations.js";

const MAX_NIGHTS = 30;
const MAX_PENDING_PER_PHONE = 3;

export async function loadPublicCatalogHotel(slug: string) {
  const hotel = await prisma.hotel.findUnique({ where: { slug } });
  if (
    !hotel ||
    !hotel.catalogEnabled ||
    !hasFeature(
      {
        plan: hotel.plan,
        planStatus: hotel.planStatus,
        planPaidUntil: hotel.planPaidUntil,
      },
      "catalog",
    )
  ) {
    throw new AppError(404, "Catálogo não encontrado");
  }
  return hotel;
}

export async function getPublicHotel(slug: string) {
  const hotel = await loadPublicCatalogHotel(slug);
  return presentPublicHotel(hotel);
}

export async function getPublicRooms(slug: string) {
  const hotel = await loadPublicCatalogHotel(slug);
  const rooms = await prisma.room.findMany({
    where: { hotelId: hotel.id, status: { not: "MAINTENANCE" } },
    include: { roomType: true },
  });
  return { rooms: presentPublicRoomTypes(rooms) };
}

export async function getPublicRoomType(
  slug: string,
  roomTypeId: string,
  params?: { checkInDate?: string; checkOutDate?: string; guests?: number },
) {
  const hotel = await loadPublicCatalogHotel(slug);
  const rooms = await prisma.room.findMany({
    where: {
      hotelId: hotel.id,
      roomTypeId,
      status: { not: "MAINTENANCE" },
    },
    include: { roomType: true },
  });

  const room = presentPublicRoomTypeDetail(rooms, roomTypeId);
  if (!room) throw new AppError(404, "Tipo de quarto não encontrado");

  let availability: {
    available: boolean;
    nights: number;
    nightlyRate: number;
    total: number;
  } | null = null;

  if (params?.checkInDate && params?.checkOutDate) {
    const avail = await getPublicAvailability(slug, {
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      guests: params.guests ?? 1,
    });
    const match = avail.options.find((o) => o.roomTypeId === roomTypeId);
    availability = match
      ? {
          available: true,
          nights: match.nights,
          nightlyRate: match.nightlyRate,
          total: match.total,
        }
      : {
          available: false,
          nights: avail.nights,
          nightlyRate: room.priceFrom,
          total: Number((room.priceFrom * avail.nights).toFixed(2)),
        };
  }

  return { room, availability };
}

export async function getPublicAvailability(
  slug: string,
  params: { checkInDate: string; checkOutDate: string; guests: number },
) {
  const hotel = await loadPublicCatalogHotel(slug);
  const checkIn = new Date(`${params.checkInDate}T00:00:00.000Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (checkIn < today) {
    throw new AppError(400, "Check-in não pode ser no passado");
  }

  const availability = await findAvailableRooms({
    hotelId: hotel.id,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    guests: params.guests,
  });

  if (availability.nights > MAX_NIGHTS) {
    throw new AppError(400, `Estadia máxima de ${MAX_NIGHTS} noites`);
  }

  const byType = new Map<
    string,
    ReturnType<typeof presentPublicAvailabilityOption>
  >();
  for (const option of availability.options) {
    if (option.roomIds.length !== 1) continue;
    const presented = presentPublicAvailabilityOption(option);
    const existing = byType.get(presented.roomTypeId);
    if (!existing || presented.nightlyRate < existing.nightlyRate) {
      byType.set(presented.roomTypeId, presented);
    }
  }

  return {
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    guests: params.guests,
    nights: availability.nights,
    options: [...byType.values()],
  };
}

export async function createPublicReservation(
  slug: string,
  input: {
    checkInDate: string;
    checkOutDate: string;
    guests: number;
    roomTypeId: string;
    catalogUser: {
      id: string;
      email: string;
      name: string;
      phone: string | null;
    };
    guest?: {
      name?: string;
      phone?: string;
      email?: string;
      city?: string;
    };
    notes?: string;
    honeypot?: string;
  },
) {
  if (input.honeypot) {
    return {
      code: "HSP-OK",
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      total: 0,
      hotel: { name: "Hotel", phone: "" },
    };
  }

  const hotel = await loadPublicCatalogHotel(slug);
  const guestName = (input.guest?.name ?? input.catalogUser.name).trim();
  const phoneDigits = (
    input.guest?.phone ??
    input.catalogUser.phone ??
    ""
  ).replace(/\D/g, "");
  if (!guestName) {
    throw new AppError(400, "Informe o nome completo");
  }
  if (phoneDigits.length < 10) {
    throw new AppError(400, "Informe um WhatsApp válido");
  }

  if (!input.catalogUser.phone || input.catalogUser.phone !== phoneDigits) {
    await prisma.catalogUser.update({
      where: { id: input.catalogUser.id },
      data: {
        phone: phoneDigits,
        name: guestName,
      },
    });
  }

  const guestEmail =
    input.guest?.email?.trim() || input.catalogUser.email || null;

  const availability = await getPublicAvailability(slug, {
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guests: input.guests,
  });

  const option = availability.options.find(
    (o) => o.roomTypeId === input.roomTypeId,
  );
  if (!option) {
    throw new AppError(409, "Tipo de quarto indisponível para estas datas");
  }

  const fullAvailability = await findAvailableRooms({
    hotelId: hotel.id,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guests: input.guests,
  });

  const roomOption = fullAvailability.options.find(
    (o) =>
      o.roomIds.length === 1 && o.rooms[0]?.room.type.id === input.roomTypeId,
  );
  if (!roomOption) {
    throw new AppError(409, "Nenhum quarto deste tipo disponível");
  }

  const pendingCount = await prisma.reservation.count({
    where: {
      hotelId: hotel.id,
      status: "PENDING",
      source: "ONLINE",
      guest: { phone: { contains: phoneDigits.slice(-11) } },
    },
  });
  if (pendingCount >= MAX_PENDING_PER_PHONE) {
    throw new AppError(
      429,
      "Muitos pedidos pendentes para este telefone. Aguarde a confirmação do hotel.",
    );
  }

  let guest = await prisma.guest.findFirst({
    where: {
      hotelId: hotel.id,
      OR: [
        { phone: { contains: phoneDigits.slice(-11) } },
        ...(guestEmail ? [{ email: guestEmail }] : []),
      ],
    },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        hotelId: hotel.id,
        name: guestName,
        phone: phoneDigits,
        email: guestEmail,
        city: input.guest?.city?.trim() || null,
        cpf: null,
      },
    });
  } else {
    guest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        name: guestName,
        phone: phoneDigits,
        email: guestEmail ?? guest.email,
        city: input.guest?.city?.trim() || guest.city,
      },
    });
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const reservation = await createReservation({
    hotelId: hotel.id,
    guestId: guest.id,
    roomIds: roomOption.roomIds,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guests: input.guests,
    nightlyRate: roomOption.totalNightlyRate,
    notes: input.notes,
    status: "PENDING",
    source: "ONLINE",
    expiresAt,
    catalogUserId: input.catalogUser.id,
  });

  const total = Number(
    (roomOption.totalNightlyRate * availability.nights).toFixed(2),
  );

  await Promise.all([
    notifyHotelNewOnlineReservation({
      hotelId: hotel.id,
      hotelPhone: hotel.phone,
      hotelName: hotel.name,
      code: reservation.code,
      guestName: guest.name,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      roomTypeName: option.roomTypeName,
    }),
    notifyGuestOnlineReservationReceived({
      hotelId: hotel.id,
      hotelName: hotel.name,
      hotelPhone: hotel.phone,
      guestPhone: guest.phone,
      guestName: guest.name,
      code: reservation.code,
    }),
  ]);

  return {
    code: reservation.code,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    total,
    hotel: { name: hotel.name, phone: hotel.phone },
  };
}
