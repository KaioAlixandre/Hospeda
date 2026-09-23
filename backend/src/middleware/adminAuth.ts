import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requireAdminTokenValue } from "../lib/env.js";
import { AppError } from "./errorHandler.js";

export function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function requireAdminToken(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers["x-admin-token"];
    const provided = typeof header === "string" ? header.trim() : "";
    if (!provided) throw new AppError(401, "Admin token required");

    const expected = requireAdminTokenValue();
    if (!tokensMatch(provided, expected)) {
      throw new AppError(401, "Invalid admin token");
    }
    next();
  } catch (err) {
    next(err);
  }
}
