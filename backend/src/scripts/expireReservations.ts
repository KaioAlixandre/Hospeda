import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { expireOnlineReservations } from "../services/reservations.js";

async function main() {
  const count = await expireOnlineReservations();
  console.log(`[reservations:expire] canceladas: ${count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
