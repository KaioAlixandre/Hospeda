import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { allocateUniqueSlug } from "../lib/slug.js";

/** Preenche slug nos hotéis que ainda não têm. */
async function main() {
  const hotels = await prisma.hotel.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });

  let n = 0;
  for (const hotel of hotels) {
    const slug = await allocateUniqueSlug(hotel.name, hotel.id);
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { slug },
    });
    console.log(`  ${hotel.name} → ${slug}`);
    n += 1;
  }
  console.log(`[slugs:backfill] ${n} hotel(éis)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
