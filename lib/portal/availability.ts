import { mockAvailability } from "@/lib/catalog/mock-availability";
import type { Availability, PublicSpace } from "@/lib/catalog/types";
import { db } from "./db";
import { expireHolds } from "./holds";
import type { BookingRecord } from "./types";

/** Bookings that occupy a slot: confirmed work, and Drafts whose hold is still alive. Pending requests do not block. */
export function blockingBookings(slug: string, date: string, excludeId?: string, now = Date.now()): BookingRecord[] {
  return [...db().bookings.values()].filter((b) => {
    if (b.spaceSlug !== slug || b.date !== date || b.id === excludeId) return false;
    if (b.status === "Confirmed" || b.status === "Checked-in" || b.status === "Completed") return true;
    return b.status === "Draft" && !!b.holdExpiresAt && Date.parse(b.holdExpiresAt) > now;
  });
}

/** One source of truth for the public availability API and for booking validation. */
export function availabilityFor(space: PublicSpace, date: string, excludeId?: string): Availability {
  expireHolds();
  const base = mockAvailability(space, date);
  const blocking = blockingBookings(space.slug, date, excludeId);

  if (base.kind === "hourly") {
    const taken = new Set<string>();
    for (const b of blocking) {
      const start = Number((b.startTime ?? "00:00").slice(0, 2));
      for (let h = start; h < start + (b.hours ?? 1); h++) taken.add(`${String(h).padStart(2, "0")}:00`);
    }
    return { ...base, slots: base.slots.map((s) => ({ ...s, available: s.available && !taken.has(s.start) })) };
  }
  if (base.kind === "daily") return { ...base, seatsLeft: Math.max(0, base.seatsLeft - blocking.length) };
  return base;
}
