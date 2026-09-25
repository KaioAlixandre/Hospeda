import { Router } from "express";
import { presentProduct } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import {
  createProductSchema,
  createProductsBatchSchema,
  updateProductSchema,
} from "../validators/schemas.js";

export const productsRouter = Router();

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      group: true,
      icon: true,
      active: true,
    },
  },
} as const;

productsRouter.get("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const categoryId =
      typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const activeParam =
      typeof req.query.active === "string" ? req.query.active : undefined;
    const active =
      activeParam === "true" ? true : activeParam === "false" ? false : undefined;

    const products = await prisma.product.findMany({
      where: {
        hotelId,
        ...(categoryId ? { categoryId } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: productInclude,
    });
    res.json(products.map(presentProduct));
  } catch (err) {
    next(err);
  }
});

productsRouter.post("/", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createProductSchema.parse(req.body);

    const category = await prisma.chargeCategory.findFirst({
      where: { id: data.categoryId, hotelId, active: true },
    });
    if (!category) throw new AppError(404, "Categoria não encontrada");

    const product = await prisma.product.create({
      data: {
        hotelId,
        categoryId: category.id,
        name: data.name.trim(),
        code: data.code?.trim() || null,
        price: data.price,
        unit: data.unit?.trim() || null,
        position: data.position ?? 0,
      },
      include: productInclude,
    });
    res.status(201).json(presentProduct(product));
  } catch (err) {
    next(err);
  }
});

productsRouter.post("/batch", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const data = createProductsBatchSchema.parse(req.body);

    const category = await prisma.chargeCategory.findFirst({
      where: { id: data.categoryId, hotelId, active: true },
    });
    if (!category) throw new AppError(404, "Categoria não encontrada");

    const created = await prisma.$transaction(
      data.items.map((item, index) =>
        prisma.product.create({
          data: {
            hotelId,
            categoryId: category.id,
            name: item.name.trim(),
            code: item.code?.trim() || null,
            price: item.price,
            unit: item.unit?.trim() || null,
            position: index,
          },
          include: productInclude,
        }),
      ),
    );

    res.status(201).json(created.map(presentProduct));
  } catch (err) {
    next(err);
  }
});

productsRouter.patch("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!existing) throw new AppError(404, "Produto não encontrado");

    const data = updateProductSchema.parse(req.body);

    if (data.categoryId !== undefined) {
      const category = await prisma.chargeCategory.findFirst({
        where: { id: data.categoryId, hotelId, active: true },
      });
      if (!category) throw new AppError(404, "Categoria não encontrada");
    }

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.code !== undefined
          ? { code: data.code?.trim() || null }
          : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.unit !== undefined
          ? { unit: data.unit?.trim() || null }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      },
      include: productInclude,
    });
    res.json(presentProduct(product));
  } catch (err) {
    next(err);
  }
});

/** Desativa o produto (nunca apaga). */
productsRouter.delete("/:id", async (req, res, next) => {
  try {
    const hotelId = hotelIdFrom(req);
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, hotelId },
    });
    if (!existing) throw new AppError(404, "Produto não encontrado");

    const product = await prisma.product.update({
      where: { id: existing.id },
      data: { active: false },
      include: productInclude,
    });
    res.json(presentProduct(product));
  } catch (err) {
    next(err);
  }
});
