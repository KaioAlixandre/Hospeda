import { Prisma } from "../generated/prisma/client.js";
import {
  buildBill,
  computeBillableRoomNights,
  nightsBetween,
  presentAvailabilityOption,
  presentReservation,
  roomChargeAmount,
  roomChargeDescription,
} from "../lib/presenters.js";
import {
  allocateGuests,
  buildAvailabilityOptions,
  getBlockedRoomIds,
  parseRoomSelection,
  reservationRoomIds,
  selectionKey,
} from "../lib/roomSelection.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  notifyReservationConfirmed,
  notifyZeladoresRoomCleaning,
  type MessageNotification,
} from "./messaging.js";

type PresentedReservation = ReturnType<typeof presentReservation>;

async function withConfirmationMessage<T extends PresentedReservation>(
  presented: T,
): Promise<T & { notification: MessageNotification }> {
  const notification = await notifyReservationConfirmed(presented);
  return { ...presented, notification };
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function reservationCode(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HSP-${stamp}-${rand}`;
}

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

async function loadReservation(hotelId: string, id: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id, hotelId },
    include: {
      guest: true,
      roomType: true,
      room: { include: { roomType: true } },
      charges: { orderBy: { postedAt: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!reservation) throw new AppError(404, "Reservation not found");
  return reservation;
}

type ReservationWithFolio = Awaited<ReturnType<typeof loadReservation>>;

/** Atualiza a cobrança de diárias conforme os dias da estadia. */
async function syncRoomCharges(
  reservation: ReservationWithFolio,
  asOf: Date = new Date(),
  checkedOutAtOverride?: Date,
) {
  if (!reservation.checkedInAt) return reservation;

  const effectiveReservation = checkedOutAtOverride
    ? { ...reservation, checkedOutAt: checkedOutAtOverride }
    : reservation;

  const nightlyRate = Number(reservation.nightlyRate);
  const billableNights = computeBillableRoomNights(effectiveReservation, asOf);
  const amount = roomChargeAmount(billableNights, nightlyRate);
  const description = roomChargeDescription(billableNights, nightlyRate);

  const roomCharges = reservation.charges.filter((c) => c.type === "ROOM");
  const primaryCharge = roomCharges[0];

  await prisma.$transaction(async (tx) => {
    if (primaryCharge) {
      await tx.folioCharge.update({
        where: { id: primaryCharge.id },
        data: { description, amount },
      });
      for (const extra of roomCharges.slice(1)) {
        await tx.folioCharge.delete({ where: { id: extra.id } });
      }
    } else {
      await tx.folioCharge.create({
        data: {
          reservationId: reservation.id,
          type: "ROOM",
          description,
          amount,
        },
      });
    }
  });

  return loadReservation(reservation.hotelId, reservation.id);
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function setRoomsStatus(
  roomIds: string[],
  status: "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLEANING",
  tx: TxClient,
) {
  for (const roomId of roomIds) {
    await tx.room.update({
      where: { id: roomId },
      data: { status },
    });
  }
}

/**
 * Marca como RESERVED sem atropelar a situação de hoje: quarto ocupado,
 * em limpeza ou em manutenção mantém o status atual, porque a reserva
 * confirmada pode ser para um período futuro.
 */
async function holdRooms(roomIds: string[], tx: TxClient) {
  for (const roomId of roomIds) {
    await tx.room.updateMany({
      where: {
        id: roomId,
        status: { notIn: ["OCCUPIED", "CLEANING", "MAINTENANCE"] },
      },
      data: { status: "RESERVED" },
    });
  }
}

/**
 * Devolve o quarto ao status correto ao soltar uma reserva. Cancelar uma
 * reserva futura não pode liberar o quarto de quem está hospedado.
 */
async function releaseRooms(
  hotelId: string,
  roomIds: string[],
  excludeReservationId: string,
  tx: TxClient,
) {
  if (roomIds.length === 0) return;

  const now = new Date();
  const others = await tx.reservation.findMany({
    where: {
      hotelId,
      id: { not: excludeReservationId },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: {
      roomId: true,
      roomSelection: true,
      status: true,
      checkedInAt: true,
      checkedOutAt: true,
      checkInDate: true,
      checkOutDate: true,
    },
  });

  for (const roomId of roomIds) {
    const holders = others.filter((reservation) =>
      reservationRoomIds(reservation).includes(roomId),
    );

    // Alguém hospedado no quarto: continua OCCUPIED.
    if (holders.some((r) => r.checkedInAt && !r.checkedOutAt)) continue;

    // Reserva confirmada cobrindo hoje: continua RESERVED.
    const heldToday = holders.some(
      (r) =>
        r.status === "CONFIRMED" &&
        r.checkInDate <= now &&
        r.checkOutDate > now,
    );

    await tx.room.update({
      where: { id: roomId },
      data: { status: heldToday ? "RESERVED" : "AVAILABLE" },
    });
  }
}

/**
 * Verifica quartos disponíveis e monta opções:
 * quartos individuais ou combinações para a quantidade de hóspedes.
 */
export async function findAvailableRooms(params: {
  hotelId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
}) {
  const checkIn = toDateOnly(params.checkInDate);
  const checkOut = toDateOnly(params.checkOutDate);

  if (checkOut <= checkIn) {
    throw new AppError(400, "checkOutDate must be after checkInDate");
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    throw new AppError(400, "Stay must be at least 1 night");
  }

  const blockedRoomIds = await getBlockedRoomIds(
    params.hotelId,
    checkIn,
    checkOut,
  );

  const rooms = await prisma.room.findMany({
    where: {
      hotelId: params.hotelId,
      // Quem decide a disponibilidade são as datas (getBlockedRoomIds), não o
      // status atual do quarto. Só MAINTENANCE sai da lista: é quarto fora de operação.
      status: { not: "MAINTENANCE" },
      ...(blockedRoomIds.size > 0
        ? { id: { notIn: [...blockedRoomIds] } }
        : {}),
    },
    include: { roomType: true },
    orderBy: { number: "asc" },
  });

  const { options, availableCount } = buildAvailabilityOptions(
    rooms,
    params.checkInDate,
    params.checkOutDate,
    params.guests,
  );

  return {
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    guests: params.guests,
    nights,
    availableCount,
    options,
  };
}

async function lockRooms(roomIds: string[], tx: TxClient) {
  if (roomIds.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM Room WHERE id IN (${Prisma.join(roomIds)}) FOR UPDATE
  `;
}

export async function createReservation(input: {
  hotelId: string;
  guestId: string;
  roomIds: string[];
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nightlyRate?: number;
  notes?: string;
  status?: "PENDING" | "CONFIRMED";
  source?: "DESK" | "ONLINE";
  expiresAt?: Date | null;
}) {
  const checkIn = toDateOnly(input.checkInDate);
  const checkOut = toDateOnly(input.checkOutDate);

  if (checkOut <= checkIn) {
    throw new AppError(400, "checkOutDate must be after checkInDate");
  }

  const guest = await prisma.guest.findFirst({
    where: { id: input.guestId, hotelId: input.hotelId },
  });
  if (!guest) throw new AppError(404, "Guest not found");

  const availability = await findAvailableRooms({
    hotelId: input.hotelId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    guests: input.guests,
  });

  if (availability.availableCount === 0) {
    throw new AppError(409, "No rooms available for the selected dates");
  }

  const selectedOption = availability.options.find(
    (option) => selectionKey(option.roomIds) === selectionKey(input.roomIds),
  );
  if (!selectedOption) {
    throw new AppError(409, "Selected rooms are not available for these dates");
  }

  const roomSelection = allocateGuests(selectedOption.rooms, input.guests);
  const nightlyRate = input.nightlyRate ?? selectedOption.totalNightlyRate;
  const primaryRoom = selectedOption.rooms[0]!;
  const status = input.status ?? "PENDING";
  const source = input.source ?? "DESK";

  const created = await prisma.$transaction(async (tx) => {
    await lockRooms(input.roomIds, tx);

    const overlapping = await tx.reservation.findMany({
      where: {
        hotelId: input.hotelId,
        status: { in: ["PENDING", "CONFIRMED"] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true, roomSelection: true },
    });
    const blocked = new Set<string>();
    for (const row of overlapping) {
      for (const id of reservationRoomIds(row)) blocked.add(id);
    }
    for (const roomId of input.roomIds) {
      if (blocked.has(roomId)) {
        throw new AppError(409, "Room already reserved for overlapping dates");
      }
    }

    if (status === "CONFIRMED") {
      await holdRooms(input.roomIds, tx);
    }

    return tx.reservation.create({
      data: {
        hotelId: input.hotelId,
        code: reservationCode(),
        guestId: input.guestId,
        roomTypeId: primaryRoom.room.type.id,
        roomId: primaryRoom.room.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests: input.guests,
        status,
        source,
        expiresAt: input.expiresAt ?? null,
        nightlyRate,
        roomSelection,
        notes: input.notes,
      },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  const presented = presentReservation(created);
  if (status === "CONFIRMED") {
    return withConfirmationMessage(presented);
  }
  return presented;
}

export async function confirmReservation(
  hotelId: string,
  reservationId: string,
  input: { roomId?: string } = {},
) {
  const reservation = await loadReservation(hotelId, reservationId);
  if (reservation.status !== "PENDING") {
    throw new AppError(400, "Only pending reservations can be confirmed");
  }

  const selectedRooms = parseRoomSelection(reservation.roomSelection);
  const roomIds =
    selectedRooms.length > 0
      ? selectedRooms.map((entry) => entry.roomId)
      : reservation.roomId
        ? [reservation.roomId]
        : input.roomId
          ? [input.roomId]
          : [];

  if (roomIds.length === 0) {
    throw new AppError(400, "No rooms assigned to this reservation");
  }

  if (input.roomId && !roomIds.includes(input.roomId)) {
    throw new AppError(400, "Room is not part of this reservation");
  }

  const previousStatuses = new Map<string, string>();

  for (const roomId of roomIds) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room) throw new AppError(404, "Room not found");
    previousStatuses.set(roomId, room.status);

    // Ocupado ou em limpeza é a situação de hoje e não impede confirmar uma
    // reserva para outro período — a sobreposição de datas é checada abaixo.
    if (room.status === "MAINTENANCE") {
      throw new AppError(409, `Room cannot be reserved (status: ${room.status})`);
    }

    const blocked = await getBlockedRoomIds(
      hotelId,
      reservation.checkInDate,
      reservation.checkOutDate,
      reservationId,
    );
    if (blocked.has(roomId)) {
      throw new AppError(409, "Room already reserved for overlapping dates");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockRooms(roomIds, tx);
    await holdRooms(roomIds, tx);

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CONFIRMED",
        roomId: roomIds[0],
        expiresAt: null,
      },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  const presented = await withConfirmationMessage(presentReservation(updated));
  const singleRoomId = roomIds.length === 1 ? roomIds[0]! : null;
  const previousStatus = singleRoomId
    ? (previousStatuses.get(singleRoomId) ?? "AVAILABLE")
    : null;

  return {
    ...presented,
    ...(singleRoomId && previousStatus === "AVAILABLE"
      ? {
          roomStatusChange: {
            roomId: singleRoomId,
            from: "AVAILABLE" as const,
            to: "RESERVED" as const,
            fromLabel: "Disponível",
            toLabel: "Reservado",
          },
        }
      : {}),
  };
}

export async function cancelReservation(hotelId: string, reservationId: string) {
  const reservation = await loadReservation(hotelId, reservationId);
  if (!ACTIVE_STATUSES.includes(reservation.status as "PENDING" | "CONFIRMED")) {
    throw new AppError(400, `Cannot cancel reservation with status ${reservation.status}`);
  }
  if (reservation.checkedInAt) {
    throw new AppError(400, "Cannot cancel after check-in; use check-out instead");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const roomIds = reservationRoomIds(reservation);
    if (roomIds.length > 0) {
      await releaseRooms(hotelId, roomIds, reservationId, tx);
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: { status: "CANCELLED" },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  return presentReservation(updated);
}

export async function checkInReservation(
  hotelId: string,
  reservationId: string,
  input: { roomId?: string; confirm?: boolean } = {},
) {
  let reservation = await loadReservation(hotelId, reservationId);

  if (reservation.checkedInAt) {
    throw new AppError(400, "Reservation already checked in");
  }

  if (["CANCELLED", "COMPLETED"].includes(reservation.status)) {
    throw new AppError(400, `Cannot check in reservation with status ${reservation.status}`);
  }

  // Na chegada: confirma a reserva (se ainda pendente) e registra o check-in
  let confirmationNotice: MessageNotification | undefined;
  if (reservation.status === "PENDING") {
    if (input.confirm === false) {
      throw new AppError(400, "Reservation must be confirmed before check-in");
    }
    const confirmed = await confirmReservation(hotelId, reservationId, {
      roomId: input.roomId ?? reservation.roomId ?? undefined,
    });
    confirmationNotice = confirmed.notification;
    reservation = await loadReservation(hotelId, reservationId);
  }

  const roomIds = reservationRoomIds(reservation);
  if (roomIds.length === 0) {
    throw new AppError(400, "No rooms assigned to this reservation");
  }

  const rooms = await Promise.all(
    roomIds.map((roomId) =>
      prisma.room.findUnique({
        where: { id: roomId },
        include: { roomType: true },
      }),
    ),
  );

  if (rooms.some((room) => !room)) {
    throw new AppError(404, "Room not found");
  }

  const totalCapacity = rooms.reduce(
    (sum, room) => sum + (room!.capacity ?? room!.roomType.capacity),
    0,
  );
  if (totalCapacity < reservation.guests) {
    throw new AppError(
      400,
      "Combined room capacity is insufficient for the number of guests",
    );
  }

  for (const room of rooms) {
    if (room!.status === "OCCUPIED") {
      throw new AppError(409, "Room is already occupied");
    }
    if (room!.status === "MAINTENANCE") {
      throw new AppError(409, "Room is under maintenance");
    }
    if (room!.status === "CLEANING") {
      throw new AppError(409, "Room is still being cleaned");
    }
    if (!["RESERVED", "AVAILABLE"].includes(room!.status)) {
      throw new AppError(409, `Room cannot be checked in from status ${room!.status}`);
    }
  }

  const blocked = await getBlockedRoomIds(
    hotelId,
    reservation.checkInDate,
    reservation.checkOutDate,
    reservationId,
  );
  for (const roomId of roomIds) {
    if (blocked.has(roomId)) {
      throw new AppError(409, "Room already reserved for overlapping dates");
    }
  }

  const previousRoomStatus = rooms[0]!.status;

  const updated = await prisma.$transaction(async (tx) => {
    await setRoomsStatus(roomIds, "OCCUPIED", tx);

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CONFIRMED",
        roomId: roomIds[0],
        checkedInAt: new Date(),
      },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  const synced = await syncRoomCharges(updated);

  return {
    ...presentReservation(synced),
    ...(confirmationNotice ? { notification: confirmationNotice } : {}),
    roomStatusChange: {
      roomId: roomIds[0]!,
      from: previousRoomStatus,
      to: "OCCUPIED" as const,
      fromLabel:
        previousRoomStatus === "RESERVED"
          ? "Reservado"
          : previousRoomStatus === "AVAILABLE"
            ? "Disponível"
            : previousRoomStatus === "CLEANING"
              ? "Limpeza"
              : previousRoomStatus,
      toLabel: "Ocupado",
    },
  };
}


export async function checkOutReservation(
  hotelId: string,
  reservationId: string,
  input: {
    payment?: {
      method: "PIX" | "CARD" | "CASH";
      amount: number;
      notes?: string;
      status?: "PENDING" | "CONFIRMED";
    };
  } = {},
) {
  const reservation = await loadReservation(hotelId, reservationId);

  if (reservation.status !== "CONFIRMED" || !reservation.checkedInAt) {
    throw new AppError(400, "Only checked-in confirmed reservations can be checked out");
  }

  let working = reservation;

  // Na saída: pode quitar o saldo no mesmo passo
  if (input.payment) {
    await prisma.payment.create({
      data: {
        reservationId,
        method: input.payment.method,
        amount: input.payment.amount,
        notes: input.payment.notes,
        status: "CONFIRMED",
        paidAt: new Date(),
      },
    });
    working = await loadReservation(hotelId, reservationId);
  }

  const checkoutAt = new Date();
  working = await syncRoomCharges(working, checkoutAt, checkoutAt);

  const bill = buildBill(working);
  if (bill.balance > 0) {
    throw new AppError(
      400,
      `Outstanding balance of ${bill.balance}. Pay the remaining amount before check-out`,
    );
  }

  const roomIds = reservationRoomIds(working);
  const roomId = working.roomId;
  const previousRoomStatus = working.room?.status ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    if (roomIds.length > 0) {
      await setRoomsStatus(roomIds, "CLEANING", tx);
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "COMPLETED",
        checkedOutAt: checkoutAt,
      },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  const synced = await loadReservation(hotelId, reservationId);

  const checkoutRoomIds = reservationRoomIds(synced);
  const cleaningRooms = await prisma.room.findMany({
    where: { id: { in: checkoutRoomIds }, hotelId },
    include: { roomType: true },
    orderBy: { number: "asc" },
  });

  const cleaningNotification =
    cleaningRooms.length > 0
      ? await notifyZeladoresRoomCleaning(
          hotelId,
          cleaningRooms.map((room) => ({
            number: room.number,
            floor: room.floor,
            roomType: { name: room.roomType.name },
          })),
        )
      : undefined;

  return {
    ...presentReservation(synced),
    bill: buildBill(synced),
    ...(cleaningNotification ? { notification: cleaningNotification } : {}),
    roomStatusChange: roomId
      ? {
          roomId,
          from: previousRoomStatus ?? "OCCUPIED",
          to: "CLEANING" as const,
          fromLabel: "Ocupado",
          toLabel: "Limpeza",
        }
      : null,
  };
}

/** Prorroga a data de saída de uma reserva hospedada, se os quartos estiverem livres. */
export async function extendStayReservation(
  hotelId: string,
  reservationId: string,
  input: { checkOutDate: string },
) {
  const reservation = await loadReservation(hotelId, reservationId);

  if (
    reservation.status !== "CONFIRMED" ||
    !reservation.checkedInAt ||
    reservation.checkedOutAt
  ) {
    throw new AppError(400, "Only in-house reservations can be extended");
  }

  const roomIds = reservationRoomIds(reservation);
  if (roomIds.length === 0) {
    throw new AppError(400, "Reservation has no assigned rooms");
  }

  const checkInStr = reservation.checkInDate.toISOString().slice(0, 10);
  const currentOutStr = reservation.checkOutDate.toISOString().slice(0, 10);
  const checkIn = toDateOnly(checkInStr);
  const currentOut = toDateOnly(currentOutStr);
  const newOut = toDateOnly(input.checkOutDate);

  if (newOut <= currentOut) {
    throw new AppError(
      400,
      "New check-out date must be after the current check-out date",
    );
  }

  if (newOut <= checkIn) {
    throw new AppError(400, "checkOutDate must be after checkInDate");
  }

  const blocked = await getBlockedRoomIds(
    hotelId,
    checkIn,
    newOut,
    reservationId,
  );
  const conflicted = roomIds.filter((roomId) => blocked.has(roomId));
  if (conflicted.length > 0) {
    const rooms = await prisma.room.findMany({
      where: { id: { in: conflicted }, hotelId },
      select: { number: true },
      orderBy: { number: "asc" },
    });
    const numbers = rooms.map((room) => room.number).join(", ");
    throw new AppError(
      409,
      numbers
        ? `Room(s) ${numbers} not available for the extended dates`
        : "One or more rooms are not available for the extended dates",
    );
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { checkOutDate: newOut },
  });

  const synced = await syncRoomCharges(
    await loadReservation(hotelId, reservationId),
  );
  return presentReservation(synced);
}


export async function listReservations(hotelId: string, status?: string) {
  const reservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      guest: true,
      roomType: true,
      room: { include: { roomType: true } },
      charges: { orderBy: { postedAt: "asc" } },
      payments: { orderBy: { paidAt: "asc" } },
    },
    orderBy: { checkInDate: "asc" },
  });

  const prepared = await Promise.all(
    reservations.map(async (reservation) => {
      if (reservation.checkedInAt && !reservation.checkedOutAt) {
        return syncRoomCharges(reservation);
      }
      return reservation;
    }),
  );

  return prepared.map(presentReservation);
}

export async function getFolio(hotelId: string, reservationId: string) {
  let reservation = await loadReservation(hotelId, reservationId);
  if (reservation.checkedInAt && !reservation.checkedOutAt) {
    reservation = await syncRoomCharges(reservation);
  }
  return presentReservation(reservation);
}

export async function updateReservation(
  hotelId: string,
  reservationId: string,
  input: {
    guestId?: string;
    roomIds?: string[];
    checkInDate?: string;
    checkOutDate?: string;
    guests?: number;
    nightlyRate?: number;
    notes?: string | null;
  },
) {
  const reservation = await loadReservation(hotelId, reservationId);

  if (["CANCELLED", "COMPLETED"].includes(reservation.status)) {
    throw new AppError(400, `Cannot update reservation with status ${reservation.status}`);
  }

  const notesOnly =
    input.notes !== undefined &&
    input.guestId === undefined &&
    input.roomIds === undefined &&
    input.checkInDate === undefined &&
    input.checkOutDate === undefined &&
    input.guests === undefined &&
    input.nightlyRate === undefined;

  if (reservation.checkedInAt && !notesOnly) {
    throw new AppError(
      400,
      "After check-in only notes can be updated; use check-out to finish the stay",
    );
  }

  if (notesOnly) {
    const updated = await prisma.reservation.update({
      where: { id: reservationId },
      data: { notes: input.notes },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
    return presentReservation(updated);
  }

  const checkInDate = input.checkInDate
    ? input.checkInDate
    : reservation.checkInDate.toISOString().slice(0, 10);
  const checkOutDate = input.checkOutDate
    ? input.checkOutDate
    : reservation.checkOutDate.toISOString().slice(0, 10);
  const guests = input.guests ?? reservation.guests;
  const guestId = input.guestId ?? reservation.guestId;
  const currentRoomIds = reservationRoomIds(reservation);
  const roomIds = input.roomIds ?? currentRoomIds;

  if (roomIds.length === 0) {
    throw new AppError(400, "At least one room is required");
  }

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, hotelId },
  });
  if (!guest) throw new AppError(404, "Guest not found");

  const checkIn = toDateOnly(checkInDate);
  const checkOut = toDateOnly(checkOutDate);
  if (checkOut <= checkIn) {
    throw new AppError(400, "checkOutDate must be after checkInDate");
  }

  const blocked = await getBlockedRoomIds(
    hotelId,
    checkIn,
    checkOut,
    reservationId,
  );
  for (const roomId of roomIds) {
    if (blocked.has(roomId)) {
      throw new AppError(409, "Selected rooms are not available for these dates");
    }
  }

  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      id: { in: roomIds },
      status: { not: "MAINTENANCE" },
    },
    include: { roomType: true },
  });
  if (rooms.length !== roomIds.length) {
    throw new AppError(409, "One or more selected rooms are unavailable");
  }

  const options = rooms.map((room) =>
    presentAvailabilityOption(room, checkInDate, checkOutDate),
  );
  const roomSelection = allocateGuests(options, guests);
  const totalCapacity = options.reduce((sum, o) => sum + o.room.capacity, 0);
  if (totalCapacity < guests) {
    throw new AppError(400, "Combined room capacity is insufficient");
  }

  const nightlyRate =
    input.nightlyRate ??
    Number(
      options.reduce((sum, o) => sum + o.nightlyRate, 0).toFixed(2),
    );
  const primary = options[0]!;
  const previousIds = currentRoomIds;
  const wasConfirmed = reservation.status === "CONFIRMED";

  const updated = await prisma.$transaction(async (tx) => {
    if (wasConfirmed) {
      const released = previousIds.filter((id) => !roomIds.includes(id));
      if (released.length > 0) {
        await releaseRooms(hotelId, released, reservationId, tx);
      }
      await holdRooms(roomIds, tx);
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        guestId,
        roomTypeId: primary.room.type.id,
        roomId: primary.room.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
        nightlyRate,
        roomSelection,
        notes: input.notes === undefined ? reservation.notes : input.notes,
      },
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
    });
  });

  return presentReservation(updated);
}

export async function deleteReservation(hotelId: string, reservationId: string) {
  const reservation = await loadReservation(hotelId, reservationId);

  if (reservation.checkedInAt && !reservation.checkedOutAt) {
    throw new AppError(400, "Cannot delete an in-house reservation; use check-out");
  }

  if (reservation.status === "CONFIRMED" && !reservation.checkedOutAt) {
    throw new AppError(400, "Cancel the reservation before deleting it");
  }

  await prisma.$transaction(async (tx) => {
    await tx.reservation.delete({ where: { id: reservationId } });
  });
}

/** Cancela reservas ONLINE pendentes cujo expiresAt já passou. */
export async function expireOnlineReservations(): Promise<number> {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      source: "ONLINE",
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      hotelId: true,
      roomId: true,
      roomSelection: true,
    },
  });

  let count = 0;
  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      const roomIds = reservationRoomIds(reservation);
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: "CANCELLED", expiresAt: null },
      });
      if (roomIds.length > 0) {
        await releaseRooms(reservation.hotelId, roomIds, reservation.id, tx);
      }
    });
    count += 1;
  }
  return count;
}

