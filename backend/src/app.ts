import cors from "cors";
import express from "express";
import helmet from "helmet";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  apiLimiter,
  authLimiter,
  buildCorsOptions,
  trustProxySetting,
} from "./middleware/security.js";
import { adminLimiter, adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { billingWebhookRouter } from "./routes/billingWebhook.js";
import { catalogRouter } from "./routes/catalog.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { guestsRouter } from "./routes/guests.js";
import { housekeepingRouter } from "./routes/housekeeping.js";
import {
  paymentActionsRouter,
  paymentsRouter,
} from "./routes/payments.js";
import { publicRouter } from "./routes/public.js";
import {
  availabilityRouter,
  reservationsRouter,
} from "./routes/reservations.js";
import { roomTypesRouter } from "./routes/roomTypes.js";
import { roomsRouter } from "./routes/rooms.js";
import { uploadsRouter } from "./routes/uploads.js";
import { whatsappRouter } from "./routes/whatsapp.js";

export function createApp() {
  const app = express();

  app.set("trust proxy", trustProxySetting());

  app.use(helmet());
  app.use(cors(buildCorsOptions()));

  // Webhook Stripe precisa do body bruto (antes do express.json).
  app.use(
    "/billing/webhook",
    express.raw({ type: "application/json" }),
    billingWebhookRouter,
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "hospeda-api" });
  });

  app.use(apiLimiter);

  app.use("/admin", adminLimiter, adminRouter);
  app.use("/public", publicRouter);

  app.use("/auth/login", authLimiter);
  app.use("/auth/register", authLimiter);
  app.use("/auth", authRouter);

  app.use(requireAuth);

  app.use("/billing", billingRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/whatsapp", whatsappRouter);
  app.use("/catalog", catalogRouter);
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
