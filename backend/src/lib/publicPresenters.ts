function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

type RoomLike = {
  dailyPrice: { toString(): string } | number | null;
  amenities?: unknown;
  photos?: unknown;
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
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  catalogHeadline: string | null;
  catalogRules: string | null;
  coverPhotoUrl: string | null;
  galleryPhotos: unknown;
  checkInTime: string | null;
  checkOutTime: string | null;
  brandColor: string | null;
}) {
  const addressParts = [
    hotel.street
      ? `${hotel.street}${hotel.number ? `, ${hotel.number}` : ""}`
      : null,
    hotel.complement,
    hotel.neighborhood,
    hotel.city && hotel.state
      ? `${hotel.city}/${hotel.state}`
      : hotel.city,
    hotel.zipCode,
  ].filter(Boolean);

  return {
    name: hotel.name,
    phone: hotel.phone,
    logoUrl: hotel.logoUrl,
    street: hotel.street,
    number: hotel.number,
    complement: hotel.complement,
    neighborhood: hotel.neighborhood,
    city: hotel.city,
    state: hotel.state,
    zipCode: hotel.zipCode,
    addressFormatted: addressParts.length > 0 ? addressParts.join(" — ") : null,
    headline: hotel.catalogHeadline,
    rules: hotel.catalogRules,
    coverPhotoUrl: hotel.coverPhotoUrl,
    galleryPhotos: asStringArray(hotel.galleryPhotos),
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    brandColor: hotel.brandColor,
  };
}

export function presentPublicRoomTypes(rooms: RoomLike[]) {
  const byType = new Map<
    string,
    {
      roomType: RoomLike["roomType"];
      prices: number[];
      photos: string[];
      amenities: string[];
    }
  >();

  for (const room of rooms) {
    const key = room.roomType.id;
    const entry = byType.get(key) ?? {
      roomType: room.roomType,
      prices: [],
      photos: asStringArray(room.roomType.photos),
      amenities: asStringArray(room.roomType.amenities),
    };
    const price = Number(room.dailyPrice ?? room.roomType.basePrice);
    entry.prices.push(price);
    entry.photos = uniqueStrings([
      ...entry.photos,
      ...asStringArray(room.photos),
    ]);
    entry.amenities = uniqueStrings([
      ...entry.amenities,
      ...asStringArray(room.amenities),
    ]);
    byType.set(key, entry);
  }

  return [...byType.values()].map(({ roomType, prices, photos, amenities }) => ({
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    capacity: roomType.capacity,
    amenities,
    photos,
    priceFrom: Math.min(...prices),
  }));
}

export function presentPublicRoomTypeDetail(
  rooms: RoomLike[],
  roomTypeId: string,
) {
  const ofType = rooms.filter((r) => r.roomType.id === roomTypeId);
  if (ofType.length === 0) return null;
  const [presented] = presentPublicRoomTypes(ofType);
  return presented ?? null;
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
