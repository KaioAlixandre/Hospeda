import { hasFeature } from "../lib/plans.js";
import {
  presentPublicAvailabilityOption,
  presentPublicHotel,
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
    guest: {
      name: string;
      phone: string;
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
  const phoneDigits = input.guest.phone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    throw new AppError(400, "Telefone inválido");
  }

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
      phone: { contains: phoneDigits.slice(-11) },
    },
  });

  if (!guest) {
    guest = await prisma.guest.create({
      data: {
        hotelId: hotel.id,
        name: input.guest.name.trim(),
        phone: phoneDigits,
        email: input.guest.email?.trim() || null,
        city: input.guest.city?.trim() || null,
        cpf: null,
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
