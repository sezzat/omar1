import type { MetadataRoute } from "next";
import { getSpaces } from "@/lib/catalog";
import { locales } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const spaces = await getSpaces();
  const paths = ["", "/spaces", "/packages", "/contact", "/about", "/legal/terms", "/legal/privacy", "/legal/cancellation", ...spaces.map((s) => `/spaces/${s.slug}`)];
  return paths.flatMap((path) =>
    locales.map((lang) => ({
      url: `${siteUrl}/${lang}${path}`,
      alternates: { languages: Object.fromEntries(locales.map((l) => [l, `${siteUrl}/${l}${path}`])) },
    })),
  );
}
