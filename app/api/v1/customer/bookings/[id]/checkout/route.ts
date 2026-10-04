import { createCheckout } from "@/lib/portal/bookings";
import { fail, json, rateLimited, withCustomer } from "@/lib/portal/http";
import type { CheckoutDto } from "@/lib/portal/types";

export const POST = withCustomer<{ id: string }>(({ req, user, customer, params }) => {
  const limit = rateLimited(req, "checkout", 20, 10 * 60_000, user.id);
  if (limit) return limit;
  const result = createCheckout(user, customer, params.id);
  if (!result.ok) return fail(result.status, result.code);
  const s = result.value;
  const dto: CheckoutDto = { sessionId: s.id, checkoutPath: `/checkout/${s.id}`, amountEgp: s.amountEgp, expiresAt: s.expiresAt };
  return json(dto);
});
