"use client";

import type { AuthDto, ApiError, MeDto } from "./types";

/**
 * Browser-side API client for the customer portal.
 * The access token (15 minutes) lives in memory only. The refresh token is an httpOnly cookie the browser sends to
 * /api/v1/customer/auth/refresh, so a page reload restores the session without exposing a long-lived token to scripts.
 */
export class ApiFailure extends Error {
  constructor(public status: number, public code: string, public fields?: Record<string, string>, public details?: Record<string, unknown>) {
    super(code);
  }
}

let accessToken: string | null = null;
let inflightRefresh: Promise<AuthDto | null> | null = null;

export const hasToken = () => accessToken !== null;

async function parseError(res: Response): Promise<ApiFailure> {
  let body: Partial<ApiError> = {};
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* non-JSON error */
  }
  return new ApiFailure(res.status, body.error?.code ?? "unknown", body.error?.fields, body.error?.details);
}

/** Restores the session from the refresh cookie. Concurrent callers share one request, because tokens rotate. */
export function refreshSession(): Promise<AuthDto | null> {
  inflightRefresh ??= (async () => {
    try {
      const res = await fetch("/api/v1/customer/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as AuthDto;
      accessToken = data.accessToken;
      return data;
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

async function send(path: string, init: RequestInit | undefined, retry: boolean): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    throw new ApiFailure(0, "network");
  }
  if (res.status === 401 && retry && path !== "/api/v1/customer/auth/refresh") {
    const renewed = await refreshSession();
    if (renewed) return send(path, init, false);
  }
  return res;
}

/** JSON request with the access token, one automatic refresh on 401, and typed failures. */
export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await send(path, json !== undefined ? { ...rest, method: rest.method ?? "POST", body: JSON.stringify(json) } : rest, true);
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

/** Authenticated download (for example an invoice PDF). Returns the file as a Blob. */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await send(path, undefined, true);
  if (!res.ok) throw await parseError(res);
  return res.blob();
}

/** Saves a Blob through a temporary link. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function signIn(email: string, password: string): Promise<MeDto> {
  const res = await fetch("/api/v1/customer/auth/login", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  }).catch(() => null);
  if (!res) throw new ApiFailure(0, "network");
  if (!res.ok) throw await parseError(res);
  const data = (await res.json()) as AuthDto;
  accessToken = data.accessToken;
  return data.me;
}

export async function signOut(): Promise<void> {
  accessToken = null;
  await fetch("/api/v1/customer/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
}

/** Only same-site portal paths are allowed as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null | undefined, lang: string): string {
  if (next && next.startsWith(`/${lang}/`) && !next.startsWith("//") && !next.includes("\\") && !/[\r\n]/.test(next)) return next;
  return `/${lang}/portal`;
}
