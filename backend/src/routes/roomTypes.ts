import { Router } from "express";
import { presentRoomType } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createRoomTypeSchema,
  updateRoomTypeSchema,
} from "../validators/schemas.js";

export const roomTypesRouter = Router();

roomTypesRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const roomTypes = await prisma.roomType.findMany({
      where: { hotelId },
      orderBy: { name: "asc" },
      include: { _count: { select: { rooms: true } } },
    });
    res.json(roomTypes.map(presentRoomType));
  } catch (err) {
    next(err);
  }
});

roomTypesRouter.get("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const roomType = await prisma.roomType.findFirst({
      where: { id: req.params.id, hotelId },
      include: { _count: { select: { rooms: true } } },
    });
    if (!roomType) throw new AppError(404, "Room type not found");
    res.json(presentRoomType(roomType));
  } catch (err) {
    next(err);
  }
});

roomTypesRouter.post("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createRoomTypeSchema.parse(req.body);
    const roomType = await prisma.roomType.create({
      data: {
        hotelId,
        name: data.name,
        description: data.description,
        capacity: data.capacity,
        basePrice: data.basePrice,
        amenities: data.amenities,
        photos: data.photos,
      },
      include: { _count: { select: { rooms: true } } },
    });
    res.status(201).json(presentRoomType(roomType));
  } catch (err) {
    next(err);
  }
});

roomTypesRouter.patch("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.roomType.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!existing) throw new AppError(404, "Room type not found");

    const data = updateRoomTypeSchema.parse(req.body);
    const roomType = await prisma.roomType.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.basePrice !== undefined ? { basePrice: data.basePrice } : {}),
        ...(data.amenities !== undefined ? { amenities: data.amenities } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
      },
      include: { _count: { select: { rooms: true } } },
    });
    res.json(presentRoomType(roomType));
  } catch (err) {
    next(err);
  }
});

roomTypesRouter.delete("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.roomType.findFirst({
      where: { id: req.params.id, hotelId },
      include: { _count: { select: { rooms: true, reservations: true } } },
    });
    if (!existing) throw new AppError(404, "Room type not found");
    if (existing._count.rooms > 0) {
      throw new AppError(409, "Cannot delete room type with rooms");
    }
    if (existing._count.reservations > 0) {
      throw new AppError(409, "Cannot delete room type with reservations");
    }

    await prisma.roomType.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
