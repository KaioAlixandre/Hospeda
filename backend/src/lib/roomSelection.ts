import { presentAvailabilityOption } from "./presenters.js";
import type { Room, RoomType } from "../generated/prisma/client.js";

export type RoomSelectionEntry = {
  roomId: string;
  roomTypeId: string;
  guests: number;
  nightlyRate: number;
  roomNumber: string;
  roomTypeName: string;
};

type RoomWithType = Room & { roomType: RoomType };

type AvailabilityOption = ReturnType<typeof presentAvailabilityOption>;

export function parseRoomSelection(value: unknown): RoomSelectionEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.roomId !== "string" ||
      typeof row.roomTypeId !== "string" ||
      typeof row.guests !== "number" ||
      typeof row.nightlyRate !== "number"
    ) {
      return [];
    }
    return [
      {
        roomId: row.roomId,
        roomTypeId: row.roomTypeId,
        guests: row.guests,
        nightlyRate: row.nightlyRate,
        roomNumber:
          typeof row.roomNumber === "string" ? row.roomNumber : row.roomId,
        roomTypeName:
          typeof row.roomTypeName === "string" ? row.roomTypeName : "",
      },
    ];
  });
}

export function reservationRoomIds(reservation: {
  roomId: string | null;
  roomSelection: unknown;
}): string[] {
  const selected = parseRoomSelection(reservation.roomSelection);
  if (selected.length > 0) {
    return selected.map((entry) => entry.roomId);
  }
  return reservation.roomId ? [reservation.roomId] : [];
}

export function selectionKey(roomIds: string[]): string {
  return [...roomIds].sort().join(",");
}

export function allocateGuests(
  rooms: AvailabilityOption[],
  guests: number,
): RoomSelectionEntry[] {
  const ordered = [...rooms].sort(
    (a, b) => b.room.capacity - a.room.capacity,
  );
  let remaining = guests;

  return ordered.map((option) => {
    const assigned = Math.min(option.room.capacity, remaining);
    remaining -= assigned;
    return {
      roomId: option.room.id,
      roomTypeId: option.room.type.id,
      guests: assigned,
      nightlyRate: option.nightlyRate,
      roomNumber: option.room.number,
      roomTypeName: option.room.type.name,
    };
  });
}

function comboCapacity(combo: AvailabilityOption[]): number {
  return combo.reduce((sum, option) => sum + option.room.capacity, 0);
}

function comboTotal(combo: AvailabilityOption[]): number {
  return Number(combo.reduce((sum, option) => sum + option.total, 0).toFixed(2));
}

function comboNightlyRate(combo: AvailabilityOption[]): number {
  return Number(
    combo.reduce((sum, option) => sum + option.nightlyRate, 0).toFixed(2),
  );
}

function isMinimalCombination(
  combo: AvailabilityOption[],
  guests: number,
): boolean {
  const capacity = comboCapacity(combo);
  if (capacity < guests) return false;

  for (let mask = 1; mask < (1 << combo.length) - 1; mask++) {
    let subsetCapacity = 0;
    for (let index = 0; index < combo.length; index++) {
      if (mask & (1 << index)) {
        subsetCapacity += combo[index]!.room.capacity;
      }
    }
    if (subsetCapacity >= guests) return false;
  }

  return true;
}

export function findRoomCombinations(
  options: AvailabilityOption[],
  guests: number,
  maxResults = 12,
): AvailabilityOption[][] {
  const results: AvailabilityOption[][] = [];
  const seen = new Set<string>();

  function search(
    start: number,
    current: AvailabilityOption[],
    capacity: number,
  ) {
    if (capacity >= guests) {
      const key = selectionKey(current.map((option) => option.room.id));
      if (!seen.has(key) && isMinimalCombination(current, guests)) {
        seen.add(key);
        results.push([...current]);
      }
      return;
    }

    if (current.length >= 5) return;

    for (let index = start; index < options.length; index++) {
      current.push(options[index]!);
      search(
        index + 1,
        current,
        capacity + options[index]!.room.capacity,
      );
      current.pop();
    }
  }

  search(0, [], 0);

  return results
    .sort((left, right) => {
      if (left.length !== right.length) return left.length - right.length;
      const priceDiff = comboTotal(left) - comboTotal(right);
      if (priceDiff !== 0) return priceDiff;
      return comboCapacity(left) - comboCapacity(right);
    })
    .slice(0, maxResults);
}

export function presentAvailabilitySelection(
  rooms: AvailabilityOption[],
  checkInDate: string,
  checkOutDate: string,
  guests: number,
) {
  const nights = rooms[0]?.nights ?? 0;
  const periodLabel = rooms[0]?.periodLabel ?? "";
  const totalCapacity = comboCapacity(rooms);
  const totalNightlyRate = comboNightlyRate(rooms);
  const total = comboTotal(rooms);
  const roomIds = rooms.map((option) => option.room.id);
  const kind = rooms.length === 1 ? "single" : "combination";

  const roomSummary = rooms
    .map(
      (option) =>
        `Quarto ${option.room.number} (${option.room.type.name}, ${option.room.capacity} pess.)`,
    )
    .join(" + ");

  const diariasLabel = nights === 1 ? "1 diária" : `${nights} diárias`;

  return {
    id: selectionKey(roomIds),
    kind,
    rooms,
    roomIds,
    label:
      kind === "single"
        ? rooms[0]!.label
        : `${rooms.length} quartos · ${totalCapacity} lugares`,
    description: roomSummary,
    checkInDate,
    checkOutDate,
    periodLabel,
    nights,
    guests,
    totalCapacity,
    totalNightlyRate,
    total,
    summary: `${roomSummary} · ${diariasLabel} = ${total.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })} (estimativa máxima)`,
  };
}

export function buildRoomSelectionFromIds(
  availableOptions: AvailabilityOption[],
  roomIds: string[],
  guests: number,
): RoomSelectionEntry[] {
  const selected = roomIds.map((roomId) => {
    const option = availableOptions.find((item) => item.room.id === roomId);
    if (!option) {
      throw new Error(`Room ${roomId} is not available`);
    }
    return option;
  });

  return allocateGuests(selected, guests);
}

export async function getBlockedRoomIds(
  checkIn: Date,
  checkOut: Date,
  excludeReservationId?: string,
) {
  const { prisma } = await import("./prisma.js");
  const overlapping = await prisma.reservation.findMany({
    where: {
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      status: { in: ["PENDING", "CONFIRMED"] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
    select: { roomId: true, roomSelection: true },
  });

  const blocked = new Set<string>();
  for (const reservation of overlapping) {
    for (const roomId of reservationRoomIds(reservation)) {
      blocked.add(roomId);
    }
  }
  return blocked;
}

export function buildAvailabilityOptions(
  rooms: RoomWithType[],
  checkInDate: string,
  checkOutDate: string,
  guests: number,
) {
  const priced = rooms.map((room) =>
    presentAvailabilityOption(room, checkInDate, checkOutDate),
  );

  const singles = priced
    .filter((option) => option.room.capacity >= guests)
    .map((option) =>
      presentAvailabilitySelection([option], checkInDate, checkOutDate, guests),
    );

  const combinationPool = priced.filter(
    (option) => option.room.capacity < guests,
  );
  const combinations =
    guests > 1
      ? findRoomCombinations(combinationPool, guests).map((combo) =>
          presentAvailabilitySelection(
            combo,
            checkInDate,
            checkOutDate,
            guests,
          ),
        )
      : [];

  const options = [...singles, ...combinations];
  return {
    options,
    availableCount: options.length,
  };
}
