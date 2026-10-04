import { isGatewayDown, setGatewayDown } from "@/lib/portal/bookings";
import { devOnly, fail, json, readJson } from "@/lib/portal/http";

/** Development only: switch the mock gateway into an outage to see the retry behaviour. */
export async function POST(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const body = await readJson(req);
  if (!body || typeof body.down !== "boolean") return fail(400, "invalid_body");
  setGatewayDown(body.down);
  return json({ down: isGatewayDown() });
}
