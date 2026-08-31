import { Router } from "express";
import { presentGuest } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
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
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const digits = q?.replace(/\D/g, "");

    const guests = await prisma.guest.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              ...(digits ? [{ cpf: { contains: digits } }] : []),
              { email: { contains: q } },
              { city: { contains: q } },
            ],
          }
        : undefined,
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
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
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
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
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
    const data = createGuestSchema.parse(req.body);
    const guest = await prisma.guest.create({
      data,
      include: guestInclude,
    });
    res.status(201).json(presentGuest(guest));
  } catch (err) {
    next(err);
  }
});

guestsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updateGuestSchema.parse(req.body);
    const guest = await prisma.guest.update({
      where: { id: req.params.id },
      data,
      include: guestInclude,
    });
    res.json(presentGuest(guest));
  } catch (err) {
    next(err);
  }
});
