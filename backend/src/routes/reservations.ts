import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  availabilityQuerySchema,
  checkInSchema,
  checkOutSchema,
  confirmReservationSchema,
  createChargeSchema,
  createReservationSchema,
  extendStaySchema,
  updateChargeSchema,
  updateReservationSchema,
} from "../validators/schemas.js";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  confirmReservation,
  createReservation,
  deleteReservation,
  extendStayReservation,
  findAvailableRooms,
  getFolio,
  listReservations,
  updateReservation,
} from "../services/reservations.js";

export const reservationsRouter = Router();
export const availabilityRouter = Router();

availabilityRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const query = availabilityQuerySchema.parse(req.query);
    const result = await findAvailableRooms({ ...query, hotelId });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/", async (req, res, next) => {
  try {
    const { status } = req.query;
    const reservations = await listReservations(
      hotelIdFrom(req),
      typeof status === "string" ? status : undefined,
    );
    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/:id", async (req, res, next) => {
  try {
    const folio = await getFolio(hotelIdFrom(req), req.params.id!);
    res.json(folio);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/:id/folio", async (req, res, next) => {
  try {
    const folio = await getFolio(hotelIdFrom(req), req.params.id!);
    res.json(folio);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const data = createReservationSchema.parse(req.body);
    const reservation = await createReservation({
      ...data,
      hotelId: hotelIdFrom(req),
    });
    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.patch("/:id", async (req, res, next) => {
  try {
    const data = updateReservationSchema.parse(req.body);
    const reservation = await updateReservation(
      hotelIdFrom(req),
      req.params.id!,
      data,
    );
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteReservation(hotelIdFrom(req), req.params.id!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/confirm", async (req, res, next) => {
  try {
    const data = confirmReservationSchema.parse(req.body ?? {});
    const reservation = await confirmReservation(
      hotelIdFrom(req),
      req.params.id!,
      data,
    );
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const reservation = await cancelReservation(
      hotelIdFrom(req),
      req.params.id!,
    );
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-in", async (req, res, next) => {
  try {
    const data = checkInSchema.parse(req.body ?? {});
    const reservation = await checkInReservation(
      hotelIdFrom(req),
      req.params.id!,
      data,
    );
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/check-out", async (req, res, next) => {
  try {
    const data = checkOutSchema.parse(req.body ?? {});
    const result = await checkOutReservation(
      hotelIdFrom(req),
      req.params.id!,
      data,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.post("/:id/extend", async (req, res, next) => {
  try {
    const data = extendStaySchema.parse(req.body);
    const reservation = await extendStayReservation(
      hotelIdFrom(req),
      req.params.id!,
      data,
    );
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

const MANUAL_CHARGE_TYPES = new Set([
  "MINIBAR",
  "RESTAURANT",
  "LAUNDRY",
  "SERVICE",
  "OTHER",
  "DISCOUNT",
]);

async function loadReservationCharge(hotelId: string, reservationId: string, chargeId: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, hotelId },
  });
  if (!reservation) throw new AppError(404, "Reservation not found");

  const charge = await prisma.folioCharge.findFirst({
    where: { id: chargeId, reservationId: reservation.id },
  });
  if (!charge) throw new AppError(404, "Charge not found");

  return { reservation, charge };
}

function assertManualChargeEditable(type: string) {
  if (type === "ROOM") {
    throw new AppError(
      400,
      "Diárias automáticas não podem ser editadas ou excluídas por aqui",
    );
  }
  if (!MANUAL_CHARGE_TYPES.has(type)) {
    throw new AppError(400, "Tipo de lançamento inválido");
  }
}

reservationsRouter.post("/:id/charges", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createChargeSchema.parse(req.body);
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!reservation) throw new AppError(404, "Reservation not found");
    if (reservation.status !== "CONFIRMED") {
      throw new AppError(400, "Cannot add charges to this reservation");
    }
    if (data.type === "ROOM") {
      throw new AppError(400, "Use a diária automática da reserva para cobranças de quarto");
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

reservationsRouter.patch("/:id/charges/:chargeId", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = updateChargeSchema.parse(req.body);
    const { reservation, charge } = await loadReservationCharge(
      hotelId,
      req.params.id,
      req.params.chargeId,
    );

    if (reservation.status === "CANCELLED") {
      throw new AppError(400, "Cannot edit charges on a cancelled reservation");
    }

    assertManualChargeEditable(charge.type);
    if (data.type !== undefined) {
      assertManualChargeEditable(data.type);
    }

    const updated = await prisma.folioCharge.update({
      where: { id: charge.id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.delete("/:id/charges/:chargeId", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const { reservation, charge } = await loadReservationCharge(
      hotelId,
      req.params.id,
      req.params.chargeId,
    );

    if (reservation.status === "CANCELLED") {
      throw new AppError(400, "Cannot delete charges on a cancelled reservation");
    }

    assertManualChargeEditable(charge.type);

    await prisma.folioCharge.delete({ where: { id: charge.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
