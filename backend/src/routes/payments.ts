import { Router, type Request } from "express";
import {
  cancelPaymentSchema,
  createPaymentSchema,
  refundPaymentSchema,
} from "../validators/schemas.js";
import {
  cancelPayment,
  confirmPayment,
  createPayment,
  listPayments,
  refundPayment,
} from "../services/payments.js";

type ReservationParams = { reservationId: string };

export const paymentsRouter = Router({ mergeParams: true });

/** GET /reservations/:reservationId/payments */
paymentsRouter.get("/", async (req: Request<ReservationParams>, res, next) => {
  try {
    const result = await listPayments(req.params.reservationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /reservations/:reservationId/payments */
paymentsRouter.post("/", async (req: Request<ReservationParams>, res, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const result = await createPayment({
      reservationId: req.params.reservationId,
      ...data,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /payments/:id/confirm */
export const paymentActionsRouter = Router();

paymentActionsRouter.post("/:id/confirm", async (req, res, next) => {
  try {
    const result = await confirmPayment(req.params.id!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

paymentActionsRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    cancelPaymentSchema.parse(req.body ?? {});
    const result = await cancelPayment(req.params.id!);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

paymentActionsRouter.post("/:id/refund", async (req, res, next) => {
  try {
    const data = refundPaymentSchema.parse(req.body ?? {});
    const result = await refundPayment(req.params.id!, data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
