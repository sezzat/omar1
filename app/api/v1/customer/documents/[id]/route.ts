import { deleteDocument } from "@/lib/portal/documents";
import { fail, json, withCustomer } from "@/lib/portal/http";

export const DELETE = withCustomer<{ id: string }>(({ customer, params }) => {
  const result = deleteDocument(customer, params.id);
  return result.ok ? json({ ok: true }) : fail(result.status, result.code);
});
