import { ACCESS_TTL_SECONDS, signAccessToken } from "@/lib/portal/crypto";
import { customerOf, REFRESH_MAX_AGE_SECONDS, rotateRefresh } from "@/lib/portal/accounts";
import { toMe } from "@/lib/portal/dto";
import { clearSessionCookies, fail, getCookie, REFRESH_COOKIE, sameOrigin, setSessionCookies } from "@/lib/portal/http";
import type { AuthDto } from "@/lib/portal/types";
import { NextResponse } from "next/server";

/** Restores a session from the httpOnly refresh cookie and rotates it. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const token = getCookie(req, REFRESH_COOKIE);
  if (!token) return fail(401, "invalid_session");
  const result = rotateRefresh(token);
  if (!result.ok) {
    const res = fail(result.status, result.code);
    clearSessionCookies(res);
    return res;
  }
  const customer = customerOf(result.value.user);
  if (!customer) return fail(401, "invalid_session");
  const data: AuthDto = { accessToken: signAccessToken(result.value.user.id), expiresIn: ACCESS_TTL_SECONDS, me: toMe(result.value.user, customer) };
  const res = NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  setSessionCookies(res, result.value.refresh, REFRESH_MAX_AGE_SECONDS);
  return res;
}
