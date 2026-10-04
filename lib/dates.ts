/** Local calendar date as YYYY-MM-DD (not UTC, so late-evening visitors see their own "today"). */
export function isoDate(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
}
