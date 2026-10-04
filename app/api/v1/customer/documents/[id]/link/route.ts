import { signLink } from "@/lib/portal/crypto";
import { db } from "@/lib/portal/db";
import { fail, json, withCustomer } from "@/lib/portal/http";

/** Private files are served only through short-lived signed links. */
export const GET = withCustomer<{ id: string }>(({ customer, params }) => {
  const doc = db().documents.get(params.id);
  if (!doc || doc.customerId !== customer.id) return fail(404, "document_not_found");
  const expiresAt = Date.now() + 5 * 60_000;
  const url = `/api/v1/customer/documents/${doc.id}/download?exp=${expiresAt}&sig=${signLink(`doc:${doc.id}`, expiresAt)}`;
  return json({ url, expiresAt: new Date(expiresAt).toISOString() });
});
