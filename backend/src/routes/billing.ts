import { Router } from "express";
import { z } from "zod";
import { isStripeConfigured } from "../lib/stripe.js";
import { hotelIdFrom } from "../middleware/auth.js";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "../lib/stripe.js";

export const billingRouter = Router();

billingRouter.get("/status", (_req, res) => {
  res.json({
    enabled: isStripeConfigured(),
    plans: {
      SIMPLES: Boolean(process.env.STRIPE_PRICE_SIMPLES?.trim()),
      PRO: Boolean(process.env.STRIPE_PRICE_PRO?.trim()),
      PLUS: Boolean(process.env.STRIPE_PRICE_PLUS?.trim()),
    },
  });
});

billingRouter.post("/checkout", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const body = z
      .object({
        plan: z.enum(["SIMPLES", "PRO", "PLUS"]),
      })
      .parse(req.body);

    const result = await createCheckoutSession({
      hotelId,
      plan: body.plan,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

billingRouter.post("/portal", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const result = await createBillingPortalSession(hotelId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
