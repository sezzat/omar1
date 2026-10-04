import { db } from "./db";

/** A Draft whose hold ran out is released: the slot is freed and the booking is marked Cancelled (no new status is introduced). */
export function expireHolds(now = Date.now()): number {
  let released = 0;
  for (const b of db().bookings.values()) {
    if (b.status === "Draft" && b.holdExpiresAt && Date.parse(b.holdExpiresAt) <= now) {
      b.status = "Cancelled";
      b.cancelReason = "hold_expired";
      b.cancelledAt = new Date(now).toISOString();
      released += 1;
    }
  }
  return released;
}
