export function brl(value: number | string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Digits-only → "12,34" while typing a BRL amount. */
export function moneyInputMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  const cents = Number(digits);
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, "0");
  return `${reais.toLocaleString("pt-BR")},${centavos}`;
}

/** Parse "12,34" / "R$ 12,34" / "12.34" → number. */
export function parseMoneyInput(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return NaN;
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  }
  return Number(cleaned);
}

/** Format a number for a money input field (pt-BR). */
export function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

export function cnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

export function cpfMask(value: string | null | undefined): string {
  if (!value) return "—";
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

  const isPlanRequired =
    (message instanceof Error && message.name === "PlanRequiredError") ||
    lower.includes("402") ||
    lower.includes("payment required") ||
    lower.includes("plan required");

  if (isPlanRequired) {
    return /plano/i.test(text)
      ? text
      : "Este recurso exige um plano superior. Veja Configurações → Plano.";
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
    "Only in-house reservations can be extended":
      "Só é possível prorrogar reservas com hóspede hospedado.",
    "Reservation has no assigned rooms":
      "A reserva não tem quarto atribuído.",
    "New check-out date must be after the current check-out date":
      "A nova data de saída deve ser posterior à data atual de check-out.",
    "checkOutDate must be after checkInDate":
      "A data de saída deve ser posterior à de entrada.",
    "One or more rooms are not available for the extended dates":
      "Um ou mais quartos não estão disponíveis no período prorrogado.",
  };

  if (lower.startsWith("room(s) ") && lower.includes("not available for the extended")) {
    const match = text.match(/Room\(s\) (.+) not available/i);
    return match
      ? `Quarto(s) ${match[1]} indisponível(is) no período prorrogado.`
      : known["One or more rooms are not available for the extended dates"];
  }

  return known[text] ?? text;
}
