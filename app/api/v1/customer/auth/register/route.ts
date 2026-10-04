import { register, type RegisterInput } from "@/lib/portal/accounts";
import { fail, json, rateLimited, readJson, sameOrigin } from "@/lib/portal/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const limit = rateLimited(req, "register", 5, 60 * 60_000);
  if (limit) return limit;
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const result = register(body as unknown as RegisterInput);
  return result.ok ? json({ ok: true }) : fail(result.status, result.code, { fields: result.fields });
}
