import { sendVerification } from "@/lib/portal/accounts";
import { json, rateLimited, withCustomer } from "@/lib/portal/http";

export const POST = withCustomer(({ req, user, customer }) => {
  const limit = rateLimited(req, "resend", 3, 10 * 60_000, user.id);
  if (limit) return limit;
  if (!user.emailVerified) sendVerification(user, customer);
  return json({ ok: true });
});
