import { presentHousekeepingBoard, presentHousekeepingRoom } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { notifyZeladoresRoomCleaning } from "./messaging.js";
import {
  reconcileHotelRoomsBoard,
  syncRoomsBoardStatus,
} from "./reservations.js";

type RoomStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "OCCUPIED"
  | "CLEANING"
  | "MAINTENANCE";

export async function getHousekeepingBoard(
  hotelId: string,
  filter?: { status?: RoomStatus },
) {
  await reconcileHotelRoomsBoard(hotelId);
  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      ...(filter?.status ? { status: filter.status } : {}),
    },
    include: { roomType: true },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return presentHousekeepingBoard(rooms);
}

async function loadRoom(hotelId: string, roomId: string) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, hotelId },
    include: { roomType: true },
  });
  if (!room) throw new AppError(404, "Room not found");
  return room;
}

/** Limpeza concluída: Limpeza → Disponível (ou Reservado se houver pré-reserva/confirmação). */
export async function markRoomCleaned(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (room.status !== "CLEANING") {
    throw new AppError(400, "Only rooms in cleaning status can be marked as ready");
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "AVAILABLE" },
  });
  await syncRoomsBoardStatus(hotelId, [roomId]);

  const updated = await loadRoom(hotelId, roomId);
  const toLabel =
    updated.status === "RESERVED"
      ? "Reservado"
      : updated.status === "OCCUPIED"
        ? "Ocupado"
        : "Disponível";

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: "CLEANING",
      to: updated.status,
      fromLabel: "Limpeza",
      toLabel,
    },
  };
}

/** Enviar para limpeza a partir de qualquer status (exceto já em limpeza) */
export async function startRoomCleaning(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (room.status === "CLEANING") {
    throw new AppError(400, "Room is already in cleaning status");
  }

  const previous = room.status;
  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { status: "CLEANING" },
    include: { roomType: true },
  });

  const notification = await notifyZeladoresRoomCleaning(hotelId, [
    {
      number: updated.number,
      floor: updated.floor,
      roomType: { name: updated.roomType.name },
    },
  ]);

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: previous,
      to: "CLEANING",
      toLabel: "Limpeza",
    },
    notification,
  };
}

/** Colocar em manutenção */
export async function setRoomMaintenance(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (["OCCUPIED", "RESERVED"].includes(room.status)) {
    throw new AppError(
      400,
      "Cannot put occupied/reserved room into maintenance",
    );
  }

  const previous = room.status;
  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { status: "MAINTENANCE" },
    include: { roomType: true },
  });

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: previous,
      to: "MAINTENANCE",
      toLabel: "Manutenção",
    },
  };
}

/** Liberar manutenção → Disponível (ou Reservado se houver pré-reserva/confirmação). */
export async function releaseRoomMaintenance(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (room.status !== "MAINTENANCE") {
    throw new AppError(400, "Room is not in maintenance");
  }

  await prisma.room.update({
    where: { id: roomId },
    data: { status: "AVAILABLE" },
  });
  await syncRoomsBoardStatus(hotelId, [roomId]);

  const updated = await loadRoom(hotelId, roomId);
  const toLabel =
    updated.status === "RESERVED"
      ? "Reservado"
      : updated.status === "OCCUPIED"
        ? "Ocupado"
        : "Disponível";

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: "MAINTENANCE",
      to: updated.status,
      fromLabel: "Manutenção",
      toLabel,
    },
  };
}
