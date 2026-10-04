import { cancelBooking } from "@/lib/portal/bookings";
import { toBookingDto } from "@/lib/portal/dto";
import { fail, json, withCustomer } from "@/lib/portal/http";

export const POST = withCustomer<{ id: string }>(({ customer, params }) => {
  const result = cancelBooking(customer, params.id);
  return result.ok ? json(toBookingDto(result.value)) : fail(result.status, result.code, { details: result.details });
});
