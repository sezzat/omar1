import { cacheable, problem } from "@/lib/api";
import { getAvailability } from "@/lib/catalog";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return problem(400, "invalid_date");
  const availability = await getAvailability(slug, date);
  // Availability changes with every booking, so it is cached only briefly.
  return availability ? cacheable(availability, 15) : problem(404, "space_not_found");
}
