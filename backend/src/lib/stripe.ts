import Stripe from "stripe";
import type { PlanStatus } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";
import type { PlanCode } from "./plans.js";
import { AppError } from "../middleware/errorHandler.js";

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
      process.env.STRIPE_PRICE_SIMPLES?.trim() &&
      process.env.STRIPE_PRICE_PRO?.trim() &&
      process.env.STRIPE_PRICE_PLUS?.trim(),
  );
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new AppError(503, "Pagamentos por assinatura não estão configurados.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function priceIdForPlan(plan: PlanCode): string {
  const envKey =
    plan === "SIMPLES"
      ? "STRIPE_PRICE_SIMPLES"
      : plan === "PRO"
        ? "STRIPE_PRICE_PRO"
        : "STRIPE_PRICE_PLUS";
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw new AppError(
      503,
      `Preço Stripe do plano ${plan} não configurado (${envKey}).`,
    );
  }
  return priceId;
}

export function planFromPriceId(priceId: string | null | undefined): PlanCode | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_SIMPLES?.trim()) return "SIMPLES";
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return "PRO";
  if (priceId === process.env.STRIPE_PRICE_PLUS?.trim()) return "PLUS";
  return null;
}

function appReturnBase(): string {
  return (
    process.env.BILLING_RETURN_URL?.trim() ||
    process.env.CATALOG_PUBLIC_BASE_URL?.trim() ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

export async function ensureStripeCustomer(hotel: {
  id: string;
  name: string;
  phone: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (hotel.stripeCustomerId) return hotel.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: hotel.name,
    phone: hotel.phone,
    metadata: { hotelId: hotel.id },
  });

  await prisma.hotel.update({
    where: { id: hotel.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(input: {
  hotelId: string;
  plan: PlanCode;
}): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new AppError(503, "Pagamentos por assinatura não estão configurados.");
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: input.hotelId } });
  if (!hotel) throw new AppError(404, "Hotel not found");

  const customerId = await ensureStripeCustomer(hotel);
  const priceId = priceIdForPlan(input.plan);
  const base = appReturnBase();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/billing/cancel`,
    client_reference_id: hotel.id,
    metadata: {
      hotelId: hotel.id,
      plan: input.plan,
    },
    subscription_data: {
      metadata: {
        hotelId: hotel.id,
        plan: input.plan,
      },
    },
    allow_promotion_codes: true,
    locale: "pt-BR",
  });

  if (!session.url) {
    throw new AppError(500, "Stripe não retornou URL de checkout.");
  }

  return { url: session.url };
}

export async function createBillingPortalSession(hotelId: string): Promise<{
  url: string;
}> {
  if (!isStripeConfigured()) {
    throw new AppError(503, "Pagamentos por assinatura não estão configurados.");
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new AppError(404, "Hotel not found");

  const customerId = await ensureStripeCustomer(hotel);
  const base = appReturnBase();

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${base}/billing/return`,
  });

  return { url: session.url };
}

function statusFromStripe(
  status: Stripe.Subscription.Status,
): PlanStatus {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELLED";
    default:
      return "PAST_DUE";
  }
}

function periodEndDate(subscription: Stripe.Subscription): Date {
  const fromItem = subscription.items.data[0]?.current_period_end;
  const endUnix =
    typeof fromItem === "number"
      ? fromItem
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const end = new Date(endUnix * 1000);
  end.setUTCHours(0, 0, 0, 0);
  return end;
}

async function applySubscriptionToHotel(
  hotelId: string,
  subscription: Stripe.Subscription,
  note: string,
) {
  const priceId = subscription.items.data[0]?.price.id;
  const plan =
    planFromPriceId(priceId) ??
    (subscription.metadata.plan as PlanCode | undefined) ??
    "PRO";

  if (plan !== "PRO" && plan !== "PLUS" && plan !== "SIMPLES") {
    return;
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) return;

  const toStatus = statusFromStripe(subscription.status);
  const toPlan: PlanCode = toStatus === "CANCELLED" ? "SIMPLES" : plan;
  const paidUntil =
    toStatus === "CANCELLED" ? hotel.planPaidUntil : periodEndDate(subscription);

  await prisma.$transaction(async (tx) => {
    await tx.hotel.update({
      where: { id: hotelId },
      data: {
        plan: toPlan,
        planStatus: toStatus,
        planPaidUntil: paidUntil,
        stripeCustomerId:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id,
        stripeSubscriptionId:
          toStatus === "CANCELLED" ? null : subscription.id,
        planNotes: note,
      },
    });

    await tx.planEvent.create({
      data: {
        hotelId,
        fromPlan: hotel.plan,
        toPlan,
        fromStatus: hotel.planStatus,
        toStatus,
        paidUntil,
        note,
        actor: "webhook:stripe",
      },
    });
  });
}

async function resolveHotelIdFromSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  if (subscription.metadata.hotelId) return subscription.metadata.hotelId;

  const bySub = await prisma.hotel.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true },
  });
  if (bySub) return bySub.id;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const byCustomer = await prisma.hotel.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return byCustomer?.id ?? null;
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new AppError(503, "STRIPE_WEBHOOK_SECRET não configurado.");
  }
  if (!signature) {
    throw new AppError(400, "Assinatura Stripe ausente.");
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "assinatura inválida";
    throw new AppError(400, `Webhook inválido: ${message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const hotelId =
        session.metadata?.hotelId || session.client_reference_id || null;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!hotelId || !subId) break;
      const subscription = await stripe.subscriptions.retrieve(subId);
      await applySubscriptionToHotel(
        hotelId,
        subscription,
        `Checkout Stripe concluído (${session.id})`,
      );
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      const hotelId = await resolveHotelIdFromSubscription(subscription);
      if (!hotelId) break;
      await applySubscriptionToHotel(
        hotelId,
        subscription,
        `Assinatura Stripe atualizada (${subscription.status})`,
      );
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const hotelId = await resolveHotelIdFromSubscription(subscription);
      if (!hotelId) break;
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) break;
      await prisma.$transaction(async (tx) => {
        await tx.hotel.update({
          where: { id: hotelId },
          data: {
            plan: "SIMPLES",
            planStatus: "CANCELLED",
            stripeSubscriptionId: null,
            planNotes: `Assinatura Stripe cancelada (${subscription.id})`,
          },
        });
        await tx.planEvent.create({
          data: {
            hotelId,
            fromPlan: hotel.plan,
            toPlan: "SIMPLES",
            fromStatus: hotel.planStatus,
            toStatus: "CANCELLED",
            paidUntil: hotel.planPaidUntil,
            note: `Assinatura cancelada no Stripe`,
            actor: "webhook:stripe",
          },
        });
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subRef = (
        invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        }
      ).subscription;
      const subId =
        typeof subRef === "string" ? subRef : subRef?.id ?? null;
      if (!subId) break;
      const subscription = await stripe.subscriptions.retrieve(subId);
      const hotelId = await resolveHotelIdFromSubscription(subscription);
      if (!hotelId) break;
      const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
      if (!hotel) break;
      await prisma.$transaction(async (tx) => {
        await tx.hotel.update({
          where: { id: hotelId },
          data: {
            planStatus: "PAST_DUE",
            planNotes: `Falha no pagamento Stripe (fatura ${invoice.id})`,
          },
        });
        await tx.planEvent.create({
          data: {
            hotelId,
            fromPlan: hotel.plan,
            toPlan: hotel.plan,
            fromStatus: hotel.planStatus,
            toStatus: "PAST_DUE",
            paidUntil: hotel.planPaidUntil,
            note: `Falha no pagamento Stripe (fatura ${invoice.id})`,
            actor: "webhook:stripe",
          },
        });
      });
      break;
    }
    default:
      break;
  }
}
