export const FALLBACK_API_URL = "http://localhost:3333";

export const API_BASE_URL =
  window.hospeda?.apiBaseUrl ||
  import.meta.env.VITE_API_URL ||
  FALLBACK_API_URL;

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

/** HTTP sem TLS para fora da máquina: credenciais em texto puro na rede. */
export function isInsecureApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && !isLocalHost(parsed.hostname);
  } catch {
    return false;
  }
}

export const API_IS_INSECURE = isInsecureApiUrl(API_BASE_URL);
