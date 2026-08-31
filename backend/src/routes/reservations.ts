import { Router } from "express";
import { presentReservation } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  availabilityQuerySchema,
  checkInSchema,
  checkOutSchema,
  confirmReservationSchema,
  createChargeSchema,
  createReservationSchema,
} from "../validators/schemas.js";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  createReservation,
  findAvailableRooms,
  getFolio,
} from "../services/reservations.js";

export const reservationsRouter = Router();
export const availabilityRouter = Router();

availabilityRouter.get("/", async (req, res, next) => {
  try {
    const query = availabilityQuerySchema.parse(req.query);
    const result = await findAvailableRooms(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const reservations = await prisma.reservation.findMany({
      where: typeof status === "string" ? { status: status as never } : undefined,
      include: {
        guest: true,
        roomType: true,
        room: { include: { roomType: true } },
        charges: true,
        payments: true,
      },
      orderBy: { checkInDate: "asc" },
    });
    res.json(reservations.map(presentReservation));
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/:id", async (req, res, next) => {
  try {
    const folio = await getFolio(req.params.id!);
    res.json(folio);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/:id/folio", async (req, res, next) => {
  try {
    const folio = await getFolio(req.params.id!);
    res.json(folio);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const data = createReservationSchema.parse(req.body);
    const reservation = await createReservation(data);
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/confirm", async (req, res, next) => {
  try {
    const data = confirmReservationSchema.parse(req.body ?? {});
    const reservation = await confirmReservation(req.params.id!, data);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const reservation = await cancelReservation(req.params.id!);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-in", async (req, res, next) => {
  try {
    const data = checkInSchema.parse(req.body ?? {});
    const reservation = await checkInReservation(req.params.id!, data);
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-out", async (req, res, next) => {
  try {
    const data = checkOutSchema.parse(req.body ?? {});
    const result = await checkOutReservation(req.params.id!, data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/charges", async (req, res, next) => {
  try {
    const data = createChargeSchema.parse(req.body);
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
    });
    if (!reservation) throw new AppError(404, "Reservation not found");
    if (reservation.status !== "CONFIRMED") {
      throw new AppError(400, "Cannot add charges to this reservation");
    }

    const charge = await prisma.folioCharge.create({
      data: {
        reservationId: reservation.id,
        ...data,
      },
    });
    res.status(201).json(charge);
  } catch (err) {
    next(err);
  }
});
