import {
  buildBill,
  nightsBetween,
  presentAvailabilityOption,
  presentReservation,
} from "../lib/presenters.js";
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

async function loadReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
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

/**
 * Verifica quartos disponíveis e monta cotação:
 * Quarto 203 — Casal | 05/09 → 08/09 | 3 diárias × R$ 150 = R$ 450
 */
export async function findAvailableRooms(params: {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string;
  guests?: number;
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

  const rooms = await prisma.room.findMany({
    where: {
      status: { in: ["AVAILABLE", "CLEANING"] },
      ...(params.roomTypeId ? { roomTypeId: params.roomTypeId } : {}),
      reservations: {
        none: {
          status: { in: [...ACTIVE_STATUSES] },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
      },
    },
    include: { roomType: true },
    orderBy: { number: "asc" },
  });

  const options = rooms
    .map((room) =>
      presentAvailabilityOption(room, params.checkInDate, params.checkOutDate),
    )
    .filter((option) =>
      params.guests ? option.room.capacity >= params.guests : true,
    );

  return {
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    guests: params.guests ?? null,
    nights,
    availableCount: options.length,
    options,
  };
}

export async function createReservation(input: {
  guestId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  roomId?: string;
  nightlyRate?: number;
  notes?: string;
  status?: "PENDING" | "CONFIRMED";
}) {
  const checkIn = toDateOnly(input.checkInDate);
  const checkOut = toDateOnly(input.checkOutDate);

  if (checkOut <= checkIn) {
    throw new AppError(400, "checkOutDate must be after checkInDate");
  }

  const [guest, roomType] = await Promise.all([
    prisma.guest.findUnique({ where: { id: input.guestId } }),
    prisma.roomType.findUnique({ where: { id: input.roomTypeId } }),
  ]);

  if (!guest) throw new AppError(404, "Guest not found");
  if (!roomType) throw new AppError(404, "Room type not found");

  const availability = await findAvailableRooms({
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomTypeId: input.roomTypeId,
    guests: input.guests,
  });

  if (availability.availableCount === 0) {
    throw new AppError(409, "No rooms available for the selected dates");
  }

  if (roomType.capacity < input.guests) {
    throw new AppError(
      400,
      `Room type capacity is ${roomType.capacity}, but ${input.guests} guests were requested`,
    );
  }

  let selectedRoomId: string | undefined = input.roomId;
  let nightlyRate = input.nightlyRate;

  if (selectedRoomId) {
    const option = availability.options.find((o) => o.room.id === selectedRoomId);
    if (!option) {
      throw new AppError(409, "Selected room is not available for these dates");
    }
    nightlyRate = nightlyRate ?? option.nightlyRate;
  } else {
    const first = availability.options[0]!;
    nightlyRate = nightlyRate ?? first.nightlyRate;
  }

  const nights = nightsBetween(checkIn, checkOut);
  const roomTotal = Number((nightlyRate! * nights).toFixed(2));
  const status = input.status ?? "PENDING";

  const created = await prisma.$transaction(async (tx) => {
    if (selectedRoomId && status === "CONFIRMED") {
      await tx.room.update({
        where: { id: selectedRoomId },
        data: { status: "RESERVED" },
      });
    }

    return tx.reservation.create({
      data: {
        code: reservationCode(),
        guestId: input.guestId,
        roomTypeId: input.roomTypeId,
        roomId: selectedRoomId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests: input.guests,
        status,
        nightlyRate: nightlyRate!,
        notes: input.notes,
        charges: {
          create: {
            type: "ROOM",
            description:
              nights === 1
                ? `1 diária × R$ ${nightlyRate}`
                : `${nights} diárias × R$ ${nightlyRate}`,
            amount: roomTotal,
          },
        },
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
  reservationId: string,
  input: { roomId?: string } = {},
) {
  const reservation = await loadReservation(reservationId);
  if (reservation.status !== "PENDING") {
    throw new AppError(400, "Only pending reservations can be confirmed");
  }

  const roomId = input.roomId ?? reservation.roomId ?? undefined;

  if (roomId) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: { roomType: true },
    });
    if (!room) throw new AppError(404, "Room not found");
    if (room.roomTypeId !== reservation.roomTypeId) {
      throw new AppError(400, "Room type does not match the reservation");
    }
    if (["OCCUPIED", "MAINTENANCE"].includes(room.status)) {
      throw new AppError(409, `Room cannot be reserved (status: ${room.status})`);
    }

    const conflict = await prisma.reservation.findFirst({
      where: {
        id: { not: reservationId },
        roomId,
        status: { in: [...ACTIVE_STATUSES] },
        checkInDate: { lt: reservation.checkOutDate },
        checkOutDate: { gt: reservation.checkInDate },
      },
    });
    if (conflict) {
      throw new AppError(409, "Room already reserved for overlapping dates");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (roomId) {
      await tx.room.update({
        where: { id: roomId },
        data: { status: "RESERVED" },
      });
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CONFIRMED",
        ...(roomId ? { roomId } : {}),
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
  return {
    ...presented,
    ...(roomId
      ? {
          roomStatusChange: {
            roomId,
            from: "AVAILABLE",
            to: "RESERVED" as const,
            fromLabel: "Disponível",
            toLabel: "Reservado",
          },
        }
      : {}),
  };
}

export async function cancelReservation(reservationId: string) {
  const reservation = await loadReservation(reservationId);
  if (!ACTIVE_STATUSES.includes(reservation.status as "PENDING" | "CONFIRMED")) {
    throw new AppError(400, `Cannot cancel reservation with status ${reservation.status}`);
  }
  if (reservation.checkedInAt) {
    throw new AppError(400, "Cannot cancel after check-in; use check-out instead");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (reservation.roomId) {
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: "AVAILABLE" },
      });
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
  reservationId: string,
  input: { roomId?: string; confirm?: boolean } = {},
) {
  let reservation = await loadReservation(reservationId);

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
    const confirmed = await confirmReservation(reservationId, {
      roomId: input.roomId ?? reservation.roomId ?? undefined,
    });
    confirmationNotice = confirmed.notification;
    reservation = await loadReservation(reservationId);
  }

  const roomId = input.roomId ?? reservation.roomId ?? undefined;
  if (!roomId) {
    throw new AppError(400, "roomId is required when the reservation has no assigned room");
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { roomType: true },
  });
  if (!room) throw new AppError(404, "Room not found");
  if (room.roomTypeId !== reservation.roomTypeId) {
    throw new AppError(400, "Room type does not match the reservation");
  }

  const capacity = room.capacity ?? room.roomType.capacity;
  if (capacity < reservation.guests) {
    throw new AppError(400, "Room capacity is insufficient for the number of guests");
  }

  const previousRoomStatus = room.status;

  // Fluxo esperado: Reservado → Ocupado
  if (room.status === "OCCUPIED") {
    throw new AppError(409, "Room is already occupied");
  }
  if (room.status === "MAINTENANCE") {
    throw new AppError(409, "Room is under maintenance");
  }
  if (!["RESERVED", "AVAILABLE", "CLEANING"].includes(room.status)) {
    throw new AppError(409, `Room cannot be checked in from status ${room.status}`);
  }

  // Se a reserva já tinha outro quarto reservado, libera o anterior
  const previousAssignedRoomId =
    reservation.roomId && reservation.roomId !== roomId ? reservation.roomId : null;

  if (previousAssignedRoomId) {
    const previousRoom = await prisma.room.findUnique({
      where: { id: previousAssignedRoomId },
    });
    if (previousRoom?.status === "RESERVED") {
      // liberado na transaction abaixo
    }
  }

  const conflict = await prisma.reservation.findFirst({
    where: {
      id: { not: reservationId },
      roomId,
      status: { in: [...ACTIVE_STATUSES] },
      checkInDate: { lt: reservation.checkOutDate },
      checkOutDate: { gt: reservation.checkInDate },
    },
  });

  if (conflict) {
    throw new AppError(409, "Room already reserved for overlapping dates");
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (previousAssignedRoomId) {
      await tx.room.update({
        where: { id: previousAssignedRoomId },
        data: { status: "AVAILABLE" },
      });
    }

    // Reservado → Ocupado (também aceita Livre/Limpeza se o quarto for atribuído na hora)
    await tx.room.update({
      where: { id: roomId },
      data: { status: "OCCUPIED" },
    });

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CONFIRMED",
        roomId,
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

  return {
    ...presentReservation(updated),
    ...(confirmationNotice ? { notification: confirmationNotice } : {}),
    roomStatusChange: {
      roomId,
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
  const reservation = await loadReservation(reservationId);

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
    working = await loadReservation(reservationId);
  }

  const bill = buildBill(working);

  if (bill.balance > 0) {
    throw new AppError(
      400,
      `Outstanding balance of ${bill.balance}. Pay the remaining amount before check-out`,
    );
  }

  const roomId = working.roomId;
  const previousRoomStatus = working.room?.status ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    // Depois do pagamento: Ocupado → Limpeza
    if (roomId) {
      await tx.room.update({
        where: { id: roomId },
        data: { status: "CLEANING" },
      });
    }

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "COMPLETED",
        checkedOutAt: new Date(),
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

  const cleaningNotification =
    updated.room && roomId
      ? await notifyZeladoresRoomCleaning({
          number: updated.room.number,
          floor: updated.room.floor,
          roomType: { name: updated.room.roomType.name },
        })
      : undefined;

  return {
    ...presentReservation(updated),
    bill: buildBill(updated),
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


export async function getFolio(reservationId: string) {
  const reservation = await loadReservation(reservationId);
  return presentReservation(reservation);
}
