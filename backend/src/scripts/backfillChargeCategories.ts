import "dotenv/config";
import {
  DEFAULT_CHARGE_CATEGORIES,
  seedDefaultChargeCategories,
} from "../lib/chargeCategories.js";
import { prisma } from "../lib/prisma.js";

/** Cria categorias padrão e preenche categoryId/unitPrice/quantity nos lançamentos. */
async function main() {
  const hotels = await prisma.hotel.findMany({ select: { id: true, name: true } });
  let hotelsDone = 0;
  let chargesUpdated = 0;

  for (const hotel of hotels) {
    const categories = await seedDefaultChargeCategories(prisma, hotel.id);
    const byName = new Map(categories.map((c) => [c.name, c.id]));
    const typeToCategoryId = new Map<string, string>();
    for (const def of DEFAULT_CHARGE_CATEGORIES) {
      const id = byName.get(def.name);
      if (!id) continue;
      for (const type of def.legacyTypes) {
        typeToCategoryId.set(type, id);
      }
    }

    const reservations = await prisma.reservation.findMany({
      where: { hotelId: hotel.id },
      select: { id: true },
    });
    const reservationIds = reservations.map((r) => r.id);
    if (reservationIds.length === 0) {
      hotelsDone += 1;
      continue;
    }

    const charges = await prisma.folioCharge.findMany({
      where: { reservationId: { in: reservationIds } },
      select: { id: true, type: true, amount: true, categoryId: true },
    });

    for (const charge of charges) {
      const categoryId =
        charge.type === "ROOM"
          ? null
          : (typeToCategoryId.get(charge.type) ?? null);

      await prisma.folioCharge.update({
        where: { id: charge.id },
        data: {
          categoryId: charge.categoryId ?? categoryId,
          quantity: 1,
          unitPrice: charge.amount,
        },
      });
      chargesUpdated += 1;
    }

    hotelsDone += 1;
    console.log(`  ${hotel.name}: ${categories.length} categorias`);
  }

  console.log(
    `[charges:backfill] ${hotelsDone} hotel(éis), ${chargesUpdated} lançamento(s)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
