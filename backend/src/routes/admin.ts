import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { renewPaidUntil, type PlanCode } from "../lib/plans.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAdminToken } from "../middleware/adminAuth.js";

export const adminRouter = Router();

export const adminLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas requisições admin. Tente novamente em instantes." },
});

adminRouter.use(requireAdminToken);

const planSchema = z.enum(["SIMPLES", "PRO", "PLUS"]);
const statusSchema = z.enum(["ACTIVE", "PAST_DUE", "CANCELLED"]);

adminRouter.get("/hotels", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const hotels = await prisma.hotel.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q.replace(/\D/g, "") } },
              { slug: { contains: q } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        plan: true,
        planStatus: true,
        planPaidUntil: true,
        planNotes: true,
        slug: true,
        catalogEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ hotels });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/hotels/:id/plan", async (req, res, next) => {
  try {
    const body = z
      .object({
        plan: planSchema,
        planStatus: statusSchema.optional(),
        paidUntil: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        renew: z.boolean().optional(),
        note: z.string().max(2000).optional(),
      })
      .parse(req.body);

    const hotel = await prisma.hotel.findUnique({ where: { id: req.params.id } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    const planStatus = body.planStatus ?? hotel.planStatus;
    let planPaidUntil = hotel.planPaidUntil;

    if (body.renew) {
      planPaidUntil = renewPaidUntil(hotel.planPaidUntil);
    } else if (body.paidUntil !== undefined) {
      planPaidUntil = body.paidUntil
        ? new Date(`${body.paidUntil}T00:00:00.000Z`)
        : null;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.hotel.update({
        where: { id: hotel.id },
        data: {
          plan: body.plan,
          planStatus,
          planPaidUntil,
          planNotes: body.note ?? hotel.planNotes,
        },
      });

      await tx.planEvent.create({
        data: {
          hotelId: hotel.id,
          fromPlan: hotel.plan,
          toPlan: body.plan as PlanCode,
          fromStatus: hotel.planStatus,
          toStatus: planStatus,
          paidUntil: planPaidUntil,
          note: body.note,
          actor: "admin",
        },
      });

      return next;
    });

    res.json({
      hotel: {
        id: updated.id,
        name: updated.name,
        phone: updated.phone,
        plan: updated.plan,
        planStatus: updated.planStatus,
        planPaidUntil: updated.planPaidUntil,
        planNotes: updated.planNotes,
        slug: updated.slug,
        catalogEnabled: updated.catalogEnabled,
      },
    });
  } catch (err) {
    next(err);
  }
});
