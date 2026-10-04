import { newId } from "./crypto";
import { db } from "./db";
import { permissionsFor } from "./bookings";
import type { CustomerRecord, DocumentRecord, UserRecord } from "./types";

export const MAX_DOC_BYTES = 5 * 1024 * 1024;
const MAX_DOCS_PER_CUSTOMER = 10;
export type DocResult = { ok: true; doc: DocumentRecord } | { ok: false; status: number; code: string };

/** The real file type is decided from the first bytes, not from the filename or the browser's claim. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

export function storeDocument(user: UserRecord, customer: CustomerRecord, name: string, buf: Buffer, purpose: string): DocResult {
  // Documents are collected for monthly requests, so they follow the same eligibility.
  if (!permissionsFor(user, customer).canRequestMonthly) return { ok: false, status: 403, code: "booking_not_allowed" };
  if (buf.length === 0) return { ok: false, status: 400, code: "empty_file" };
  if (buf.length > MAX_DOC_BYTES) return { ok: false, status: 413, code: "file_too_large" };
  const mime = sniffMime(buf);
  if (!mime) return { ok: false, status: 415, code: "unsupported_type" };
  if (customer.documentIds.length >= MAX_DOCS_PER_CUSTOMER) return { ok: false, status: 409, code: "too_many_documents" };
  const safeName = name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "document";
  const doc: DocumentRecord = {
    id: newId("doc"), customerId: customer.id, name: safeName, mime, sizeBytes: buf.length,
    purpose: purpose === "identity" || purpose === "commercial-registration" ? purpose : "other", uploadedAt: new Date().toISOString(), data: buf,
  };
  db().documents.set(doc.id, doc);
  customer.documentIds.push(doc.id);
  return { ok: true, doc };
}

export function deleteDocument(customer: CustomerRecord, id: string): { ok: true } | { ok: false; status: number; code: string } {
  const doc = db().documents.get(id);
  if (!doc || doc.customerId !== customer.id) return { ok: false, status: 404, code: "document_not_found" };
  const inUse = [...db().bookings.values()].some((b) => b.documentIds.includes(id) && (b.status === "Pending" || b.status === "Confirmed"));
  if (inUse) return { ok: false, status: 409, code: "document_in_use" };
  db().documents.delete(id);
  customer.documentIds = customer.documentIds.filter((x) => x !== id);
  return { ok: true };
}
