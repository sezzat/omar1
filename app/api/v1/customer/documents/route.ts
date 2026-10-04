import { db } from "@/lib/portal/db";
import { toDocumentDto } from "@/lib/portal/dto";
import { MAX_DOC_BYTES, storeDocument } from "@/lib/portal/documents";
import { fail, json, rateLimited, withCustomer } from "@/lib/portal/http";

export const GET = withCustomer(({ customer }) =>
  json(customer.documentIds.map((id) => db().documents.get(id)).filter((d): d is NonNullable<typeof d> => !!d).map(toDocumentDto)),
);

export const POST = withCustomer(async ({ req, user, customer }) => {
  const limit = rateLimited(req, "upload", 20, 60 * 60_000, user.id);
  if (limit) return limit;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_DOC_BYTES + 100_000) return fail(413, "file_too_large");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, "invalid_body");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "invalid_body");
  const result = storeDocument(user, customer, file.name, Buffer.from(await file.arrayBuffer()), String(form.get("purpose") ?? "other"));
  return result.ok ? json(toDocumentDto(result.doc), 201) : fail(result.status, result.code);
});
