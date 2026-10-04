import { cacheable, problem } from "@/lib/api";
import { getSpace } from "@/lib/catalog";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const space = await getSpace(slug);
  return space ? cacheable(space) : problem(404, "space_not_found");
}
