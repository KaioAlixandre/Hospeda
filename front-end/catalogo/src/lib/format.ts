export function brl(value: number | string): string {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function dateBR(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date);
}

/** Compact period like "12–15 out". */
export function periodShort(checkIn: string, checkOut: string): string {
  const a = new Date(`${checkIn}T00:00:00.000Z`);
  const b = new Date(`${checkOut}T00:00:00.000Z`);
  const dayA = a.getUTCDate();
  const dayB = b.getUTCDate();
  const month = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(b)
    .replace(".", "");
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${dayA}–${dayB} ${month}`;
  }
  const monthA = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(a)
    .replace(".", "");
  return `${dayA} ${monthA} – ${dayB} ${month}`;
}

export function todayISO(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

/** ISO YYYY-MM-DD → dd/MM/yyyy */
export function isoToBR(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** dd/MM/yyyy → ISO YYYY-MM-DD, or null if invalid calendar date */
export function brToISO(br: string): string | null {
  const match = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const probe = new Date(`${iso}T00:00:00.000Z`);
  if (
    Number.isNaN(probe.getTime()) ||
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return iso;
}

/** Digits → dd/MM/yyyy while typing */
export function dateMaskBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function locationLabel(
  city: string | null | undefined,
  state: string | null | undefined,
): string | null {
  if (city && state) return `${city}/${state}`;
  return city || state || null;
}

export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits ? `tel:+${digits.startsWith("55") ? digits : `55${digits}`}` : "#";
}

export function whatsappHref(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${text}`;
}

export function phoneMask(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function splitRules(rules: string | null | undefined): string[] {
  if (!rules?.trim()) return [];
  return rules
    .split(/\r?\n|[•;]+/)
    .map((line) => line.replace(/^[-–—]\s*/, "").trim())
    .filter(Boolean);
}

export function mapsHref(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}
