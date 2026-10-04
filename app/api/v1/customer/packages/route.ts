import { customerPackages, toPackageDto } from "@/lib/portal/dto";
import { json, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ customer }) => json(customerPackages(customer.id).map(toPackageDto)));
