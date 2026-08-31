export function brl(value: number | string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function dateBR(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

export function dateTimeBR(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function notificationFeedback(base: string, result: unknown): string {
  if (!result || typeof result !== "object" || !("notification" in result)) {
    return base;
  }

  const notification = (result as { notification?: unknown }).notification;
  if (!notification || typeof notification !== "object") return base;

  if ("total" in notification && typeof notification.total === "number") {
    const bulk = notification as {
      sent: number;
      failed: number;
      total: number;
    };
    if (bulk.total === 0) {
      return `${base} Nenhum zelador cadastrado para avisar.`;
    }
    if (bulk.sent === bulk.total) {
      return `${base} WhatsApp enviado para ${bulk.sent} zelador(es).`;
    }
    if (bulk.sent > 0) {
      return `${base} WhatsApp enviado para ${bulk.sent} de ${bulk.total} zelador(es).`;
    }
    return `${base} Não foi possível avisar os zeladores.`;
  }

  const single = notification as { sent: boolean; skipped?: string };
  if (single.sent) return `${base} WhatsApp enviado ao hóspede.`;
  if (single.skipped === "no_phone") {
    return `${base} Hóspede sem telefone — mensagem não enviada.`;
  }
  if (single.skipped === "api_error") {
    return `${base} Não foi possível enviar o WhatsApp.`;
  }
  return base;
}

export function cpfMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}
