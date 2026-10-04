import { db } from "@/lib/portal/db";
import { toBookingDto } from "@/lib/portal/dto";
import { fail, json, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer<{ id: string }>(({ customer, params }) => {
  const b = db().bookings.get(params.id);
  return b && b.customerId === customer.id ? json(toBookingDto(b)) : fail(404, "booking_not_found");
});
