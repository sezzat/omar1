import { ACCESS_TTL_SECONDS, signAccessToken } from "@/lib/portal/crypto";
import { authenticate, customerOf, issueRefresh, REFRESH_MAX_AGE_SECONDS } from "@/lib/portal/accounts";
import { toMe } from "@/lib/portal/dto";
import { fail, rateLimited, readJson, sameOrigin, setSessionCookies } from "@/lib/portal/http";
import type { AuthDto } from "@/lib/portal/types";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const limit = rateLimited(req, "login", 10, 15 * 60_000, String(body.email ?? "").toLowerCase());
  if (limit) return limit;

  const result = authenticate(String(body.email ?? ""), String(body.password ?? ""));
  if (!result.ok) return fail(result.status, result.code);
  const customer = customerOf(result.value);
  if (!customer) return fail(401, "invalid_credentials");

  const data: AuthDto = { accessToken: signAccessToken(result.value.id), expiresIn: ACCESS_TTL_SECONDS, me: toMe(result.value, customer) };
  const res = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  setSessionCookies(res, issueRefresh(result.value.id), REFRESH_MAX_AGE_SECONDS);
  return res;
}
