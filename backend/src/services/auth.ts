import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";

const JWT_SECRET = process.env.JWT_SECRET?.trim() || "hospeda-dev-secret-change-me";
const JWT_EXPIRES_IN = "365d";

export type HotelAddress = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  formatted: string | null;
};

export type AuthHotel = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: HotelAddress;
};

type TokenPayload = {
  hotelId: string;
};

type HotelRecord = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function formatHotelAddress(hotel: {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}): string | null {
  const parts = [
    hotel.street
      ? `${hotel.street}${hotel.number ? `, ${hotel.number}` : ""}`
      : null,
    hotel.complement,
    hotel.neighborhood,
    hotel.city && hotel.state
      ? `${hotel.city}/${hotel.state}`
      : hotel.city,
    hotel.zipCode
      ? hotel.zipCode.replace(/(\d{5})(\d{3})/, "$1-$2")
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" — ") : null;
}

function presentHotel(hotel: HotelRecord): AuthHotel {
  return {
    id: hotel.id,
    name: hotel.name,
    ownerName: hotel.ownerName,
    phone: hotel.phone,
    address: {
      street: hotel.street,
      number: hotel.number,
      complement: hotel.complement,
      neighborhood: hotel.neighborhood,
      city: hotel.city,
      state: hotel.state,
      zipCode: hotel.zipCode,
      formatted: formatHotelAddress(hotel),
    },
  };
}

function signToken(hotelId: string): string {
  return jwt.sign({ hotelId } satisfies TokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (!payload.hotelId) throw new Error("Invalid token payload");
    return payload;
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}

export async function registerHotel(input: {
  name: string;
  ownerName: string;
  phone: string;
  password: string;
}) {
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) {
    throw new AppError(400, "Phone must contain at least 10 digits");
  }

  const existing = await prisma.hotel.findUnique({ where: { phone } });
  if (existing) {
    throw new AppError(409, "Phone number already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const hotel = await prisma.hotel.create({
    data: {
      name: input.name.trim(),
      ownerName: input.ownerName.trim(),
      phone,
      passwordHash,
    },
  });

  const token = signToken(hotel.id);
  return { token, hotel: presentHotel(hotel) };
}

export async function loginHotel(input: { phone: string; password: string }) {
  const phone = normalizePhone(input.phone);
  const hotel = await prisma.hotel.findUnique({ where: { phone } });
  if (!hotel) {
    throw new AppError(401, "Invalid phone or password");
  }

  const valid = await bcrypt.compare(input.password, hotel.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid phone or password");
  }

  const token = signToken(hotel.id);
  return { token, hotel: presentHotel(hotel) };
}

export async function getHotelById(hotelId: string): Promise<AuthHotel> {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new AppError(401, "Hotel account not found");
  return presentHotel(hotel);
}

export async function updateHotel(
  hotelId: string,
  input: {
    name?: string;
    ownerName?: string;
    phone?: string;
    password?: string;
    currentPassword?: string;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  },
) {
  const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
  if (!hotel) throw new AppError(404, "Hotel account not found");

  if (input.password) {
    if (!input.currentPassword) {
      throw new AppError(400, "Current password is required to change password");
    }
    const valid = await bcrypt.compare(input.currentPassword, hotel.passwordHash);
    if (!valid) {
      throw new AppError(401, "Current password is incorrect");
    }
  }

  let phone = hotel.phone;
  if (input.phone !== undefined) {
    phone = normalizePhone(input.phone);
    if (phone.length < 10) {
      throw new AppError(400, "Phone must contain at least 10 digits");
    }
    if (phone !== hotel.phone) {
      const taken = await prisma.hotel.findUnique({ where: { phone } });
      if (taken) {
        throw new AppError(409, "Phone number already registered");
      }
    }
  }

  let state = hotel.state;
  if (input.state !== undefined) {
    const normalized = emptyToNull(input.state)?.toUpperCase() ?? null;
    if (normalized && normalized.length !== 2) {
      throw new AppError(400, "State must be the 2-letter UF code");
    }
    state = normalized;
  }

  let zipCode = hotel.zipCode;
  if (input.zipCode !== undefined) {
    const digits = (input.zipCode ?? "").replace(/\D/g, "");
    zipCode = digits ? digits : null;
    if (zipCode && zipCode.length !== 8) {
      throw new AppError(400, "CEP must contain 8 digits");
    }
  }

  const updated = await prisma.hotel.update({
    where: { id: hotelId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.ownerName !== undefined
        ? { ownerName: input.ownerName.trim() }
        : {}),
      ...(input.phone !== undefined ? { phone } : {}),
      ...(input.password
        ? { passwordHash: await bcrypt.hash(input.password, 10) }
        : {}),
      ...(input.street !== undefined ? { street: emptyToNull(input.street) } : {}),
      ...(input.number !== undefined ? { number: emptyToNull(input.number) } : {}),
      ...(input.complement !== undefined
        ? { complement: emptyToNull(input.complement) }
        : {}),
      ...(input.neighborhood !== undefined
        ? { neighborhood: emptyToNull(input.neighborhood) }
        : {}),
      ...(input.city !== undefined ? { city: emptyToNull(input.city) } : {}),
      ...(input.state !== undefined ? { state } : {}),
      ...(input.zipCode !== undefined ? { zipCode } : {}),
    },
  });

  return presentHotel(updated);
}
