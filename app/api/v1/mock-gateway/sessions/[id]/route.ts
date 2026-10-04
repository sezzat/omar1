import { db } from "@/lib/portal/db";
import { fail, json } from "@/lib/portal/http";
import { localize } from "@/lib/i18n";
import { spaceBySlug } from "@/lib/portal/spaces";

/** Mock hosted-checkout lookup. The real gateway renders its own page; this only feeds the stand-in page. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = db().sessions.get(id);
  const booking = s ? db().bookings.get(s.bookingId) : undefined;
  if (!s || !booking) return fail(404, "session_not_found");
  const space = spaceBySlug(booking.spaceSlug);
  return json({
    id: s.id, amountEgp: s.amountEgp, status: s.status, bookingId: booking.id, bookingRef: booking.ref,
    spaceName: space ? { ar: localize("ar", space.name), en: localize("en", space.name) } : null,
    expiresAt: s.expiresAt,
  });
}
