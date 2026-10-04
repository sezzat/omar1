import type { Availability, Envelope, PublicPackageType, PublicSpace } from "./types";
import { mockPackageTypes, mockSpaces } from "./mock-data";
import { availabilityFor } from "@/lib/portal/availability";

export * from "./types";

/**
 * PublicCatalog client. The contract (also served by the mock routes under /api/v1/public):
 *   GET /api/v1/public/spaces                       -> { data: PublicSpace[] }
 *   GET /api/v1/public/spaces/:slug                 -> { data: PublicSpace }
 *   GET /api/v1/public/spaces/:slug/availability?date=YYYY-MM-DD -> { data: Availability }
 *   GET /api/v1/public/package-types                -> { data: PublicPackageType[] }
 * Responses are cacheable. Pages are pre-rendered and refreshed on the "catalog" tag
 * (see POST /api/revalidate), so staff changes reach the public site without a deploy.
 */
export const CATALOG_TAG = "catalog";
const REVALIDATE_SECONDS = 300;

const apiBase = process.env.FLUX_API_URL?.replace(/\/$/, "");

async function remote<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase}/api/v1/public${path}`, {
    next: { revalidate: REVALIDATE_SECONDS, tags: [CATALOG_TAG] },
  });
  if (!res.ok) throw new Error(`PublicCatalog ${path} failed with ${res.status}`);
  return ((await res.json()) as Envelope<T>).data;
}

const publicSpaces = () => mockSpaces.filter((s): s is PublicSpace => s.isPublic);
const publicPackages = () => mockPackageTypes.filter((p): p is PublicPackageType => p.isPublic);

export async function getSpaces(): Promise<PublicSpace[]> {
  return apiBase ? remote<PublicSpace[]>("/spaces") : publicSpaces();
}

export async function getSpace(slug: string): Promise<PublicSpace | null> {
  if (apiBase) {
    try {
      return await remote<PublicSpace>(`/spaces/${encodeURIComponent(slug)}`);
    } catch {
      return null;
    }
  }
  return publicSpaces().find((s) => s.slug === slug) ?? null;
}

export async function getPackageTypes(): Promise<PublicPackageType[]> {
  return apiBase ? remote<PublicPackageType[]>("/package-types") : publicPackages();
}

/** Availability is never pre-rendered; the browser asks the API live. */
export async function getAvailability(slug: string, date: string): Promise<Availability | null> {
  const space = await getSpace(slug);
  return space ? availabilityFor(space, date) : null;
}

/** Spaces grouped by kind, in display order, for the home and spaces pages. */
export const kindOrder = ["hot-desk", "meeting-room", "dedicated-desk", "private-office"] as const;
