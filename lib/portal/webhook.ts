import { hmac, safeEqual, secret } from "./crypto";
import { applyPaymentEvent, type EventOutcome, type PaymentEvent } from "./bookings";

export const SIGNATURE_HEADER = "x-flux-signature";

export function signPayload(raw: string): string {
  return hmac(secret("GATEWAY_WEBHOOK_SECRET"), raw);
}

export type WebhookResult = { status: 200; outcome: EventOutcome } | { status: 400 | 401; code: string };

/** Verifies the gateway signature over the raw body, validates the shape, then applies the event once. */
export function handlePaymentWebhook(raw: string, signature: string | null): WebhookResult {
  if (!signature || !safeEqual(signature, signPayload(raw))) return { status: 401, code: "bad_signature" };
  let ev: Partial<PaymentEvent>;
  try {
    ev = JSON.parse(raw);
  } catch {
    return { status: 400, code: "invalid_body" };
  }
  if ((ev.type !== "payment.succeeded" && ev.type !== "payment.failed") || typeof ev.gatewayRef !== "string" || typeof ev.sessionId !== "string" || typeof ev.amountEgp !== "number") {
    return { status: 400, code: "invalid_body" };
  }
  return { status: 200, outcome: applyPaymentEvent(ev as PaymentEvent) };
}
