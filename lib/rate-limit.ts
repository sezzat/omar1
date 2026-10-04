/** Sliding-window limiter keyed by caller. Returns true when the caller is over the limit. In-memory: one process only. */
const g = globalThis as unknown as { __fluxRate?: Map<string, number[]> };
const buckets = (g.__fluxRate ??= new Map<string, number[]>());

export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
