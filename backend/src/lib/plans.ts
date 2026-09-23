import { startOfHotelDay } from "./datetime.js";

export type Feature = "messaging" | "catalog";

export const PLAN_CATALOG = {
  SIMPLES: { label: "Simples", priceCents: 5300, features: [] as Feature[] },
  PRO: {
    label: "Pro",
    priceCents: 7300,
    features: ["messaging"] as Feature[],
  },
  PLUS: {
    label: "Plus",
    priceCents: 9300,
    features: ["messaging", "catalog"] as Feature[],
  },
} as const;

export type PlanCode = keyof typeof PLAN_CATALOG;

type PlanInput = {
  plan: PlanCode;
  planStatus: "ACTIVE" | "PAST_DUE" | "CANCELLED";
  planPaidUntil: Date | null;
};

/** Dias de tolerância depois do vencimento antes de rebaixar. */
const GRACE_DAYS = Number(process.env.PLAN_GRACE_DAYS ?? 5);

/**
 * Plano que vale agora. Vencido rebaixa para SIMPLES — o hotel continua
 * operando, só perde os extras. Nunca tranca o sistema.
 */
export function effectivePlan(hotel: PlanInput): PlanCode {
  if (hotel.planStatus === "CANCELLED") return "SIMPLES";
  if (!hotel.planPaidUntil) return hotel.plan;

  const limit = new Date(hotel.planPaidUntil);
  limit.setUTCDate(limit.getUTCDate() + GRACE_DAYS);

  return startOfHotelDay() > limit ? "SIMPLES" : hotel.plan;
}

export function hasFeature(hotel: PlanInput, feature: Feature): boolean {
  return PLAN_CATALOG[effectivePlan(hotel)].features.includes(feature);
}

export function planPriceLabel(plan: PlanCode): string {
  const reais = (PLAN_CATALOG[plan].priceCents / 100).toFixed(0);
  return `R$ ${reais}/mês`;
}

/** Resumo para o app desktop e para a tela de plano. */
export function presentPlan(
  hotel: PlanInput & {
    stripeSubscriptionId?: string | null;
  },
) {
  const effective = effectivePlan(hotel);
  return {
    plan: hotel.plan,
    effectivePlan: effective,
    downgraded: effective !== hotel.plan,
    status: hotel.planStatus,
    paidUntil: hotel.planPaidUntil,
    label: PLAN_CATALOG[effective].label,
    priceLabel: planPriceLabel(effective),
    catalog: PLAN_CATALOG,
    features: {
      messaging: hasFeature(hotel, "messaging"),
      catalog: hasFeature(hotel, "catalog"),
    },
    billing: {
      stripeEnabled: Boolean(
        process.env.STRIPE_SECRET_KEY?.trim() &&
          process.env.STRIPE_PRICE_SIMPLES?.trim() &&
          process.env.STRIPE_PRICE_PRO?.trim() &&
          process.env.STRIPE_PRICE_PLUS?.trim(),
      ),
      hasSubscription: Boolean(hotel.stripeSubscriptionId),
    },
  };
}

/** Empurra paidUntil 30 dias a partir do maior entre hoje e o atual. */
export function renewPaidUntil(
  current: Date | null,
  today: Date = startOfHotelDay(),
): Date {
  const base =
    current && current.getTime() > today.getTime() ? current : today;
  const paidUntil = new Date(base);
  paidUntil.setUTCDate(paidUntil.getUTCDate() + 30);
  return paidUntil;
}
