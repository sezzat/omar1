import { changePassword } from "@/lib/portal/accounts";
import { fail, json, rateLimited, readJson, withCustomer } from "@/lib/portal/http";

export const POST = withCustomer(async ({ req, user }) => {
  const limit = rateLimited(req, "chpw", 10, 15 * 60_000, user.id);
  if (limit) return limit;
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const result = changePassword(user, String(body.currentPassword ?? ""), String(body.newPassword ?? ""));
  return result.ok ? json({ ok: true }) : fail(result.status, result.code, { fields: result.fields });
});
