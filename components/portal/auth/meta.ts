import type { Metadata } from "next";
import { getPortalMessages } from "@/lib/portal/messages";
import { pageMetadata } from "@/lib/seo";
import { isLocale } from "@/lib/i18n";

export type AuthPageKey = "login" | "register" | "verify" | "forgot" | "reset";

/** Bilingual, noindex metadata shared by the five auth pages. */
export function authMetadata(lang: string, key: AuthPageKey, path: string): Metadata {
  if (!isLocale(lang)) return {};
  const m = getPortalMessages(lang).auth.meta[key];
  return { ...pageMetadata(lang, path, m.title, m.description), robots: { index: false, follow: false } };
}
