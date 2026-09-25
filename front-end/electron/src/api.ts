import type {
  Availability,
  ChargeCategory,
  Dashboard,
  Guest,
  HousekeepingBoard,
  Zelador,
  Payment,
  Product,
  Reservation,
  Room,
  RoomType,
} from "./types";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "staydesck_token";
const HOTEL_KEY = "staydesck_hotel";

export type PlanCode = "SIMPLES" | "PRO" | "PLUS";
export type PlanFeature = "messaging" | "catalog";

export type PlanCatalogEntry = {
  label: string;
  priceCents: number;
  features: PlanFeature[];
};

export type HotelSubscription = {
  plan: PlanCode;
  effectivePlan: PlanCode;
  downgraded: boolean;
  status: "ACTIVE" | "PAST_DUE" | "CANCELLED";
  paidUntil: string | null;
  label: string;
  priceLabel: string;
  catalog: Record<PlanCode, PlanCatalogEntry>;
  features: {
    messaging: boolean;
    catalog: boolean;
  };
  billing: {
    stripeEnabled: boolean;
    hasSubscription: boolean;
  };
};

export type AuthHotel = {
  id: string;
  name: string;
  ownerName: string;
  cnpj: string | null;
  cnpjFormatted: string | null;
  phone: string;
  logoUrl: string | null;
  address: {
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    formatted: string | null;
  };
  subscription: HotelSubscription;
  slug: string | null;
  catalogEnabled: boolean;
  catalogHeadline: string | null;
  catalogRules: string | null;
};

export class PlanRequiredError extends Error {
  status = 402;
  constructor(message: string) {
    super(message);
    this.name = "PlanRequiredError";
  }
}

export type AuthSession = {
  token: string;
  hotel: AuthHotel;
};

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredHotel(): AuthHotel | null {
  const raw = localStorage.getItem(HOTEL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthHotel;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(HOTEL_KEY, JSON.stringify(session.hotel));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(HOTEL_KEY);
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) headers["Content-Type"] = "application/json";

  const useAuth = init?.auth !== false;
  if (useAuth) {
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (response.status === 401 && useAuth) {
    clearSession();
    window.dispatchEvent(new Event("staydesck:unauthorized"));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error ?? `Falha na requisição (${response.status})`;
    if (response.status === 402) throw new PlanRequiredError(message);
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown, auth = true) =>
  request<T>(path, { method: "POST", body, auth });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body });
const del = (path: string) => request<void>(path, { method: "DELETE" });

async function uploadFormData<T>(
  path: string,
  formData: FormData,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (response.status === 401) {
    clearSession();
    window.dispatchEvent(new Event("staydesck:unauthorized"));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.error ?? `Falha na requisição (${response.status})`;
    if (response.status === 402) throw new PlanRequiredError(message);
    throw new Error(message);
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
  uploads: {
    images: (files: File[], folder: "hotel-rooms" | "hotel-room-types" | "hotel-logos") => {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);
      return uploadFormData<{ urls: string[] }>(
        `/uploads/images?folder=${encodeURIComponent(folder)}`,
        formData,
      );
    },
  },

  auth: {
    register: (body: {
      name: string;
      ownerName: string;
      cnpj?: string | null;
      phone: string;
      password: string;
    }) => post<AuthSession>("/auth/register", body, false),
    login: (body: { phone: string; password: string }) =>
      post<AuthSession>("/auth/login", body, false),
    me: () => get<{ hotel: AuthHotel }>("/auth/me"),
    update: (body: {
      name?: string;
      ownerName?: string;
      cnpj?: string | null;
      phone?: string;
      password?: string;
      currentPassword?: string;
      logoUrl?: string | null;
      street?: string | null;
      number?: string | null;
      complement?: string | null;
      neighborhood?: string | null;
      city?: string | null;
      state?: string | null;
      zipCode?: string | null;
    }) =>
      request<{ hotel: AuthHotel }>("/auth/me", {
        method: "PATCH",
        body,
      }),
  },

  dashboard: (date?: string) => get<Dashboard>(`/dashboard${query({ date })}`),

  roomTypes: {
    list: () => get<RoomType[]>("/room-types"),
    create: (body: {
      name: string;
      description?: string;
      capacity: number;
      basePrice: number;
      amenities?: string[];
      photos?: string[];
    }) => post<RoomType>("/room-types", body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<RoomType>(`/room-types/${id}`, body),
    remove: (id: string) => del(`/room-types/${id}`),
  },

  rooms: {
    list: (filters?: { status?: string; roomTypeId?: string }) =>
      get<Room[]>(`/rooms${query(filters ?? {})}`),
    create: (body: {
      number: string;
      floor?: number;
      roomTypeId: string;
      capacity?: number;
      dailyPrice?: number;
      amenities?: string[];
      photos?: string[];
      status?: string;
    }) => post<Room>("/rooms", body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<Room>(`/rooms/${id}`, body),
    remove: (id: string) => del(`/rooms/${id}`),
  },

  guests: {
    list: (search?: string) => get<Guest[]>(`/guests${query({ q: search })}`),
    detail: (id: string) => get<Guest>(`/guests/${id}`),
    create: (body: Record<string, unknown>) => post<Guest>("/guests", body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<Guest>(`/guests/${id}`, body),
    remove: (id: string) => del(`/guests/${id}`),
  },

  availability: (params: {
    checkInDate: string;
    checkOutDate: string;
    guests: number;
  }) => get<Availability>(`/availability${query(params)}`),

  reservations: {
    list: (status?: string) =>
      get<Reservation[]>(`/reservations${query({ status })}`),
    detail: (id: string) => get<Reservation>(`/reservations/${id}`),
    create: (body: {
      guestId: string;
      roomIds: string[];
      checkInDate: string;
      checkOutDate: string;
      guests: number;
      nightlyRate?: number;
      notes?: string;
      status?: "PENDING" | "CONFIRMED";
    }) => post<Reservation>("/reservations", body),
    update: (
      id: string,
      body: {
        guestId?: string;
        roomIds?: string[];
        checkInDate?: string;
        checkOutDate?: string;
        guests?: number;
        nightlyRate?: number;
        notes?: string | null;
      },
    ) => patch<Reservation>(`/reservations/${id}`, body),
    remove: (id: string) => del(`/reservations/${id}`),
    confirm: (id: string, body?: { roomId?: string }) =>
      post<Reservation>(`/reservations/${id}/confirm`, body ?? {}),
    cancel: (id: string) => post<Reservation>(`/reservations/${id}/cancel`, {}),
    checkIn: (id: string, body?: { roomId?: string }) =>
      post<Reservation>(`/reservations/${id}/check-in`, body ?? {}),
    checkOut: (
      id: string,
      body?: { payment?: { method: string; amount: number; notes?: string } },
    ) => post<Reservation>(`/reservations/${id}/check-out`, body ?? {}),
    extend: (id: string, body: { checkOutDate: string }) =>
      post<Reservation>(`/reservations/${id}/extend`, body),
    addCharge: (
      id: string,
      body:
        | { productId: string; quantity: number; note?: string }
        | {
            categoryId: string;
            description: string;
            amount: number;
            quantity?: number;
          },
    ) => post(`/reservations/${id}/charges`, body),
    addChargesBatch: (
      id: string,
      body: {
        items: Array<
          | { productId: string; quantity: number; note?: string }
          | {
              categoryId: string;
              description: string;
              amount: number;
              quantity?: number;
            }
        >;
      },
    ) => post(`/reservations/${id}/charges/batch`, body),
    updateCharge: (
      id: string,
      chargeId: string,
      body: {
        categoryId?: string;
        description?: string;
        amount?: number;
        quantity?: number;
        type?: string;
      },
    ) => patch(`/reservations/${id}/charges/${chargeId}`, body),
    removeCharge: (id: string, chargeId: string) =>
      del(`/reservations/${id}/charges/${chargeId}`),
  },

  chargeCategories: {
    list: (filters?: { active?: boolean }) =>
      get<ChargeCategory[]>(
        `/charge-categories${query({
          active:
            filters?.active === undefined
              ? undefined
              : filters.active
                ? "true"
                : "false",
        })}`,
      ),
    create: (body: {
      name: string;
      group: string;
      icon?: string | null;
      position?: number;
    }) => post<ChargeCategory>("/charge-categories", body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<ChargeCategory>(`/charge-categories/${id}`, body),
    remove: (id: string) => del(`/charge-categories/${id}`),
  },

  products: {
    list: (filters?: {
      categoryId?: string;
      q?: string;
      active?: boolean;
    }) =>
      get<Product[]>(
        `/products${query({
          categoryId: filters?.categoryId,
          q: filters?.q,
          active:
            filters?.active === undefined
              ? undefined
              : filters.active
                ? "true"
                : "false",
        })}`,
      ),
    create: (body: {
      categoryId: string;
      name: string;
      code?: string | null;
      price: number;
      unit?: string | null;
      position?: number;
    }) => post<Product>("/products", body),
    createBatch: (body: {
      categoryId: string;
      items: Array<{
        name: string;
        price: number;
        code?: string | null;
        unit?: string | null;
      }>;
    }) => post<Product[]>("/products/batch", body),
    update: (id: string, body: Record<string, unknown>) =>
      patch<Product>(`/products/${id}`, body),
    remove: (id: string) => del(`/products/${id}`),
  },

  payments: {
    list: (reservationId: string) =>
      get<{ payments: Payment[] }>(`/reservations/${reservationId}/payments`),
    create: (
      reservationId: string,
      body: {
        method: string;
        amount: number;
        status?: "PENDING" | "CONFIRMED";
        notes?: string;
      },
    ) => post(`/reservations/${reservationId}/payments`, body),
    confirm: (paymentId: string) => post(`/payments/${paymentId}/confirm`, {}),
    cancel: (paymentId: string) => post(`/payments/${paymentId}/cancel`, {}),
    refund: (paymentId: string, body?: { amount?: number; notes?: string }) =>
      post(`/payments/${paymentId}/refund`, body ?? {}),
  },

  housekeeping: {
    board: (status?: string) =>
      get<HousekeepingBoard>(`/housekeeping${query({ status })}`),
    ready: (roomId: string) => post(`/housekeeping/${roomId}/ready`, {}),
    startCleaning: (roomId: string) =>
      post(`/housekeeping/${roomId}/start-cleaning`, {}),
    maintenance: (roomId: string) =>
      post(`/housekeeping/${roomId}/maintenance`, {}),
    releaseMaintenance: (roomId: string) =>
      post(`/housekeeping/${roomId}/release-maintenance`, {}),
    zeladores: {
      list: () => get<Zelador[]>("/housekeeping/zeladores"),
      create: (body: { name: string; phone: string }) =>
        post<Zelador>("/housekeeping/zeladores", body),
      update: (id: string, body: Partial<{ name: string; phone: string }>) =>
        patch<Zelador>(`/housekeeping/zeladores/${id}`, body),
      remove: (id: string) => del(`/housekeeping/zeladores/${id}`),
    },
  },

  whatsapp: {
    status: () => get<WhatsAppStatus>("/whatsapp/status"),
    setup: () => post<WhatsAppStatus>("/whatsapp/setup", {}),
    refreshQr: () => post<WhatsAppStatus>("/whatsapp/qrcode/refresh", {}),
    pollQr: () => get<WhatsAppStatus>("/whatsapp/qrcode"),
    disconnect: () => post<WhatsAppStatus>("/whatsapp/disconnect", {}),
    removeInstance: () =>
      request<WhatsAppStatus>("/whatsapp/instance", { method: "DELETE" }),
  },

  catalog: {
    get: () => get<CatalogSettings>("/catalog"),
    update: (body: {
      catalogEnabled?: boolean;
      catalogHeadline?: string | null;
      catalogRules?: string | null;
    }) =>
      patch<{
        catalogEnabled: boolean;
        slug: string | null;
        publicUrl: string | null;
        headline: string | null;
        rules: string | null;
      }>("/catalog", body),
  },

  billing: {
    status: () =>
      get<{
        enabled: boolean;
        plans: { SIMPLES: boolean; PRO: boolean; PLUS: boolean };
      }>("/billing/status"),
    checkout: (plan: PlanCode) =>
      post<{ url: string }>("/billing/checkout", { plan }),
    portal: () => post<{ url: string }>("/billing/portal", {}),
  },
};

export type CatalogSettings = {
  catalogEnabled: boolean;
  slug: string | null;
  publicUrl: string | null;
  headline: string | null;
  rules: string | null;
  roomTypesWithoutPhotos: Array<{ id: string; name: string }>;
  canEnable: boolean;
};

export type WhatsAppStatus = {
  configured: boolean;
  instanceId: string | null;
  status: string;
  connected: boolean;
  phoneNumber: string | null;
  qrCode: string | null;
  hotelName?: string | null;
  sendApiBaseUrl?: string;
  message?: string;
};
