import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n";

/** Per-page metadata with canonical and hreflang alternates for both languages. */
export function pageMetadata(locale: Locale, path: string, title: string, description: string): Metadata {
  const languages: Record<string, string> = Object.fromEntries(locales.map((l) => [l, `/${l}${path}`]));
  languages["x-default"] = `/ar${path}`;
  return {
    title,
    description,
    alternates: { canonical: `/${locale}${path}`, languages },
    openGraph: { title, description, locale: locale === "ar" ? "ar_EG" : "en_GB", type: "website", url: `/${locale}${path}` },
  };
}
