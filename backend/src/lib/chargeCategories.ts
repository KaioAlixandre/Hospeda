import type { ChargeGroup, PrismaClient } from "../generated/prisma/client.js";

export const DEFAULT_CHARGE_CATEGORIES: Array<{
  name: string;
  group: ChargeGroup;
  icon: string;
  position: number;
  legacyTypes: string[];
}> = [
  {
    name: "Frigobar",
    group: "CONSUMPTION",
    icon: "wine",
    position: 0,
    legacyTypes: ["MINIBAR"],
  },
  {
    name: "Restaurante",
    group: "CONSUMPTION",
    icon: "utensils",
    position: 1,
    legacyTypes: ["RESTAURANT"],
  },
  {
    name: "Lavanderia",
    group: "SERVICE",
    icon: "shirt",
    position: 2,
    legacyTypes: ["LAUNDRY"],
  },
  {
    name: "Serviço",
    group: "SERVICE",
    icon: "concierge-bell",
    position: 3,
    legacyTypes: ["SERVICE"],
  },
  {
    name: "Outro",
    group: "SERVICE",
    icon: "receipt",
    position: 4,
    legacyTypes: ["OTHER"],
  },
  {
    name: "Desconto",
    group: "DISCOUNT",
    icon: "tag",
    position: 5,
    legacyTypes: ["DISCOUNT"],
  },
];

type Db = Pick<PrismaClient, "chargeCategory">;

/** Cria as seis categorias padrão do hotel (idempotente por nome). */
export async function seedDefaultChargeCategories(db: Db, hotelId: string) {
  const created = [];
  for (const cat of DEFAULT_CHARGE_CATEGORIES) {
    const row = await db.chargeCategory.upsert({
      where: { hotelId_name: { hotelId, name: cat.name } },
      create: {
        hotelId,
        name: cat.name,
        group: cat.group,
        icon: cat.icon,
        position: cat.position,
        active: true,
      },
      update: {},
    });
    created.push(row);
  }
  return created;
}

/** Mapeia ChargeType legado → nome da categoria padrão. */
export function defaultCategoryNameForType(type: string): string | null {
  const found = DEFAULT_CHARGE_CATEGORIES.find((c) =>
    c.legacyTypes.includes(type),
  );
  return found?.name ?? null;
}

/** Compatibilidade: grupo contábil → ChargeType antigo. */
export function legacyTypeFor(
  group: ChargeGroup,
): "MINIBAR" | "SERVICE" | "DISCOUNT" {
  if (group === "CONSUMPTION") return "MINIBAR";
  if (group === "DISCOUNT") return "DISCOUNT";
  return "SERVICE";
}
