import { staffCheckIn } from "@/lib/portal/bookings";
import { toBookingDto } from "@/lib/portal/dto";
import { devOnly, fail, json } from "@/lib/portal/http";

/** Development only: stands in for the staff action in the admin portal. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const { id } = await ctx.params;
  const result = staffCheckIn(id);
  return result.ok ? json(toBookingDto(result.value)) : fail(result.status, result.code);
}
