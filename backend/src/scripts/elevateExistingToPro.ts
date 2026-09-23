import "dotenv/config";
import { prisma } from "../lib/prisma.js";

async function main() {
  const result = await prisma.hotel.updateMany({
    data: {
      plan: "PRO",
      planStatus: "ACTIVE",
      planPaidUntil: null,
      planNotes: "Migração: hotéis existentes elevados a Pro",
    },
  });

  const hotels = await prisma.hotel.findMany({
    select: { id: true, name: true, phone: true, plan: true },
  });

  console.log(`Atualizados: ${result.count}`);
  for (const h of hotels) {
    console.log(`  • ${h.name} (${h.phone}) → ${h.plan}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
