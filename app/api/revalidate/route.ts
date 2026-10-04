import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { problem } from "@/lib/api";

/** The Phase 1 backend calls this after staff change a space, photo or price. */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return problem(401, "unauthorized");
  revalidateTag(CATALOG_TAG, "max");
  return Response.json({ revalidated: true });
}
