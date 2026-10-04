import ar from "@/messages/ar.json";
import en from "@/messages/en.json";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export type Messages = typeof en;
export type L10n = { ar: string; en: string };

const dictionaries: Record<Locale, Messages> = { ar, en };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function otherLocale(locale: Locale): Locale {
  return locale === "ar" ? "en" : "ar";
}

export function localize(locale: Locale, value: L10n): string {
  return value[locale];
}

export { fmt, formatEgp, formatDate } from "@/lib/format";
