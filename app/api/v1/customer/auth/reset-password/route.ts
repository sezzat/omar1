import { resetPassword } from "@/lib/portal/accounts";
import { fail, json, rateLimited, readJson, sameOrigin } from "@/lib/portal/http";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const limit = rateLimited(req, "reset", 10, 15 * 60_000);
  if (limit) return limit;
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const result = resetPassword(String(body.token ?? ""), String(body.password ?? ""));
  return result.ok ? json({ ok: true, language: result.value.lang }) : fail(result.status, result.code, { fields: result.fields });
}
