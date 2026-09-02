import { presentHousekeepingBoard, presentHousekeepingRoom } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { notifyZeladoresRoomCleaning } from "./messaging.js";

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

/** Limpeza concluída: Limpeza → Disponível */
export async function markRoomCleaned(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (room.status !== "CLEANING") {
    throw new AppError(400, "Only rooms in cleaning status can be marked as ready");
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { status: "AVAILABLE" },
    include: { roomType: true },
  });

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: "CLEANING",
      to: "AVAILABLE",
      fromLabel: "Limpeza",
      toLabel: "Disponível",
    },
  };
}

/** Enviar para limpeza (ex.: inspeção) */
export async function startRoomCleaning(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (!["AVAILABLE", "OCCUPIED"].includes(room.status)) {
    throw new AppError(
      400,
      `Cannot start cleaning from status ${room.status}`,
    );
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

/** Liberar manutenção → Disponível */
export async function releaseRoomMaintenance(hotelId: string, roomId: string) {
  const room = await loadRoom(hotelId, roomId);
  if (room.status !== "MAINTENANCE") {
    throw new AppError(400, "Room is not in maintenance");
  }

  const updated = await prisma.room.update({
    where: { id: roomId },
    data: { status: "AVAILABLE" },
    include: { roomType: true },
  });

  return {
    ...presentHousekeepingRoom(updated),
    statusChange: {
      from: "MAINTENANCE",
      to: "AVAILABLE",
      fromLabel: "Manutenção",
      toLabel: "Disponível",
    },
  };
}
