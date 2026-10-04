import { toDashboard } from "@/lib/portal/dto";
import { json, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ customer }) => json(toDashboard(customer)));
