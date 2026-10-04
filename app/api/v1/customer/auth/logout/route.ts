import { revokeRefresh } from "@/lib/portal/accounts";
import { clearSessionCookies, fail, getCookie, REFRESH_COOKIE, sameOrigin } from "@/lib/portal/http";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  revokeRefresh(getCookie(req, REFRESH_COOKIE));
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookies(res);
  return res;
}
