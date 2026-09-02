import type {
  Availability,
  Dashboard,
  Guest,
  HousekeepingBoard,
  Zelador,
  Payment,
  Reservation,
  Room,
  RoomType,
} from "./types";
import { API_BASE_URL } from "./config";

const TOKEN_KEY = "hospeda_token";
const HOTEL_KEY = "hospeda_hotel";

export type AuthHotel = {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
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
};

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
    window.dispatchEvent(new Event("hospeda:unauthorized"));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Falha na requisição (${response.status})`);
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
    window.dispatchEvent(new Event("hospeda:unauthorized"));
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Falha na requisição (${response.status})`);
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
    images: (files: File[], folder: "hotel-rooms" | "hotel-room-types") => {
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
      phone: string;
      password: string;
    }) => post<AuthSession>("/auth/register", body, false),
    login: (body: { phone: string; password: string }) =>
      post<AuthSession>("/auth/login", body, false),
    me: () => get<{ hotel: AuthHotel }>("/auth/me"),
    update: (body: {
      name?: string;
      ownerName?: string;
      phone?: string;
      password?: string;
      currentPassword?: string;
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
    addCharge: (
      id: string,
      body: { type: string; description: string; amount: number },
    ) => post(`/reservations/${id}/charges`, body),
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
