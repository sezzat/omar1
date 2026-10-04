import { fail, json } from "@/lib/portal/http";
import { SIGNATURE_HEADER, handlePaymentWebhook } from "@/lib/portal/webhook";

/** Gateway webhook: the only thing that confirms a payment. Signature verified over the raw body; processed once per gateway reference. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 10_000) return fail(413, "too_large");
  const result = handlePaymentWebhook(raw, req.headers.get(SIGNATURE_HEADER));
  return result.status === 200 ? json({ ok: true, outcome: result.outcome }) : fail(result.status, result.code);
}
