import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";
import {
  catalogUserFrom,
  requireCatalogAuth,
} from "../middleware/catalogAuth.js";
import {
  createPublicReservation,
  getPublicAvailability,
  getPublicHotel,
  getPublicRoomType,
  getPublicRooms,
} from "../services/publicCatalog.js";
import { publicAuthRouter } from "./publicAuth.js";

export const publicRouter = Router();

publicRouter.use("/auth", publicAuthRouter);

function slugParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0]! : value;
}

export const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas consultas. Tente novamente em instantes." },
});

export const publicReserveLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
  message: {
    error: "Muitas tentativas de reserva. Aguarde e tente novamente.",
  },
});

publicRouter.get("/hotels/:slug", publicReadLimiter, async (req, res, next) => {
  try {
    const hotel = await getPublicHotel(slugParam(req.params.slug));
    res.json({ hotel });
  } catch (err) {
    next(err);
  }
});

publicRouter.get(
  "/hotels/:slug/rooms",
  publicReadLimiter,
  async (req, res, next) => {
    try {
      const data = await getPublicRooms(slugParam(req.params.slug));
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

publicRouter.get(
  "/hotels/:slug/rooms/:roomTypeId",
  publicReadLimiter,
  async (req, res, next) => {
    try {
      const query = z
        .object({
          checkIn: z.string().date().optional(),
          checkOut: z.string().date().optional(),
          guests: z.coerce.number().int().positive().optional(),
        })
        .parse(req.query);

      const data = await getPublicRoomType(
        slugParam(req.params.slug),
        slugParam(req.params.roomTypeId),
        {
          checkInDate: query.checkIn,
          checkOutDate: query.checkOut,
          guests: query.guests,
        },
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

publicRouter.get(
  "/hotels/:slug/availability",
  publicReadLimiter,
  async (req, res, next) => {
    try {
      const query = z
        .object({
          checkIn: z.string().date(),
          checkOut: z.string().date(),
          guests: z.coerce.number().int().positive().default(1),
        })
        .parse(req.query);

      const data = await getPublicAvailability(slugParam(req.params.slug), {
        checkInDate: query.checkIn,
        checkOutDate: query.checkOut,
        guests: query.guests,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

publicRouter.post(
  "/hotels/:slug/reservations",
  publicReserveLimiter,
  requireCatalogAuth,
  async (req, res, next) => {
    try {
      const catalogUser = catalogUserFrom(req);
      const body = z
        .object({
          checkInDate: z.string().date(),
          checkOutDate: z.string().date(),
          guests: z.number().int().positive(),
          roomTypeId: z.string().min(1),
          guest: z
            .object({
              name: z.string().min(1).optional(),
              phone: z.string().min(8).optional(),
              email: z.string().email().optional(),
              city: z.string().optional(),
            })
            .optional(),
          notes: z.string().max(1000).optional(),
          website: z.string().optional(),
        })
        .parse(req.body);

      const result = await createPublicReservation(slugParam(req.params.slug), {
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        guests: body.guests,
        roomTypeId: body.roomTypeId,
        catalogUser,
        guest: body.guest,
        notes: body.notes,
        honeypot: body.website,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);
