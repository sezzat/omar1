import { mockSpaces } from "@/lib/catalog/mock-data";
import type { PublicSpace } from "@/lib/catalog/types";

/** The booking domain's view of spaces. In production this is the Spaces module's table; here it is the mock catalogue. */
export function spaceBySlug(slug: string): (Omit<PublicSpace, "isPublic"> & { isPublic: boolean }) | undefined {
  return mockSpaces.find((s) => s.slug === slug);
}

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 17;
