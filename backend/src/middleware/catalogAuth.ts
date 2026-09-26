import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.js";
import {
  getCatalogUserById,
  verifyCatalogToken,
  type AuthCatalogUser,
} from "../services/catalogAuth.js";

declare global {
  namespace Express {
    interface Request {
      catalogUser?: AuthCatalogUser;
    }
  }
}

export async function requireCatalogAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Faça login para solicitar a reserva");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppError(401, "Faça login para solicitar a reserva");
    }

    const { catalogUserId } = verifyCatalogToken(token);
    req.catalogUser = await getCatalogUserById(catalogUserId);
    next();
  } catch (err) {
    next(err);
  }
}

export function catalogUserFrom(req: Request): AuthCatalogUser {
  if (!req.catalogUser) {
    throw new AppError(401, "Faça login para solicitar a reserva");
  }
  return req.catalogUser;
}
