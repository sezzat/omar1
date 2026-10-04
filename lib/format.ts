export type Loc = "ar" | "en";

/** Replaces {name} tokens in a translated string. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** "EGP 9,500" in English, "9,500 ج.م" in Arabic. Western digits in both. */
export function formatEgp(locale: Loc, amount: number): string {
  const n = amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return locale === "ar" ? `${n} ج.م` : `EGP ${n}`;
}

export function formatDate(locale: Loc, isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const tag = locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB";
  return new Intl.DateTimeFormat(tag, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
