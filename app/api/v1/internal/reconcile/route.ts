import { reconcile } from "@/lib/portal/bookings";
import { safeEqual, secret } from "@/lib/portal/crypto";
import { fail, json } from "@/lib/portal/http";

/** Scheduled job: confirms checkouts whose webhook never arrived and releases expired holds. Protected by INTERNAL_SECRET. */
export async function POST(req: Request) {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!given || !safeEqual(given, secret("INTERNAL_SECRET"))) return fail(401, "unauthorized");
  return json(reconcile());
}
