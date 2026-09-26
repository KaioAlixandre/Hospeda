import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { requireJwtSecret } from "../lib/env.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

const JWT_EXPIRES_IN = "365d";
const TOKEN_TYP = "catalog" as const;

type CatalogTokenPayload = {
  catalogUserId: string;
  typ: typeof TOKEN_TYP;
};

export type AuthCatalogUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
};

function presentCatalogUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  googleId: string | null;
}): AuthCatalogUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    hasPassword: Boolean(user.passwordHash),
    googleLinked: Boolean(user.googleId),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}

function signCatalogToken(catalogUserId: string): string {
  return jwt.sign(
    { catalogUserId, typ: TOKEN_TYP } satisfies CatalogTokenPayload,
    requireJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN },
  );
}

export function verifyCatalogToken(token: string): CatalogTokenPayload {
  try {
    const payload = jwt.verify(
      token,
      requireJwtSecret(),
    ) as CatalogTokenPayload;
    if (payload.typ !== TOKEN_TYP || !payload.catalogUserId) {
      throw new Error("Invalid catalog token");
    }
    return payload;
  } catch {
    throw new AppError(401, "Faça login para continuar");
  }
}

export function getGoogleClientId(): string | null {
  const value = process.env.GOOGLE_CLIENT_ID?.trim();
  return value || null;
}

export function getCatalogAuthConfig() {
  return {
    googleClientId: getGoogleClientId(),
    googleEnabled: Boolean(getGoogleClientId()),
  };
}

export async function getCatalogUserById(id: string): Promise<AuthCatalogUser> {
  const user = await prisma.catalogUser.findUnique({ where: { id } });
  if (!user) throw new AppError(401, "Faça login para continuar");
  return presentCatalogUser(user);
}

async function issueSession(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  googleId: string | null;
}) {
  return {
    token: signCatalogToken(user.id),
    user: presentCatalogUser(user),
  };
}

export async function registerCatalogUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!phone) throw new AppError(400, "Informe um WhatsApp válido");
  if (input.password.length < 6) {
    throw new AppError(400, "A senha deve ter pelo menos 6 caracteres");
  }

  const existing = await prisma.catalogUser.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "Já existe uma conta com este e-mail");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.catalogUser.create({
    data: {
      email,
      name: input.name.trim(),
      phone,
      passwordHash,
    },
  });

  return issueSession(user);
}

export async function loginCatalogUser(input: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(input.email);
  const user = await prisma.catalogUser.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    throw new AppError(401, "E-mail ou senha inválidos");
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new AppError(401, "E-mail ou senha inválidos");

  return issueSession(user);
}

export async function loginCatalogUserWithGoogle(credential: string) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new AppError(503, "Login com Google não está configurado");
  }

  const client = new OAuth2Client(clientId);
  let payload: {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  };
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload() ?? {};
  } catch {
    throw new AppError(401, "Credencial Google inválida");
  }

  const googleId = payload.sub;
  const email = payload.email ? normalizeEmail(payload.email) : null;
  const verified =
    payload.email_verified === true || payload.email_verified === "true";

  if (!googleId || !email || !verified) {
    throw new AppError(401, "Conta Google sem e-mail verificado");
  }

  const name = (payload.name ?? email.split("@")[0] ?? "Hóspede").trim();
  const avatarUrl = payload.picture?.trim() || null;

  let user = await prisma.catalogUser.findFirst({
    where: { OR: [{ googleId }, { email }] },
  });

  if (user) {
    user = await prisma.catalogUser.update({
      where: { id: user.id },
      data: {
        googleId: user.googleId ?? googleId,
        name: user.name || name,
        avatarUrl: avatarUrl ?? user.avatarUrl,
        email,
      },
    });
  } else {
    user = await prisma.catalogUser.create({
      data: {
        email,
        name,
        googleId,
        avatarUrl,
      },
    });
  }

  return issueSession(user);
}

export async function updateCatalogUser(
  userId: string,
  input: { name?: string; phone?: string },
) {
  const data: { name?: string; phone?: string | null } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AppError(400, "Informe o nome");
    data.name = name;
  }
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone);
    if (!phone) throw new AppError(400, "Informe um WhatsApp válido");
    data.phone = phone;
  }

  const user = await prisma.catalogUser.update({
    where: { id: userId },
    data,
  });
  return presentCatalogUser(user);
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Concluída",
};

function firstPhoto(photos: unknown): string | null {
  if (!Array.isArray(photos)) return null;
  const url = photos.find((item): item is string => typeof item === "string");
  return url ?? null;
}

function nightsBetween(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export async function listCatalogUserReservations(catalogUserId: string) {
  const user = await prisma.catalogUser.findUnique({
    where: { id: catalogUserId },
  });
  if (!user) return [];

  const phoneSuffix = user.phone ? user.phone.slice(-11) : null;

  // Liga pedidos ONLINE antigos (sem catalogUserId) pelo e-mail/telefone da conta.
  const orphanFilter = {
    catalogUserId: null as null,
    source: "ONLINE" as const,
    OR: [
      { guest: { email: user.email } },
      ...(phoneSuffix
        ? [{ guest: { phone: { contains: phoneSuffix } } }]
        : []),
    ],
  };

  await prisma.reservation.updateMany({
    where: orphanFilter,
    data: { catalogUserId },
  });

  const rows = await prisma.reservation.findMany({
    where: { catalogUserId },
    include: {
      hotel: {
        select: { name: true, slug: true, logoUrl: true },
      },
      roomType: {
        select: { name: true, photos: true },
      },
      room: {
        select: { number: true },
      },
    },
    orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => {
    const nights = nightsBetween(row.checkInDate, row.checkOutDate);
    const nightlyRate = Number(row.nightlyRate);
    const total = Number((nightlyRate * nights).toFixed(2));

    return {
      code: row.code,
      status: row.status,
      statusLabel: STATUS_LABEL[row.status] ?? row.status,
      source: row.source,
      checkInDate: row.checkInDate.toISOString().slice(0, 10),
      checkOutDate: row.checkOutDate.toISOString().slice(0, 10),
      guests: row.guests,
      nights,
      nightlyRate,
      total,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      hotel: {
        name: row.hotel.name,
        slug: row.hotel.slug,
        logoUrl: row.hotel.logoUrl,
      },
      roomType: {
        name: row.roomType.name,
        photo: firstPhoto(row.roomType.photos),
      },
      roomNumber: row.room?.number ?? null,
    };
  });
}
