import type { CorsOptions } from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";

/**
 * CORS_ORIGINS vazio mantém o comportamento atual (qualquer origem), porque o
 * aplicativo desktop carrega de file:// e envia Origin nulo ou nenhum.
 */
export function buildCorsOptions(): CorsOptions {
  const configured = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length === 0) {
    console.warn(
      "AVISO: CORS_ORIGINS não definido — a API aceita requisições de qualquer origem.",
    );
    return { origin: true };
  }

  const allowed = new Set(configured);

  return {
    origin(origin, callback) {
      // Sem cabeçalho Origin: cliente nativo (app desktop, curl, mobile).
      if (!origin) return callback(null, true);
      if (allowed.has(origin)) return callback(null, true);
      callback(new Error("Origem não permitida por CORS"));
    },
  };
}

/** Atrás de proxy reverso, o IP real vem no X-Forwarded-For. */
export function trustProxySetting(): boolean | number {
  const raw = process.env.TRUST_PROXY?.trim();
  if (!raw) return false;
  const asNumber = Number(raw);
  if (Number.isInteger(asNumber) && asNumber >= 0) return asNumber;
  return raw.toLowerCase() === "true" || raw === "1";
}

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em instantes." },
});

/**
 * Login por telefone (fácil de enumerar) com senha de 6 caracteres:
 * força bruta era só questão de tempo.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 10),
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Limita por IP + telefone, para uma recepção não bloquear a outra.
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req.ip ?? "");
    const phone =
      typeof req.body?.phone === "string"
        ? req.body.phone.replace(/\D/g, "")
        : "";
    return `${ip}:${phone}`;
  },
  message: {
    error: "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
  },
});
