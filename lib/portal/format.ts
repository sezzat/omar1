import type { Loc } from "@/lib/format";

const TZ = "Africa/Cairo";
const tag = (lang: Loc) => (lang === "ar" ? "ar-EG-u-nu-latn" : "en-GB");

/** "Wednesday 7 October 2026" from YYYY-MM-DD. */
export function formatDay(lang: Loc, ymd: string, style: "long" | "short" = "long"): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  return new Intl.DateTimeFormat(tag(lang), style === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Date and time of an ISO instant on the Alexandria clock. */
export function formatInstant(lang: Loc, iso: string): string {
  return new Intl.DateTimeFormat(tag(lang), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(new Date(iso));
}

/** Day of month and short month for calendar tiles, from an ISO instant on the Alexandria clock. */
export function tileParts(lang: Loc, iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat(tag(lang), { day: "numeric", timeZone: TZ }).format(d),
    month: new Intl.DateTimeFormat(tag(lang), { month: "short", timeZone: TZ }).format(d),
  };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** "10:00 – 12:00" from a start time and a length in hours. */
export function timeRange(startTime: string, hours: number): string {
  const h = Number(startTime.slice(0, 2));
  return `${startTime} – ${pad2(h + hours)}:00`;
}

/** Minutes and seconds left until an ISO instant, never negative. */
export function remaining(iso: string, now = Date.now()): { total: number; mm: string; ss: string } {
  const total = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  return { total, mm: pad2(Math.floor(total / 60)), ss: pad2(total % 60) };
}
