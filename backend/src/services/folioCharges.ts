import type { ChargeType } from "../generated/prisma/client.js";
import { legacyTypeFor } from "../lib/chargeCategories.js";
import { presentCharge } from "../lib/presenters.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export type ProductChargeInput = {
  productId: string;
  quantity: number;
  note?: string;
};

export type ManualChargeInput = {
  categoryId: string;
  description: string;
  amount: number;
  quantity?: number;
};

export type ChargeInput = ProductChargeInput | ManualChargeInput;

type ChargeCreateData = {
  reservationId: string;
  type: ChargeType;
  description: string;
  amount: number;
  categoryId: string;
  productId: string | null;
  quantity: number;
  unitPrice: number;
};

async function resolveChargeData(
  hotelId: string,
  reservationId: string,
  data: ChargeInput,
): Promise<ChargeCreateData> {
  if ("productId" in data) {
    const product = await prisma.product.findFirst({
      where: { id: data.productId, hotelId, active: true },
      include: { category: true },
    });
    if (!product) throw new AppError(404, "Produto não encontrado");
    if (!product.category.active) {
      throw new AppError(400, "Categoria do produto está desativada");
    }

    const unitPrice = Number(product.price);
    const quantity = data.quantity;
    return {
      reservationId,
      categoryId: product.categoryId,
      productId: product.id,
      quantity,
      unitPrice,
      amount: Number((unitPrice * quantity).toFixed(2)),
      description: data.note
        ? `${product.name} — ${data.note}`
        : product.name,
      type: legacyTypeFor(product.category.group),
    };
  }

  const category = await prisma.chargeCategory.findFirst({
    where: { id: data.categoryId, hotelId, active: true },
  });
  if (!category) throw new AppError(404, "Categoria não encontrada");

  const quantity = data.quantity ?? 1;
  const unitPrice = Number((data.amount / quantity).toFixed(2));

  return {
    reservationId,
    categoryId: category.id,
    productId: null,
    quantity,
    unitPrice,
    amount: Number(data.amount.toFixed(2)),
    description: data.description.trim(),
    type: legacyTypeFor(category.group),
  };
}

export async function createFolioCharge(
  hotelId: string,
  reservationId: string,
  data: ChargeInput,
) {
  const resolved = await resolveChargeData(hotelId, reservationId, data);
  const charge = await prisma.folioCharge.create({
    data: resolved,
    include: { category: true },
  });
  return presentCharge(charge);
}

export async function createFolioChargesBatch(
  hotelId: string,
  reservationId: string,
  items: ChargeInput[],
) {
  const resolved: ChargeCreateData[] = [];
  for (const item of items) {
    resolved.push(await resolveChargeData(hotelId, reservationId, item));
  }

  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const data of resolved) {
      const charge = await tx.folioCharge.create({
        data,
        include: { category: true },
      });
      created.push(presentCharge(charge));
    }
    return created;
  });
}
