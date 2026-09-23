import "dotenv/config";
import { addUtcDays, hotelDayIso, startOfHotelDay } from "../lib/datetime.js";
import { effectivePlan } from "../lib/plans.js";
import { prisma } from "../lib/prisma.js";

async function main() {
  const today = startOfHotelDay();
  const in3Days = addUtcDays(today, 3);

  const hotels = await prisma.hotel.findMany({
    where: {
      plan: { not: "SIMPLES" },
      planStatus: { not: "CANCELLED" },
      planPaidUntil: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      plan: true,
      planStatus: true,
      planPaidUntil: true,
    },
    orderBy: { planPaidUntil: "asc" },
  });

  const expiring: typeof hotels = [];
  const expired: typeof hotels = [];

  for (const hotel of hotels) {
    if (!hotel.planPaidUntil) continue;
    const effective = effectivePlan(hotel);
    if (effective === "SIMPLES" && hotel.plan !== "SIMPLES") {
      expired.push(hotel);
    } else if (
      hotel.planPaidUntil >= today &&
      hotel.planPaidUntil <= in3Days
    ) {
      expiring.push(hotel);
    }
  }

  console.log(`\n[plans:check] ${hotelDayIso()}`);
  console.log(`Vencendo em até 3 dias: ${expiring.length}`);
  for (const h of expiring) {
    console.log(
      `  • ${h.name} (${h.phone}) — ${h.plan} até ${h.planPaidUntil?.toISOString().slice(0, 10)}`,
    );
  }
  console.log(`Já rebaixados (vencidos): ${expired.length}`);
  for (const h of expired) {
    console.log(
      `  • ${h.name} (${h.phone}) — ${h.plan} venceu ${h.planPaidUntil?.toISOString().slice(0, 10)}`,
    );
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
