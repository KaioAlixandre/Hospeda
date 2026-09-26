const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3333"
).replace(/\/$/, "");

const CATALOG_TOKEN_KEY = "staydesck_catalog_token";

let catalogAuthToken: string | null =
  typeof localStorage !== "undefined"
    ? localStorage.getItem(CATALOG_TOKEN_KEY)
    : null;

export function setCatalogAuthToken(token: string | null) {
  catalogAuthToken = token;
  if (token) localStorage.setItem(CATALOG_TOKEN_KEY, token);
  else localStorage.removeItem(CATALOG_TOKEN_KEY);
}

export function getCatalogAuthToken() {
  return catalogAuthToken;
}

export type PublicHotel = {
  name: string;
  phone: string;
  logoUrl: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  addressFormatted: string | null;
  headline: string | null;
  rules: string | null;
  coverPhotoUrl: string | null;
  galleryPhotos: string[];
  checkInTime: string | null;
  checkOutTime: string | null;
  brandColor: string | null;
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

export type RoomAvailability = {
  available: boolean;
  nights: number;
  nightlyRate: number;
  total: number;
};

export type RoomTypeDetailResponse = {
  room: PublicRoomType;
  availability: RoomAvailability | null;
};

export type AvailabilityOption = {
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  nightlyRate: number;
  nights: number;
  total: number;
  photos?: string[];
  amenities?: string[];
  description?: string | null;
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

export type ReservationSummary = {
  roomTypeId: string;
  roomName: string;
  photo: string | null;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  nightlyRate: number;
  total: number;
};

export type CatalogUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  hasPassword: boolean;
  googleLinked: boolean;
};

export type CatalogAuthConfig = {
  googleClientId: string | null;
  googleEnabled: boolean;
};

export type CatalogAuthSession = {
  token: string;
  user: CatalogUser;
};

export type CatalogStay = {
  code: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  statusLabel: string;
  source: "DESK" | "ONLINE";
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  nights: number;
  nightlyRate: number;
  total: number;
  expiresAt: string | null;
  createdAt: string;
  hotel: {
    name: string;
    slug: string | null;
    logoUrl: string | null;
  };
  roomType: {
    name: string;
    photo: string | null;
  };
  roomNumber: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (catalogAuthToken) {
    headers.Authorization = `Bearer ${catalogAuthToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
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
  auth: {
    config: () => request<CatalogAuthConfig>("/public/auth/config"),
    register: (body: {
      name: string;
      email: string;
      phone: string;
      password: string;
    }) =>
      request<CatalogAuthSession>("/public/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<CatalogAuthSession>("/public/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    google: (body: { credential: string }) =>
      request<CatalogAuthSession>("/public/auth/google", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    me: () => request<{ user: CatalogUser }>("/public/auth/me"),
    updateMe: (body: { name?: string; phone?: string }) =>
      request<{ user: CatalogUser }>("/public/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    reservations: () =>
      request<{ reservations: CatalogStay[] }>("/public/auth/reservations"),
  },

  hotel: (slug: string) =>
    request<{ hotel: PublicHotel }>(`/public/hotels/${encodeURIComponent(slug)}`),

  rooms: (slug: string) =>
    request<{ rooms: PublicRoomType[] }>(
      `/public/hotels/${encodeURIComponent(slug)}/rooms`,
    ),

  roomType: (
    slug: string,
    roomTypeId: string,
    params?: { checkIn?: string; checkOut?: string; guests?: number },
  ) =>
    request<RoomTypeDetailResponse>(
      `/public/hotels/${encodeURIComponent(slug)}/rooms/${encodeURIComponent(roomTypeId)}${query(params ?? {})}`,
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
      guest?: {
        name?: string;
        phone?: string;
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
