import { branch, siteUrl } from "@/lib/site";
import type { Locale } from "@/lib/i18n";

/** LocalBusiness structured data for local search (single branch). */
export function LocalBusinessJsonLd({ locale }: { locale: Locale }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: branch.name,
    url: `${siteUrl}/${locale}`,
    image: `${siteUrl}/flux-logo.png`,
    description: "Coworking and business-hub spaces: hot desks, meeting rooms, dedicated desks and private offices.",
    address: {
      "@type": "PostalAddress",
      addressLocality: branch.city.en,
      streetAddress: branch.area.en,
      addressCountry: "EG",
    },
    priceRange: "EGP",
    inLanguage: ["ar", "en"],
    ...(branch.geo ? { geo: { "@type": "GeoCoordinates", latitude: branch.geo.lat, longitude: branch.geo.lng } } : {}),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
