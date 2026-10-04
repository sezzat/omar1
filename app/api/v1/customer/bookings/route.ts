import { bookingWindow, createInstantBooking, createRequest, type InstantInput, type RequestInput } from "@/lib/portal/bookings";
import { customerBookings, toBookingDto } from "@/lib/portal/dto";
import { fail, json, rateLimited, readJson, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ req, customer }) => {
  const scope = new URL(req.url).searchParams.get("scope") ?? "all";
  const now = Date.now();
  const list = customerBookings(customer.id)
    .filter((b) => {
      const ended = bookingWindow(b).end.getTime() <= now || b.status === "Completed" || b.status === "Cancelled" || b.status === "No-show";
      return scope === "upcoming" ? !ended : scope === "past" ? ended : true;
    })
    .sort((a, b) => bookingWindow(b).start.getTime() - bookingWindow(a).start.getTime());
  return json(list.map(toBookingDto));
});

/** Flow A ({kind:"instant"}) creates a held Draft, or a Confirmed booking when a package covers it. Flow B ({kind:"request"}) creates a Pending request. */
export const POST = withCustomer(async ({ req, user, customer }) => {
  const limit = rateLimited(req, "book", 20, 10 * 60_000, user.id);
  if (limit) return limit;
  const body = await readJson(req);
  if (!body) return fail(400, "invalid_body");
  const result =
    body.kind === "request" ? createRequest(user, customer, body as unknown as RequestInput) : body.kind === "instant" ? createInstantBooking(user, customer, body as unknown as InstantInput) : null;
  if (!result) return fail(400, "invalid_body");
  return result.ok ? json(toBookingDto(result.value), 201) : fail(result.status, result.code, { fields: result.fields, details: result.details });
});
