const FALLBACK_PHONE = "5511999999999";

export function salesWhatsAppPhone(): string {
  const raw = import.meta.env.VITE_SALES_WHATSAPP ?? FALLBACK_PHONE;
  const digits = String(raw).replace(/\D/g, "");
  return digits || FALLBACK_PHONE;
}

export function salesWhatsAppUrl(message: string): string {
  return `https://wa.me/${salesWhatsAppPhone()}?text=${encodeURIComponent(message)}`;
}

export function openSalesWhatsApp(message: string) {
  window.open(salesWhatsAppUrl(message), "_blank", "noopener,noreferrer");
}
