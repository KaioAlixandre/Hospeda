import { Router } from "express";
import { handleStripeWebhook } from "../lib/stripe.js";

export const billingWebhookRouter = Router();

billingWebhookRouter.post("/", async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    const rawBody = req.body as Buffer;
    await handleStripeWebhook(
      rawBody,
      typeof signature === "string" ? signature : undefined,
    );
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});
