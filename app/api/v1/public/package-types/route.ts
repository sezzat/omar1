import { cacheable } from "@/lib/api";
import { getPackageTypes } from "@/lib/catalog";

export async function GET() {
  return cacheable(await getPackageTypes());
}
