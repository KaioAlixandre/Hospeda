const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3333"
).replace(/\/$/, "");

export type PublicHotel = {
  name: string;
  phone: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  headline: string | null;
  rules: string | null;
};

export type PublicRoomType = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  amenities: string[];
  photos: string[];
  priceFrom: number;
};

export type AvailabilityOption = {
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  nightlyRate: number;
  nights: number;
  total: number;
};

export type AvailabilityResponse = {
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  options: AvailabilityOption[];
};

export type ReservationResult = {
  code: string;
  checkInDate: string;
  checkOutDate: string;
  total: number;
  hotel: { name: string; phone: string };
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error ?? `Falha na requisição (${response.status})`,
    );
  }

  return (await response.json()) as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const api = {
  hotel: (slug: string) =>
    request<{ hotel: PublicHotel }>(`/public/hotels/${encodeURIComponent(slug)}`),

  rooms: (slug: string) =>
    request<{ rooms: PublicRoomType[] }>(
      `/public/hotels/${encodeURIComponent(slug)}/rooms`,
    ),

  availability: (
    slug: string,
    params: { checkIn: string; checkOut: string; guests: number },
  ) =>
    request<AvailabilityResponse>(
      `/public/hotels/${encodeURIComponent(slug)}/availability${query(params)}`,
    ),

  reserve: (
    slug: string,
    body: {
      checkInDate: string;
      checkOutDate: string;
      guests: number;
      roomTypeId: string;
      guest: {
        name: string;
        phone: string;
        email?: string;
        city?: string;
      };
      website?: string;
    },
  ) =>
    request<ReservationResult>(
      `/public/hotels/${encodeURIComponent(slug)}/reservations`,
      { method: "POST", body: JSON.stringify(body) },
    ),
};
