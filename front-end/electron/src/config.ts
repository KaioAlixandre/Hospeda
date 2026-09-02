/** URL padrão da API em produção (VPS). */
export const DEFAULT_API_URL = "http://216.22.5.245:3333";

export const API_BASE_URL =
  window.hospeda?.apiBaseUrl ??
  import.meta.env.VITE_API_URL ??
  DEFAULT_API_URL;
