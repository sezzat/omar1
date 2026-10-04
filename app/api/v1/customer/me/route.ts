import { updateProfile, type ProfileInput } from "@/lib/portal/accounts";
import { toMe } from "@/lib/portal/dto";
import { fail, json, readJson, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ user, customer }) => json(toMe(user, customer)));

export const PATCH = withCustomer(async ({ req, user, customer }) => {
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const result = updateProfile(user, customer, body as ProfileInput);
  return result.ok ? json(toMe(user, customer)) : fail(result.status, result.code, { fields: result.fields });
});
