import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { hotelIdFrom } from "../middleware/auth.js";
import { AppError } from "../middleware/errorHandler.js";
import * as sendApi from "../services/sendApi.js";

export const whatsappRouter = Router();

type HotelMessaging = {
  id: string;
  name: string;
  messagingInstanceId: string | null;
  messagingToken: string | null;
  messagingClientToken: string | null;
};

async function getHotel(hotelId: string): Promise<HotelMessaging> {
  const hotel = await prisma.hotel.findUnique({
    where: { id: hotelId },
    select: {
      id: true,
      name: true,
      messagingInstanceId: true,
      messagingToken: true,
      messagingClientToken: true,
    },
  });
  if (!hotel) throw new AppError(404, "Hotel not found");
  return hotel;
}

async function saveCredentials(
  hotelId: string,
  { instanceId, token }: { instanceId: string; token: string },
) {
  return prisma.hotel.update({
    where: { id: hotelId },
    data: {
      messagingInstanceId: instanceId,
      messagingToken: token,
      messagingClientToken: token,
    },
    select: {
      id: true,
      name: true,
      messagingInstanceId: true,
      messagingToken: true,
      messagingClientToken: true,
    },
  });
}

async function clearCredentials(hotelId: string) {
  return prisma.hotel.update({
    where: { id: hotelId },
    data: {
      messagingInstanceId: null,
      messagingToken: null,
      messagingClientToken: null,
    },
  });
}

function buildStatusPayload({
  hotel,
  remote = null,
  qrCode = null,
}: {
  hotel: HotelMessaging | null;
  remote?: {
    status?: string;
    connected?: boolean;
    runtimeConnected?: boolean;
    phoneNumber?: string | null;
  } | null;
  qrCode?: string | null;
}) {
  const instanceId = hotel?.messagingInstanceId || null;
  const hasCredentials = Boolean(
    instanceId && hotel?.messagingToken && hotel?.messagingClientToken,
  );
  const connected = Boolean(
    remote?.runtimeConnected ||
      remote?.connected ||
      String(remote?.status || "").toUpperCase() === "CONNECTED",
  );

  return {
    configured: hasCredentials,
    instanceId,
    status: remote?.status || (hasCredentials ? "UNKNOWN" : "NONE"),
    connected,
    phoneNumber: remote?.phoneNumber || null,
    qrCode: qrCode || null,
    hotelName: hotel?.name || null,
    sendApiBaseUrl: sendApi.getSendApiBaseUrl(),
  };
}

async function waitForQr(instanceId: string) {
  let qrPayload = await sendApi.refreshQrCode(instanceId);
  let qrCode = qrPayload?.qrCode || null;

  if (!qrCode && !(qrPayload?.connected || qrPayload?.runtimeConnected)) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((r) => setTimeout(r, 800));
      const poll = await sendApi.getQrCode(instanceId);
      if (poll?.qrCode) {
        qrCode = poll.qrCode;
        qrPayload = poll;
        break;
      }
      if (poll?.connected || poll?.runtimeConnected) {
        qrPayload = poll;
        break;
      }
    }
  }

  return { qrPayload, qrCode };
}

whatsappRouter.get("/status", async (req, res, next) => {
  try {
    const hotel = await getHotel(hotelIdFrom(req));
    if (!hotel.messagingInstanceId) {
      return res.json(buildStatusPayload({ hotel }));
    }

    let remote = null;
    let qrCode: string | null = null;
    try {
      remote = await sendApi.getInstance(hotel.messagingInstanceId);
      if (
        !remote?.runtimeConnected &&
        String(remote?.status || "").toUpperCase() !== "CONNECTED"
      ) {
        const qr = await sendApi.getQrCode(hotel.messagingInstanceId);
        qrCode = qr?.qrCode || null;
        if (qr?.connected || qr?.runtimeConnected) {
          remote = {
            ...(remote || {}),
            status: "CONNECTED",
            runtimeConnected: true,
            connected: true,
          };
        }
      }
    } catch (err) {
      console.warn(
        "[WhatsApp] Falha ao consultar status na Send-API:",
        err instanceof Error ? err.message : err,
      );
    }

    return res.json(buildStatusPayload({ hotel, remote, qrCode }));
  } catch (err) {
    next(err);
  }
});

whatsappRouter.post("/setup", async (req, res, next) => {
  try {
    let hotel = await getHotel(hotelIdFrom(req));
    let instanceId = hotel.messagingInstanceId || null;
    let token = hotel.messagingToken || hotel.messagingClientToken || null;

    if (!instanceId || !token) {
      const created = await sendApi.createInstance(
        `Hospeda - ${hotel.name || hotel.id}`,
      );
      instanceId = created.id;
      token = created.token;
      if (!instanceId || !token) {
        throw new AppError(502, "Send-API não retornou id/token da instância.");
      }
      hotel = await saveCredentials(hotel.id, { instanceId, token });
    } else if (hotel.messagingToken !== hotel.messagingClientToken) {
      hotel = await saveCredentials(hotel.id, { instanceId, token });
    }

    const { qrPayload, qrCode } = await waitForQr(instanceId);
    const remote = await sendApi.getInstance(instanceId).catch(() => null);
    const connected = Boolean(
      qrPayload?.connected ||
        qrPayload?.runtimeConnected ||
        remote?.runtimeConnected,
    );

    return res.json({
      ...buildStatusPayload({
        hotel,
        remote: {
          ...(remote || {}),
          status: connected ? "CONNECTED" : remote?.status || "CONNECTING",
          connected,
          runtimeConnected: connected,
        },
        qrCode,
      }),
      message: connected
        ? "WhatsApp já está conectado."
        : qrCode
          ? "Escaneie o QR Code com o WhatsApp do celular."
          : "Conexão iniciada. Aguarde o QR Code ou atualize.",
    });
  } catch (err) {
    next(err);
  }
});

whatsappRouter.post("/qrcode/refresh", async (req, res, next) => {
  try {
    const hotel = await getHotel(hotelIdFrom(req));
    if (!hotel.messagingInstanceId) {
      throw new AppError(
        400,
        'Nenhuma instância configurada. Use "Criar e conectar" primeiro.',
      );
    }

    const { qrCode } = await waitForQr(hotel.messagingInstanceId);
    const remote = await sendApi
      .getInstance(hotel.messagingInstanceId)
      .catch(() => null);

    return res.json(buildStatusPayload({ hotel, remote, qrCode }));
  } catch (err) {
    next(err);
  }
});

whatsappRouter.get("/qrcode", async (req, res, next) => {
  try {
    const hotel = await getHotel(hotelIdFrom(req));
    if (!hotel.messagingInstanceId) {
      return res.json(buildStatusPayload({ hotel }));
    }

    const qr = await sendApi.getQrCode(hotel.messagingInstanceId);
    const remote = await sendApi
      .getInstance(hotel.messagingInstanceId)
      .catch(() => null);
    const connected = Boolean(
      qr?.connected || qr?.runtimeConnected || remote?.runtimeConnected,
    );

    return res.json(
      buildStatusPayload({
        hotel,
        remote: {
          ...(remote || {}),
          connected,
          runtimeConnected: connected,
          status: connected ? "CONNECTED" : remote?.status || "CONNECTING",
        },
        qrCode: qr?.qrCode || null,
      }),
    );
  } catch (err) {
    next(err);
  }
});

whatsappRouter.post("/disconnect", async (req, res, next) => {
  try {
    const hotel = await getHotel(hotelIdFrom(req));
    if (!hotel.messagingInstanceId || !hotel.messagingToken) {
      throw new AppError(400, "Nenhuma instância configurada.");
    }

    await sendApi.disconnectInstance(
      hotel.messagingInstanceId,
      hotel.messagingClientToken || hotel.messagingToken,
    );
    const remote = await sendApi
      .getInstance(hotel.messagingInstanceId)
      .catch(() => ({ status: "DISCONNECTED" }));

    return res.json({
      ...buildStatusPayload({ hotel, remote }),
      message: "WhatsApp desconectado.",
    });
  } catch (err) {
    next(err);
  }
});

whatsappRouter.delete("/instance", async (req, res, next) => {
  try {
    const hotel = await getHotel(hotelIdFrom(req));
    if (hotel.messagingInstanceId) {
      try {
        await sendApi.deleteInstance(hotel.messagingInstanceId);
      } catch (err) {
        console.warn(
          "[WhatsApp] Falha ao deletar instância na Send-API (seguindo com limpeza local):",
          err instanceof Error ? err.message : err,
        );
      }
    }
    await clearCredentials(hotel.id);
    return res.json({
      ...buildStatusPayload({ hotel: null }),
      message: "Instância removida.",
    });
  } catch (err) {
    next(err);
  }
});
