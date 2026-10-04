import { db } from "@/lib/portal/db";
import { fail, json, readJson } from "@/lib/portal/http";
import { handlePaymentWebhook, signPayload } from "@/lib/portal/webhook";
import type { PaymentEvent } from "@/lib/portal/bookings";

/**
 * Stand-in for the customer finishing (or abandoning) the gateway's hosted page.
 * Outcomes: paid | paid_lost_webhook (gateway took the money but the webhook never arrives) | declined | abandoned.
 * "paid" and "declined" deliver a signed webhook exactly as a real gateway would; the browser redirect only shows status.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = db().sessions.get(id);
  if (!s) return fail(404, "session_not_found");
  const body = await readJson(req);
  const outcome = String(body?.outcome ?? "");
  if (!["paid", "paid_lost_webhook", "declined", "abandoned"].includes(outcome)) return fail(400, "invalid_body");

  const send = (type: PaymentEvent["type"]) => {
    const raw = JSON.stringify({ type, gatewayRef: s.gatewayRef, sessionId: s.id, amountEgp: s.amountEgp } satisfies PaymentEvent);
    return handlePaymentWebhook(raw, signPayload(raw));
  };

  if (outcome === "paid") { s.gatewayState = "paid"; send("payment.succeeded"); }
  else if (outcome === "paid_lost_webhook") s.gatewayState = "paid";
  else if (outcome === "declined") { s.gatewayState = "failed"; send("payment.failed"); }
  else s.gatewayState = "abandoned";

  return json({ returnPath: `/portal/bookings/${s.bookingId}?returned=1` });
}
