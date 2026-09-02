import { prisma } from "../lib/prisma.js";

export type MessageNotification = {
  sent: boolean;
  skipped?: "not_configured" | "no_phone" | "api_error";
  channel?: "whatsapp";
  to?: string;
  reason?: string;
};

export type BulkMessageNotification = {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  recipients: MessageNotification[];
};

type ConfirmedStay = {
  code: string;
  hotelId: string;
  guest: { name: string; phone: string | null };
  roomType: { name: string };
  room: { number: string } | null;
  periodLabel: string;
  pricingSummary: string;
};

type CleaningRoom = {
  number: string;
  floor: number | null;
  roomType: { name: string };
};

type MessagingEndpoint = {
  url: string;
  headers: Record<string, string>;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function propertyName(): string {
  return env("MESSAGING_PROPERTY_NAME") ?? "Hospeda";
}

export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function resolveEnvEndpoint(): MessagingEndpoint | null {
  const base = (env("MESSAGING_API_URL") ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const instanceId = env("MESSAGING_INSTANCE_ID");
  const token = env("MESSAGING_TOKEN");
  const clientToken = env("MESSAGING_CLIENT_TOKEN");
  const style =
    env("MESSAGING_STYLE") ?? (instanceId && token ? "z-api" : "rest");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) headers["Client-Token"] = clientToken;

  if (style === "z-api" && instanceId && token) {
    return {
      url: `${base}/instances/${instanceId}/token/${token}/send-text`,
      headers,
    };
  }

  if (clientToken) {
    return {
      url: `${base}/messages/text`,
      headers,
    };
  }

  return null;
}

function resolveHotelEndpoint(hotel: {
  messagingInstanceId: string | null;
  messagingToken: string | null;
  messagingClientToken: string | null;
}): MessagingEndpoint | null {
  const instanceId = hotel.messagingInstanceId?.trim();
  const token = hotel.messagingToken?.trim();
  const clientToken =
    hotel.messagingClientToken?.trim() || token || undefined;
  if (!instanceId || !token) return null;

  const base = (
    env("SEND_API_BASE_URL") ||
    env("MESSAGING_API_URL") ||
    "https://api.kaioalixandre.com.br"
  ).replace(/\/$/, "");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) headers["Client-Token"] = clientToken;

  return {
    url: `${base}/instances/${instanceId}/token/${token}/send-text`,
    headers,
  };
}

async function resolveEndpoint(
  hotelId?: string,
): Promise<MessagingEndpoint | null> {
  if (hotelId) {
    const hotel = await prisma.hotel.findUnique({
      where: { id: hotelId },
      select: {
        messagingInstanceId: true,
        messagingToken: true,
        messagingClientToken: true,
      },
    });
    if (hotel) {
      const fromHotel = resolveHotelEndpoint(hotel);
      if (fromHotel) return fromHotel;
    }
  }
  return resolveEnvEndpoint();
}

async function sendTextMessage(
  phone: string,
  message: string,
  context: string,
  hotelId?: string,
): Promise<MessageNotification> {
  const endpoint = await resolveEndpoint(hotelId);
  if (!endpoint) {
    return {
      sent: false,
      skipped: "not_configured",
      reason: "Messaging API is not configured",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: endpoint.headers,
      body: JSON.stringify({ phone, message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[messaging] send failed (${response.status}) for ${context}: ${detail.slice(0, 300)}`,
      );
      return {
        sent: false,
        skipped: "api_error",
        to: phone,
        reason: `Messaging API returned ${response.status}`,
      };
    }

    console.info(`[messaging] message sent to ${phone} (${context})`);
    return { sent: true, channel: "whatsapp", to: phone };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : "Unknown messaging error";
    console.error(`[messaging] send error for ${context}: ${reason}`);
    return {
      sent: false,
      skipped: "api_error",
      to: phone,
      reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildConfirmationMessage(
  stay: ConfirmedStay,
  hotel: { name: string; address: string | null },
): string {
  const stayLine = stay.room
    ? `🛏️ Quarto ${stay.room.number} — ${stay.roomType.name}`
    : `Acomodação: ${stay.roomType.name}`;

  return [
    `Olá, ${stay.guest.name}! 👋`,
    "",
    `Sua reserva ${stay.code} foi confirmada.`,
    "",
    stayLine,
    `📅 Período: ${stay.periodLabel}`,
    `💰 ${stay.pricingSummary}`,
    ...(hotel.address ? ["", `📍 Endereço: ${hotel.address}`] : []),
    "",
    `Aguardamos você. Qualquer dúvida, responda esta mensagem.`,
    `— ${hotel.name}`,
  ].join("\n");
}

function buildCleaningMessage(
  zeladorName: string,
  rooms: CleaningRoom[],
  hotelName: string,
): string {
  if (rooms.length === 0) {
    return [
      `Olá, ${zeladorName}! 👋`,
      "",
      `🧹 Há quartos que precisam de limpeza.`,
      "",
      `Por favor, verifique assim que possível.`,
      `— ${hotelName}`,
    ].join("\n");
  }

  if (rooms.length === 1) {
    const room = rooms[0]!;
    const floorLine =
      room.floor !== null ? `${room.floor}º andar` : "Andar não informado";

    return [
      `Olá, ${zeladorName}! 👋`,
      "",
      `🧹 O quarto ${room.number} (${room.roomType.name}) precisa de limpeza.`,
      `🏢 ${floorLine}`,
      "",
      `Por favor, verifique assim que possível.`,
      `— ${hotelName}`,
    ].join("\n");
  }

  const roomLines = rooms.map((room) => {
    const floorLine =
      room.floor !== null ? `${room.floor}º andar` : "Andar não informado";
    return `• Quarto ${room.number} (${room.roomType.name}) — ${floorLine}`;
  });

  return [
    `Olá, ${zeladorName}! 👋`,
    "",
    `🧹 Os seguintes quartos precisam de limpeza:`,
    "",
    ...roomLines,
    "",
    `Por favor, verifique assim que possível.`,
    `— ${hotelName}`,
  ].join("\n");
}

export async function notifyReservationConfirmed(
  stay: ConfirmedStay,
): Promise<MessageNotification> {
  const phone = toWhatsAppPhone(stay.guest.phone);
  if (!phone) {
    return {
      sent: false,
      skipped: "no_phone",
      reason: "Guest has no phone number",
    };
  }

  const hotel = await prisma.hotel.findUnique({ where: { id: stay.hotelId } });
  const hotelName = hotel?.name ?? propertyName();
  const address = hotel
    ? [
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
      ]
        .filter(Boolean)
        .join(" — ") || null
    : null;

  return sendTextMessage(
    phone,
    buildConfirmationMessage(stay, { name: hotelName, address }),
    `reservation ${stay.code}`,
    stay.hotelId,
  );
}

export async function notifyZeladoresRoomCleaning(
  hotelId: string,
  rooms: CleaningRoom[],
): Promise<BulkMessageNotification> {
  const [zeladores, hotel] = await Promise.all([
    prisma.zelador.findMany({
      where: { hotelId },
      orderBy: { name: "asc" },
    }),
    prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { name: true },
    }),
  ]);

  if (zeladores.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, total: 0, recipients: [] };
  }

  const hotelName = hotel?.name ?? propertyName();
  const roomLabel = rooms.map((room) => room.number).join(", ") || "unknown";

  const recipients = await Promise.all(
    zeladores.map(async (zelador) => {
      const phone = toWhatsAppPhone(zelador.phone);
      if (!phone) {
        return {
          sent: false,
          skipped: "no_phone" as const,
          reason: `Invalid phone for ${zelador.name}`,
        };
      }

      return sendTextMessage(
        phone,
        buildCleaningMessage(zelador.name, rooms, hotelName),
        `cleaning rooms ${roomLabel} → ${zelador.name}`,
        hotelId,
      );
    }),
  );

  return {
    sent: recipients.filter((item) => item.sent).length,
    failed: recipients.filter((item) => item.skipped === "api_error").length,
    skipped: recipients.filter(
      (item) =>
        item.skipped === "no_phone" || item.skipped === "not_configured",
    ).length,
    total: zeladores.length,
    recipients,
  };
}
