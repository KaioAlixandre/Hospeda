import { prisma } from "./prisma.js";

const BLOCKED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "public",
  "health",
  "app",
  "www",
  "h",
]);

/** "Pousada do Sol" → "pousada-do-sol" */
export function slugifyName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return base || "hotel";
}

export async function allocateUniqueSlug(
  name: string,
  excludeHotelId?: string,
): Promise<string> {
  let base = slugifyName(name);
  if (BLOCKED_SLUGS.has(base)) base = `${base}-hotel`;

  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await prisma.hotel.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeHotelId) return candidate;
    candidate = `${base}-${n}`;
    n += 1;
  }
}

/** Gera slug só se o hotel ainda não tiver. Nunca sobrescreve. */
export async function ensureHotelSlug(
  hotelId: string,
  name: string,
): Promise<string | null> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: { slug: true },
  });
  if (!hotel) return null;
  if (hotel.slug) return hotel.slug;

  const slug = await allocateUniqueSlug(name, hotelId);
  await prisma.hotel.update({
    where: { id: hotelId },
    data: { slug },
  });
  return slug;
}
