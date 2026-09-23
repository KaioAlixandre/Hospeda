function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type RoomLike = {
  dailyPrice: { toString(): string } | number | null;
  roomType: {
    id: string;
    name: string;
    description: string | null;
    capacity: number;
    basePrice: { toString(): string } | number;
    amenities: unknown;
    photos: unknown;
  };
};

export function presentPublicHotel(hotel: {
  name: string;
  phone: string;
  logoUrl: string | null;
  city: string | null;
  state: string | null;
  catalogHeadline: string | null;
  catalogRules: string | null;
}) {
  return {
    name: hotel.name,
    phone: hotel.phone,
    logoUrl: hotel.logoUrl,
    city: hotel.city,
    state: hotel.state,
    headline: hotel.catalogHeadline,
    rules: hotel.catalogRules,
  };
}

export function presentPublicRoomTypes(rooms: RoomLike[]) {
  const byType = new Map<
    string,
    {
      roomType: RoomLike["roomType"];
      prices: number[];
    }
  >();

  for (const room of rooms) {
    const key = room.roomType.id;
    const entry = byType.get(key) ?? { roomType: room.roomType, prices: [] };
    const price = Number(room.dailyPrice ?? room.roomType.basePrice);
    entry.prices.push(price);
    byType.set(key, entry);
  }

  return [...byType.values()].map(({ roomType, prices }) => ({
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    capacity: roomType.capacity,
    amenities: asStringArray(roomType.amenities),
    photos: asStringArray(roomType.photos),
    priceFrom: Math.min(...prices),
  }));
}

export function presentPublicAvailabilityOption(option: {
  roomIds: string[];
  rooms: Array<{
    room: {
      id: string;
      capacity: number;
      type: { id: string; name: string };
    };
    nightlyRate: number;
  }>;
  totalNightlyRate: number;
  total: number;
  nights: number;
}) {
  const primary = option.rooms[0]!;
  return {
    roomTypeId: primary.room.type.id,
    roomTypeName: primary.room.type.name,
    capacity: option.rooms.reduce((sum, r) => sum + r.room.capacity, 0),
    nightlyRate: option.totalNightlyRate,
    nights: option.nights,
    total: option.total,
  };
}
