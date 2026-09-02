import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  getHotelById,
  loginHotel,
  registerHotel,
  updateHotel,
} from "../services/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  ownerName: z.string().min(2),
  phone: z.string().min(8),
  password: z.string().min(6),
});

const loginSchema = z.object({
  phone: z.string().min(8),
  password: z.string().min(1),
});

const updateHotelSchema = z
  .object({
    name: z.string().min(2).optional(),
    ownerName: z.string().min(2).optional(),
    phone: z.string().min(8).optional(),
    password: z.string().min(6).optional(),
    currentPassword: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.ownerName !== undefined ||
      data.phone !== undefined ||
      data.password !== undefined,
    { message: "At least one field must be provided" },
  )
  .refine((data) => !data.password || Boolean(data.currentPassword), {
    message: "currentPassword is required when changing password",
    path: ["currentPassword"],
  });

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await registerHotel(data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await loginHotel(data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const hotel = await getHotelById(req.hotel!.id);
    res.json({ hotel });
  } catch (err) {
    next(err);
  }
});

authRouter.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const data = updateHotelSchema.parse(req.body);
    const hotel = await updateHotel(req.hotel!.id, data);
    res.json({ hotel });
  } catch (err) {
    next(err);
  }
});
