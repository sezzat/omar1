import { NextResponse } from "next/server";
import { clientIp, limited } from "@/lib/rate-limit";
import { verifyAccessToken } from "./crypto";
import { db } from "./db";
import { expireHolds } from "./holds";
import type { ApiError, CustomerRecord, UserRecord } from "./types";

export const json = <T>(data: T, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export function fail(status: number, code: string, extra?: { fields?: Record<string, string>; details?: Record<string, unknown> }) {
  const body: ApiError = { error: { code, ...(extra?.fields ? { fields: extra.fields } : {}), ...(extra?.details ? { details: extra.details } : {}) } };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function rateLimited(req: Request, bucket: string, max: number, windowMs: number, extraKey = ""): Response | null {
  return limited(`${bucket}:${clientIp(req)}:${extraKey}`, max, windowMs) ? fail(429, "rate_limited") : null;
}

export async function readJson(req: Request, maxBytes = 20_000): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Cookie-authenticated POSTs must come from this site (CSRF defence in addition to SameSite). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export interface CustomerCtx<P> {
  req: Request;
  user: UserRecord;
  customer: CustomerRecord;
  params: P;
}

/** Requires a valid customer access token (JWT audience flux-customer; staff tokens are rejected). */
export function withCustomer<P = Record<string, never>>(handler: (ctx: CustomerCtx<P>) => Promise<Response> | Response) {
  return async (req: Request, routeCtx: { params: Promise<P> }): Promise<Response> => {
    const header = req.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const userId = token ? verifyAccessToken(token) : null;
    const user = userId ? db().users.get(userId) : undefined;
    if (!user || user.linkPending) return fail(401, "unauthorized");
    const customer = db().customers.get(user.customerId);
    if (!customer) return fail(401, "unauthorized");
    expireHolds();
    return handler({ req, user, customer, params: await routeCtx.params });
  };
}

export const REFRESH_COOKIE = "flux_rt";
export const HINT_COOKIE = "flux_session";
const secure = () => process.env.NODE_ENV === "production";

export function setSessionCookies(res: NextResponse, refreshToken: string, maxAgeSeconds: number) {
  res.cookies.set(REFRESH_COOKIE, refreshToken, { httpOnly: true, secure: secure(), sameSite: "lax", path: "/api/v1/customer/auth", maxAge: maxAgeSeconds });
  // Not a credential: lets the public header show "My account" without calling the API.
  res.cookies.set(HINT_COOKIE, "1", { httpOnly: false, secure: secure(), sameSite: "lax", path: "/", maxAge: maxAgeSeconds });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: secure(), sameSite: "lax", path: "/api/v1/customer/auth", maxAge: 0 });
  res.cookies.set(HINT_COOKIE, "", { httpOnly: false, secure: secure(), sameSite: "lax", path: "/", maxAge: 0 });
}

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** Development helpers (outbox, gateway switch, staff check-in) are 404 in production unless explicitly enabled. */
export function devOnly(): Response | null {
  return process.env.NODE_ENV === "production" && process.env.FLUX_ENABLE_DEV_API !== "1" ? fail(404, "not_found") : null;
}
