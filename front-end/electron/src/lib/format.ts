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

/** Traduz mensagens técnicas comuns da API/rede para português. */
export function ptError(message: unknown): string {
  const raw =
    typeof message === "string"
      ? message
      : message instanceof Error
        ? message.message
        : "Ocorreu um erro inesperado.";

  const text = raw.trim();
  if (!text) return "Ocorreu um erro inesperado.";

  const lower = text.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed")
  ) {
    return "Não foi possível conectar à API. Verifique sua conexão.";
  }

  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Sessão expirada ou acesso não autorizado. Faça login novamente.";
  }

  if (lower.includes("forbidden") || lower.includes("403")) {
    return "Você não tem permissão para esta ação.";
  }

  if (lower.includes("not found") || lower.includes("404")) {
    return "Registro não encontrado.";
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "A requisição demorou demais. Tente novamente.";
  }

  if (lower.includes("internal server error") || lower.includes("500")) {
    return "Erro interno no servidor. Tente novamente em instantes.";
  }

  const known: Record<string, string> = {
    "Room not found": "Quarto não encontrado.",
    "Room type not found": "Tipo de quarto não encontrado.",
    "Guest not found": "Hóspede não encontrado.",
    "Reservation not found": "Reserva não encontrada.",
    "Cannot delete room with active reservations":
      "Não é possível excluir um quarto com reservas ativas.",
    "Invalid credentials": "Telefone ou senha inválidos.",
    "Hotel already registered": "Este hotel já está cadastrado.",
  };

  return known[text] ?? text;
}
