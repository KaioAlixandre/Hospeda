import { prisma } from "../lib/prisma.js";

export type TopProductRow = {
  productId: string;
  name: string;
  quantity: number;
  total: number;
  totalFormatted: string;
};

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Ranking de produtos lançados no período (por productId congelado). */
export async function getTopProducts(
  hotelId: string,
  from: Date,
  to: Date,
  limit = 10,
): Promise<TopProductRow[]> {
  const grouped = await prisma.folioCharge.groupBy({
    by: ["productId"],
    where: {
      productId: { not: null },
      postedAt: { gte: from, lt: to },
      reservation: { hotelId },
    },
    _sum: { quantity: true, amount: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const productIds = grouped
    .map((row) => row.productId)
    .filter((id): id is string => Boolean(id));

  if (productIds.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, hotelId },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  return grouped
    .filter((row) => row.productId)
    .map((row) => {
      const total = Number(row._sum.amount ?? 0);
      return {
        productId: row.productId!,
        name: nameById.get(row.productId!) ?? "Produto removido",
        quantity: row._sum.quantity ?? 0,
        total,
        totalFormatted: formatBRL(total),
      };
    });
}
