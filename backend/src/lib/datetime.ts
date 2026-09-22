export const HOTEL_TIME_ZONE =
  process.env.HOTEL_TIMEZONE?.trim() || "America/Sao_Paulo";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" do dia civil no fuso do hotel. */
export function hotelDayIso(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Meia-noite UTC da data civil — para comparar com colunas @db.Date. */
export function civilDateToUtcMidnight(iso: string): Date {
  if (!ISO_DATE.test(iso)) {
    throw new Error(`Data inválida: ${iso} (esperado YYYY-MM-DD)`);
  }
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Dia civil de hoje no fuso do hotel, como meia-noite UTC. */
export function startOfHotelDay(instant: Date = new Date()): Date {
  return civilDateToUtcMidnight(hotelDayIso(instant));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Diferença entre o horário do fuso e o UTC, no instante dado. */
function timeZoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HOTEL_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return asUtc - instant.getTime();
}

/** Janela absoluta [início, fim) do dia civil no fuso do hotel. */
export function hotelDayRange(iso: string): { start: Date; end: Date } {
  const utcMidnight = civilDateToUtcMidnight(iso).getTime();

  // Duas passadas cobrem a virada de horário de verão, caso volte a existir.
  const firstGuess = new Date(utcMidnight - timeZoneOffsetMs(new Date(utcMidnight)));
  const offset = timeZoneOffsetMs(firstGuess);
  const start = new Date(utcMidnight - offset);

  const nextUtcMidnight = addUtcDays(civilDateToUtcMidnight(iso), 1).getTime();
  const nextFirstGuess = new Date(
    nextUtcMidnight - timeZoneOffsetMs(new Date(nextUtcMidnight)),
  );
  const end = new Date(nextUtcMidnight - timeZoneOffsetMs(nextFirstGuess));

  return { start, end };
}
