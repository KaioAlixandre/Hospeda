import type { Zelador } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

export function presentZelador(zelador: Zelador) {
  return {
    id: zelador.id,
    name: zelador.name,
    phone: zelador.phone,
    createdAt: zelador.createdAt,
    updatedAt: zelador.updatedAt,
  };
}

export async function listZeladores(hotelId: string) {
  const zeladores = await prisma.zelador.findMany({
    where: { hotelId },
    orderBy: { name: "asc" },
  });
  return zeladores.map(presentZelador);
}

export async function createZelador(
  hotelId: string,
  input: { name: string; phone: string },
) {
  const zelador = await prisma.zelador.create({
    data: { ...input, hotelId },
  });
  return presentZelador(zelador);
}

export async function updateZelador(
  hotelId: string,
  id: string,
  input: Partial<{ name: string; phone: string }>,
) {
  const existing = await prisma.zelador.findFirst({
    where: { id, hotelId },
  });
  if (!existing) throw new AppError(404, "Zelador not found");

  const zelador = await prisma.zelador.update({
    where: { id },
    data: input,
  });
  return presentZelador(zelador);
}

export async function deleteZelador(hotelId: string, id: string) {
  const existing = await prisma.zelador.findFirst({
    where: { id, hotelId },
  });
  if (!existing) throw new AppError(404, "Zelador not found");

  await prisma.zelador.delete({ where: { id } });
}
