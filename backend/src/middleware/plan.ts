import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import {
  hasFeature,
  PLAN_CATALOG,
  planPriceLabel,
  type Feature,
  type PlanCode,
} from "../lib/plans.js";
import { hotelIdFrom } from "./auth.js";
import { AppError } from "./errorHandler.js";

const FEATURE_PLAN: Record<Feature, PlanCode> = {
  messaging: "PRO",
  catalog: "PLUS",
};

const FEATURE_LABEL: Record<Feature, string> = {
  messaging: "O envio de mensagens",
  catalog: "O catálogo online",
};

function featureMessage(feature: Feature, currentPlan: PlanCode): string {
  const needed = FEATURE_PLAN[feature];
  return `${FEATURE_LABEL[feature]} está no plano ${PLAN_CATALOG[needed].label} (${planPriceLabel(needed)}). Seu plano atual é ${PLAN_CATALOG[currentPlan].label}.`;
}

export function requireFeature(feature: Feature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const hotel = await prisma.hotel.findUnique({
        where: { id: hotelIdFrom(req) },
        select: { plan: true, planStatus: true, planPaidUntil: true },
      });
      if (!hotel) throw new AppError(401, "Hotel account not found");
      if (!hasFeature(hotel, feature)) {
        throw new AppError(402, featureMessage(feature, hotel.plan));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
