import { cacheable } from "@/lib/api";
import { getSpaces } from "@/lib/catalog";

export async function GET() {
  return cacheable(await getSpaces());
}
