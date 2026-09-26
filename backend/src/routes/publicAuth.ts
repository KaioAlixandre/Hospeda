import { Router } from "express";
import { z } from "zod";
import { authLimiter } from "../middleware/security.js";
import {
  requireCatalogAuth,
  catalogUserFrom,
} from "../middleware/catalogAuth.js";
import {
  getCatalogAuthConfig,
  getCatalogUserById,
  listCatalogUserReservations,
  loginCatalogUser,
  loginCatalogUserWithGoogle,
  registerCatalogUser,
  updateCatalogUser,
} from "../services/catalogAuth.js";

export const publicAuthRouter = Router();

publicAuthRouter.get("/config", (_req, res) => {
  res.json(getCatalogAuthConfig());
});

publicAuthRouter.post("/register", authLimiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().min(1).max(120),
        email: z.string().email().max(200),
        phone: z.string().min(8).max(30),
        password: z.string().min(6).max(100),
      })
      .parse(req.body);

    const session = await registerCatalogUser(body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

publicAuthRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(100),
      })
      .parse(req.body);

    const session = await loginCatalogUser(body);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

publicAuthRouter.post("/google", authLimiter, async (req, res, next) => {
  try {
    const body = z
      .object({
        credential: z.string().min(20),
      })
      .parse(req.body);

    const session = await loginCatalogUserWithGoogle(body.credential);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

publicAuthRouter.get("/me", requireCatalogAuth, async (req, res, next) => {
  try {
    const user = catalogUserFrom(req);
    res.json({ user: await getCatalogUserById(user.id) });
  } catch (err) {
    next(err);
  }
});

publicAuthRouter.patch("/me", requireCatalogAuth, async (req, res, next) => {
  try {
    const user = catalogUserFrom(req);
    const body = z
      .object({
        name: z.string().min(1).max(120).optional(),
        phone: z.string().min(8).max(30).optional(),
      })
      .parse(req.body);

    const updated = await updateCatalogUser(user.id, body);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

publicAuthRouter.get(
  "/reservations",
  requireCatalogAuth,
  async (req, res, next) => {
    try {
      const user = catalogUserFrom(req);
      const reservations = await listCatalogUserReservations(user.id);
      res.json({ reservations });
    } catch (err) {
      next(err);
    }
  },
);
