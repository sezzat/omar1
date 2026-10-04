import commonEn from "@/messages/portal/common.en.json";
import commonAr from "@/messages/portal/common.ar.json";
import shellEn from "@/messages/portal/shell.en.json";
import shellAr from "@/messages/portal/shell.ar.json";
import authEn from "@/messages/portal/auth.en.json";
import authAr from "@/messages/portal/auth.ar.json";
import homeEn from "@/messages/portal/home.en.json";
import homeAr from "@/messages/portal/home.ar.json";
import bookingsEn from "@/messages/portal/bookings.en.json";
import bookingsAr from "@/messages/portal/bookings.ar.json";
import bookEn from "@/messages/portal/book.en.json";
import bookAr from "@/messages/portal/book.ar.json";
import packagesEn from "@/messages/portal/packages.en.json";
import packagesAr from "@/messages/portal/packages.ar.json";
import invoicesEn from "@/messages/portal/invoices.en.json";
import invoicesAr from "@/messages/portal/invoices.ar.json";
import profileEn from "@/messages/portal/profile.en.json";
import profileAr from "@/messages/portal/profile.ar.json";
import checkoutEn from "@/messages/portal/checkout.en.json";
import checkoutAr from "@/messages/portal/checkout.ar.json";
import type { Locale } from "@/lib/i18n";

/**
 * Portal copy is split per screen so each area owns one pair of JSON files (en + ar).
 * The Arabic object is typed against the English one, so a missing key fails the typecheck.
 */
const en = {
  common: commonEn, shell: shellEn, auth: authEn, home: homeEn, bookings: bookingsEn, book: bookEn,
  packages: packagesEn, invoices: invoicesEn, profile: profileEn, checkout: checkoutEn,
};
export type PortalMessages = typeof en;

const ar: PortalMessages = {
  common: commonAr, shell: shellAr, auth: authAr, home: homeAr, bookings: bookingsAr, book: bookAr,
  packages: packagesAr, invoices: invoicesAr, profile: profileAr, checkout: checkoutAr,
};

export function getPortalMessages(locale: Locale): PortalMessages {
  return locale === "ar" ? ar : en;
}
