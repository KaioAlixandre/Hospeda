import { Router } from "express";
import { presentGuest } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import { createGuestSchema, updateGuestSchema } from "../validators/schemas.js";

export const guestsRouter = Router();

const guestInclude = {
  reservations: {
    orderBy: { checkInDate: "desc" as const },
    include: {
      roomType: true,
      room: { include: { roomType: true } },
      charges: true,
      payments: true,
    },
  },
};

guestsRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const digits = q?.replace(/\D/g, "");

    const guests = await prisma.guest.findMany({
      where: {
        hotelId,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { phone: { contains: q } },
                ...(digits ? [{ cpf: { contains: digits } }] : []),
                { email: { contains: q } },
                { city: { contains: q } },
              ],
            }
          : {}),
      },
      include: guestInclude,
      orderBy: { name: "asc" },
    });
    res.json(guests.map(presentGuest));
  } catch (err) {
    next(err);
  }
});

guestsRouter.get("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, hotelId },
      include: guestInclude,
    });
    if (!guest) throw new AppError(404, "Guest not found");
    res.json(presentGuest(guest));
  } catch (err) {
    next(err);
  }
});

guestsRouter.get("/:id/stays", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, hotelId },
      include: guestInclude,
    });
    if (!guest) throw new AppError(404, "Guest not found");
    const presented = presentGuest(guest);
    res.json({
      guestId: guest.id,
      name: guest.name,
      staysCount: presented.staysCount,
      stays: presented.stayHistory,
    });
  } catch (err) {
    next(err);
  }
});

guestsRouter.post("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createGuestSchema.parse(req.body);
    const guest = await prisma.guest.create({
      data: { ...data, hotelId },
      include: guestInclude,
    });
    res.status(201).json(presentGuest(guest));
  } catch (err) {
    next(err);
  }
});

guestsRouter.patch("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.guest.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!existing) throw new AppError(404, "Guest not found");

    const data = updateGuestSchema.parse(req.body);
    const guest = await prisma.guest.update({
      where: { id: existing.id },
      data,
      include: guestInclude,
    });
    res.json(presentGuest(guest));
  } catch (err) {
    next(err);
  }
});

guestsRouter.delete("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const guest = await prisma.guest.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!guest) throw new AppError(404, "Guest not found");

    const active = await prisma.reservation.count({
      where: {
        hotelId,
        guestId: guest.id,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (active > 0) {
      throw new AppError(
        409,
        "Não é possível excluir hóspede com reservas ativas (pendentes ou confirmadas).",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.reservation.deleteMany({
        where: { hotelId, guestId: guest.id },
      });
      await tx.guest.delete({ where: { id: guest.id } });
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
