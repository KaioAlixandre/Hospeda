const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_API_URL = "http://216.22.5.245:3333";

function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/**
 * Valida e normaliza a URL da API (só http/https, sem barra final).
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizeApiBaseUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** HTTP sem TLS para fora da máquina: credenciais em texto puro na rede. */
function isInsecureRemote(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && !isLocalHost(parsed.hostname);
  } catch {
    return false;
  }
}

function settingsPath(userDataPath) {
  return path.join(userDataPath, "api-settings.json");
}

function readStoredApiBaseUrl(userDataPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(userDataPath), "utf8"));
    return normalizeApiBaseUrl(raw?.apiBaseUrl);
  } catch {
    return null;
  }
}

function saveApiBaseUrl(userDataPath, url) {
  const normalized = normalizeApiBaseUrl(url);
  if (!normalized) {
    throw new Error(
      "URL inválida. Use um endereço http:// ou https:// completo (ex.: https://api.seudominio.com.br).",
    );
  }

  fs.writeFileSync(
    settingsPath(userDataPath),
    `${JSON.stringify({ apiBaseUrl: normalized }, null, 2)}\n`,
    "utf8",
  );
  return normalized;
}

function clearStoredApiBaseUrl(userDataPath) {
  try {
    fs.unlinkSync(settingsPath(userDataPath));
  } catch {
    // arquivo inexistente — ok
  }
}

/**
 * Resolução: STAYDESCK_API_URL → arquivo em userData → localhost.
 * @param {string} userDataPath
 */
function resolveApiBaseUrl(userDataPath) {
  const fromEnv = normalizeApiBaseUrl(
    process.env.STAYDESCK_API_URL || process.env.HOSPEDA_API_URL,
  );
  if (fromEnv) return { apiBaseUrl: fromEnv, source: "env" };

  const stored = readStoredApiBaseUrl(userDataPath);
  if (stored) return { apiBaseUrl: stored, source: "file" };

  return { apiBaseUrl: DEFAULT_API_URL, source: "default" };
}

module.exports = {
  DEFAULT_API_URL,
  normalizeApiBaseUrl,
  isInsecureRemote,
  settingsPath,
  readStoredApiBaseUrl,
  saveApiBaseUrl,
  clearStoredApiBaseUrl,
  resolveApiBaseUrl,
};
