import { requestPasswordReset } from "@/lib/portal/accounts";
import { fail, json, rateLimited, readJson, sameOrigin } from "@/lib/portal/http";

/** Always answers the same way, so it cannot be used to find out who is registered. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const limit = rateLimited(req, "forgot", 5, 15 * 60_000);
  if (limit) return limit;
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  requestPasswordReset(String(body.email ?? ""));
  return json({ ok: true });
}
