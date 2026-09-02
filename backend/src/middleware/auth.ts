import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.js";
import { getHotelById, verifyToken, type AuthHotel } from "../services/auth.js";

declare global {
  namespace Express {
    interface Request {
      hotel?: AuthHotel;
    }
  }
}

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentication required");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new AppError(401, "Authentication required");

    const { hotelId } = verifyToken(token);
    req.hotel = await getHotelById(hotelId);
    next();
  } catch (err) {
    next(err);
  }
}

export function hotelIdFrom(req: Request): string {
  if (!req.hotel?.id) throw new AppError(401, "Authentication required");
  return req.hotel.id;
}
