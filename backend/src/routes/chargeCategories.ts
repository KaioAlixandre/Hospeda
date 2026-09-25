import { Router } from "express";
import { presentChargeCategory } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createChargeCategorySchema,
  updateChargeCategorySchema,
} from "../validators/schemas.js";

export const chargeCategoriesRouter = Router();

chargeCategoriesRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const activeOnly =
      typeof req.query.active === "string"
        ? req.query.active === "true"
        : undefined;

    const categories = await prisma.chargeCategory.findMany({
      where: {
        hotelId,
        ...(activeOnly === true ? { active: true } : {}),
        ...(activeOnly === false ? { active: false } : {}),
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    res.json(categories.map(presentChargeCategory));
  } catch (err) {
    next(err);
  }
});

chargeCategoriesRouter.post("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createChargeCategorySchema.parse(req.body);
    const category = await prisma.chargeCategory.create({
      data: {
        hotelId,
        name: data.name.trim(),
        group: data.group,
        icon: data.icon ?? null,
        position: data.position ?? 0,
      },
      include: { _count: { select: { products: true } } },
    });
    res.status(201).json(presentChargeCategory(category));
  } catch (err) {
    next(err);
  }
});

chargeCategoriesRouter.patch("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.chargeCategory.findFirst({
      where: { id: req.params.id, hotelId },
      include: { _count: { select: { products: { where: { active: true } } } } },
    });
    if (!existing) throw new AppError(404, "Categoria não encontrada");

    const data = updateChargeCategorySchema.parse(req.body);

    if (data.active === false && existing._count.products > 0) {
      throw new AppError(
        409,
        `${existing.name} tem ${existing._count.products} produto${existing._count.products === 1 ? "" : "s"} ativo${existing._count.products === 1 ? "" : "s"}. Mova ou desative os produtos antes.`,
      );
    }

    const category = await prisma.chargeCategory.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.group !== undefined ? { group: data.group } : {}),
        ...(data.icon !== undefined ? { icon: data.icon } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      },
      include: { _count: { select: { products: true } } },
    });
    res.json(presentChargeCategory(category));
  } catch (err) {
    next(err);
  }
});

/** Desativa a categoria (nunca apaga). */
chargeCategoriesRouter.delete("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.chargeCategory.findFirst({
      where: { id: req.params.id, hotelId },
      include: { _count: { select: { products: { where: { active: true } } } } },
    });
    if (!existing) throw new AppError(404, "Categoria não encontrada");

    if (existing._count.products > 0) {
      throw new AppError(
        409,
        `${existing.name} tem ${existing._count.products} produto${existing._count.products === 1 ? "" : "s"} ativo${existing._count.products === 1 ? "" : "s"}. Mova ou desative os produtos antes.`,
      );
    }

    const category = await prisma.chargeCategory.update({
      where: { id: existing.id },
      data: { active: false },
      include: { _count: { select: { products: true } } },
    });
    res.json(presentChargeCategory(category));
  } catch (err) {
    next(err);
  }
});
