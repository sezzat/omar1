export const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Branch details are placeholders until the owner confirms them.
 * Replace the bracketed values; the pages read everything from here.
 */
export const branch = {
  name: "Flux Business Hub",
  city: { ar: "الإسكندرية", en: "Alexandria" },
  area: { ar: "السيوف", en: "El Seyouf" },
  address: { ar: "[العنوان التفصيلي]", en: "[Street address]" },
  phone: "[Branch phone]",
  email: "[branch email]",
  hours: { ar: "[مواعيد الاستقبال]", en: "[Reception hours]" },
  geo: null as null | { lat: number; lng: number },
};
