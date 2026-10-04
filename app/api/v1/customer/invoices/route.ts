import { customerInvoices, toInvoiceDto } from "@/lib/portal/dto";
import { json, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ customer }) =>
  json(customerInvoices(customer.id).map(toInvoiceDto).sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number))),
);
