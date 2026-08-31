import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { guestsRouter } from "./routes/guests.js";
import { housekeepingRouter } from "./routes/housekeeping.js";
import {
  paymentActionsRouter,
  paymentsRouter,
} from "./routes/payments.js";
import {
  availabilityRouter,
  reservationsRouter,
} from "./routes/reservations.js";
import { roomTypesRouter } from "./routes/roomTypes.js";
import { roomsRouter } from "./routes/rooms.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hospeda-api" });
  });

  app.use("/room-types", roomTypesRouter);
  app.use("/rooms", roomsRouter);
  app.use("/guests", guestsRouter);
  app.use("/reservations", reservationsRouter);
  app.use("/reservations/:reservationId/payments", paymentsRouter);
  app.use("/payments", paymentActionsRouter);
  app.use("/availability", availabilityRouter);
  app.use("/housekeeping", housekeepingRouter);
  app.use("/dashboard", dashboardRouter);

  app.use(errorHandler);

  return app;
}
