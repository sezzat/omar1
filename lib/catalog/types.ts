import type { L10n } from "@/lib/i18n";

export type SpaceKind = "hot-desk" | "meeting-room" | "dedicated-desk" | "private-office";
export type BookingMode = "instant" | "request";
export type PriceUnit = "hour" | "day" | "month";
export type AmenityKey = "wifi" | "screen" | "whiteboard" | "coffee" | "lockers" | "ac" | "door" | "printing";

export interface Price {
  unit: PriceUnit;
  /** Whole EGP. Currency is assumed from the Alexandria branch. */
  amount: number;
}

export interface Photo {
  /** null until professional photography is supplied; the UI shows a labelled placeholder. */
  url: string | null;
  alt: L10n;
}

/** Public view of a Space (FR-SPC). Only isPublic spaces are ever returned. */
export interface PublicSpace {
  id: string;
  slug: string;
  kind: SpaceKind;
  isPublic: true;
  bookingMode: BookingMode;
  name: L10n;
  summary: L10n;
  description: L10n;
  capacity: number;
  /** Quantity-based spaces (hot desk) count seats instead of a single unit. */
  quantityBased: boolean;
  floor: number;
  amenities: AmenityKey[];
  photos: Photo[];
  prices: Price[];
  /** Lowest price, shown as "from". */
  fromPrice: Price;
}

/** Public view of a package type (FR-PKG). Only isPublic package types are returned. */
export interface PublicPackageType {
  id: string;
  slug: string;
  isPublic: true;
  name: L10n;
  description: L10n;
  unit: "hours" | "days";
  quantity: number;
  validityDays: number;
  priceEgp: number;
  appliesTo: SpaceKind;
}

export type Availability =
  | { spaceId: string; date: string; kind: "hourly"; slots: { start: string; available: boolean }[] }
  | { spaceId: string; date: string; kind: "daily"; seatsTotal: number; seatsLeft: number }
  | { spaceId: string; date: string; kind: "monthly"; earliestStart: string; unitsLeft: number };

export interface Envelope<T> {
  data: T;
}
