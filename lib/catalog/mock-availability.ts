import type { Availability, PublicSpace } from "./types";

const HOURS = [9, 10, 11, 12, 13, 14, 15, 16];

/** Small deterministic hash so the same space and date always give the same answer. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pad = (n: number) => `${String(n).padStart(2, "0")}:00`;

export function mockAvailability(space: PublicSpace, date: string): Availability {
  const seed = hash(`${space.id}:${date}`);

  if (space.bookingMode === "request") {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1 + (seed % 5));
    return { spaceId: space.id, date, kind: "monthly", earliestStart: d.toISOString().slice(0, 10), unitsLeft: 1 + (seed % 3) };
  }

  if (space.quantityBased) {
    return { spaceId: space.id, date, kind: "daily", seatsTotal: space.capacity, seatsLeft: seed % (space.capacity - 2) + 3 };
  }

  const taken = new Set<number>();
  taken.add(HOURS[seed % HOURS.length]);
  taken.add(HOURS[(seed >>> 3) % HOURS.length]);
  return {
    spaceId: space.id,
    date,
    kind: "hourly",
    slots: HOURS.map((h) => ({ start: pad(h), available: !taken.has(h) })),
  };
}
