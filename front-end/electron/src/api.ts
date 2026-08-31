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

export const API_BASE_URL =
  window.hospeda?.apiBaseUrl ?? "http://localhost:3333";

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Falha na requisição (${response.status})`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body });
const del = (path: string) => request<void>(path, { method: "DELETE" });

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const api = {
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
    roomTypeId?: string;
    guests?: number;
  }) => get<Availability>(`/availability${query(params)}`),

  reservations: {
    list: (status?: string) =>
      get<Reservation[]>(`/reservations${query({ status })}`),
    detail: (id: string) => get<Reservation>(`/reservations/${id}`),
    create: (body: {
      guestId: string;
      roomTypeId: string;
      roomId?: string;
      checkInDate: string;
      checkOutDate: string;
      guests: number;
      notes?: string;
      status?: "PENDING" | "CONFIRMED";
    }) => post<Reservation>("/reservations", body),
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
};
