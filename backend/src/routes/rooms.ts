import { Router } from "express";
import { presentRoom } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { createRoomSchema, updateRoomSchema } from "../validators/schemas.js";

export const roomsRouter = Router();

roomsRouter.get("/", async (req, res, next) => {
  try {
    const { status, roomTypeId } = req.query;
    const rooms = await prisma.room.findMany({
      where: {
        ...(typeof status === "string" ? { status: status as never } : {}),
        ...(typeof roomTypeId === "string" ? { roomTypeId } : {}),
      },
      include: { roomType: true },
      orderBy: { number: "asc" },
    });
    res.json(rooms.map(presentRoom));
  } catch (err) {
    next(err);
  }
});

roomsRouter.get("/:id", async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: { roomType: true },
    });
    if (!room) throw new AppError(404, "Room not found");
    res.json(presentRoom(room));
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/", async (req, res, next) => {
  try {
    const data = createRoomSchema.parse(req.body);
    const roomType = await prisma.roomType.findUnique({
      where: { id: data.roomTypeId },
    });
    if (!roomType) throw new AppError(404, "Room type not found");

    const room = await prisma.room.create({
      data: {
        number: data.number,
        floor: data.floor,
        roomTypeId: data.roomTypeId,
        capacity: data.capacity,
        dailyPrice: data.dailyPrice,
        amenities: data.amenities,
        photos: data.photos,
        status: data.status,
      },
      include: { roomType: true },
    });
    res.status(201).json(presentRoom(room));
  } catch (err) {
    next(err);
  }
});

roomsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updateRoomSchema.parse(req.body);
    if (data.roomTypeId) {
      const roomType = await prisma.roomType.findUnique({
        where: { id: data.roomTypeId },
      });
      if (!roomType) throw new AppError(404, "Room type not found");
    }

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: {
        ...(data.number !== undefined ? { number: data.number } : {}),
        ...(data.floor !== undefined ? { floor: data.floor } : {}),
        ...(data.roomTypeId !== undefined ? { roomTypeId: data.roomTypeId } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.dailyPrice !== undefined ? { dailyPrice: data.dailyPrice } : {}),
        ...(data.amenities !== undefined ? { amenities: data.amenities } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: { roomType: true },
    });
    res.json(presentRoom(room));
  } catch (err) {
    next(err);
  }
});

roomsRouter.delete("/:id", async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } });
    if (!room) throw new AppError(404, "Room not found");

    const active = await prisma.reservation.count({
      where: {
        roomId: room.id,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (active > 0) {
      throw new AppError(409, "Cannot delete room with active reservations");
    }

    await prisma.room.delete({ where: { id: room.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
