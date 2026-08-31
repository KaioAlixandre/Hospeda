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

export async function listZeladores() {
  const zeladores = await prisma.zelador.findMany({
    orderBy: { name: "asc" },
  });
  return zeladores.map(presentZelador);
}

export async function createZelador(input: { name: string; phone: string }) {
  const zelador = await prisma.zelador.create({ data: input });
  return presentZelador(zelador);
}

export async function updateZelador(
  id: string,
  input: Partial<{ name: string; phone: string }>,
) {
  const existing = await prisma.zelador.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Zelador not found");

  const zelador = await prisma.zelador.update({
    where: { id },
    data: input,
  });
  return presentZelador(zelador);
}

export async function deleteZelador(id: string) {
  const existing = await prisma.zelador.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Zelador not found");

  await prisma.zelador.delete({ where: { id } });
}
