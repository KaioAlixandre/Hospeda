import { AppError } from "../middleware/errorHandler.js";

const SEND_API_BASE_URL = (
  process.env.SEND_API_BASE_URL || "https://api.kaioalixandre.com.br"
).replace(/\/$/, "");

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

export function getSendApiBaseUrl() {
  return SEND_API_BASE_URL;
}

function assertServiceCredentials() {
  const email = (process.env.SEND_API_EMAIL || "").trim();
  const password = process.env.SEND_API_PASSWORD || "";
  const staticToken = (process.env.SEND_API_ACCESS_TOKEN || "").trim();
  if (!staticToken && (!email || !password)) {
    throw new AppError(
      503,
      "Credenciais da Send-API não configuradas. Defina SEND_API_EMAIL e SEND_API_PASSWORD (ou SEND_API_ACCESS_TOKEN) no .env do backend.",
    );
  }
  return { email, password, staticToken };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  const { email, password, staticToken } = assertServiceCredentials();

  if (staticToken && !email) return staticToken;

  const now = Date.now();
  if (!forceRefresh && cachedAccessToken && cachedTokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }

  if (staticToken && (!email || !password)) return staticToken;

  const response = await fetch(`${SEND_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await response.json().catch(() => null)) as {
    accessToken?: string;
    error?: string;
  } | null;

  if (!response.ok || !data?.accessToken) {
    throw new AppError(
      502,
      data?.error || "Send-API não retornou accessToken no login",
    );
  }

  cachedAccessToken = data.accessToken;
  const days = Number(process.env.SEND_API_JWT_DAYS || 25);
  cachedTokenExpiresAt = now + days * 24 * 60 * 60 * 1000;
  return cachedAccessToken;
}

type ApiResponse = {
  status: number;
  data: Record<string, unknown> | null;
};

async function sendApiRequest(
  method: string,
  path: string,
  options: { body?: unknown; forceAuthRefresh?: boolean } = {},
): Promise<ApiResponse> {
  const token = await getAccessToken(options.forceAuthRefresh ?? false);
  const response = await fetch(`${SEND_API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 401 && !options.forceAuthRefresh) {
    return sendApiRequest(method, path, {
      ...options,
      forceAuthRefresh: true,
    });
  }

  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  return { status: response.status, data };
}

function apiError(prefix: string, response: ApiResponse): never {
  const msg =
    (typeof response.data?.error === "string" && response.data.error) ||
    (typeof response.data?.message === "string" && response.data.message) ||
    `HTTP ${response.status}`;
  throw new AppError(
    response.status >= 400 && response.status < 600 ? response.status : 502,
    `${prefix}: ${msg}`,
  );
}

export async function createInstance(
  name: string,
  options: { webhookUrl?: string; webhookSecret?: string } = {},
) {
  const payload: Record<string, string> = {
    name: String(name || "Hospeda").trim() || "Hospeda",
  };
  if (options.webhookUrl) payload.webhookUrl = options.webhookUrl;
  if (options.webhookSecret) payload.webhookSecret = options.webhookSecret;

  const response = await sendApiRequest("POST", "/instances", { body: payload });
  if (response.status >= 400) apiError("Falha ao criar instância", response);
  return response.data as { id: string; token: string };
}

export async function getInstance(instanceId: string) {
  const response = await sendApiRequest("GET", `/instances/${instanceId}`);
  if (response.status === 404) return null;
  if (response.status >= 400) apiError("Falha ao buscar instância", response);
  return response.data as {
    status?: string;
    connected?: boolean;
    runtimeConnected?: boolean;
    phoneNumber?: string | null;
    webhookUrl?: string | null;
  };
}

export async function refreshQrCode(instanceId: string) {
  const response = await sendApiRequest(
    "POST",
    `/instances/${instanceId}/qrcode/refresh`,
  );
  if (response.status >= 400) apiError("Falha ao atualizar QR code", response);
  return response.data as {
    qrCode?: string | null;
    connected?: boolean;
    runtimeConnected?: boolean;
  };
}

export async function getQrCode(instanceId: string) {
  const response = await sendApiRequest("GET", `/instances/${instanceId}/qrcode`);
  if (response.status === 404) {
    return {
      connected: false,
      runtimeConnected: false,
      qrCode: null,
      notReady: true,
    };
  }
  if (response.status >= 400) apiError("Falha ao obter QR code", response);
  return response.data as {
    qrCode?: string | null;
    connected?: boolean;
    runtimeConnected?: boolean;
    notReady?: boolean;
  };
}

export async function disconnectInstance(
  instanceId: string,
  clientToken: string,
) {
  const token = await getAccessToken();
  const response = await fetch(
    `${SEND_API_BASE_URL}/instances/${instanceId}/disconnect`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Client-Token": clientToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(20_000),
    },
  );
  const data = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (response.status >= 400) {
    apiError("Falha ao desconectar", { status: response.status, data });
  }
  return data;
}

export async function deleteInstance(instanceId: string) {
  const response = await sendApiRequest("DELETE", `/instances/${instanceId}`);
  if (response.status === 404) return { success: true, alreadyGone: true };
  if (response.status >= 400) apiError("Falha ao remover instância", response);
  return response.data || { success: true };
}
