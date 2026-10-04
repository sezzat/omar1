import { db } from "@/lib/portal/db";
import { devOnly, json } from "@/lib/portal/http";

/** Development only: lists queued transactional emails so verification and reset links can be opened without a mail server. */
export function GET(req: Request) {
  const blocked = devOnly();
  if (blocked) return blocked;
  const to = new URL(req.url).searchParams.get("to")?.toLowerCase();
  const list = db().outbox.filter((m) => !to || m.to === to).slice(-50).reverse();
  return json(list.map(({ id, to, template, subject, body, link, status, createdAt }) => ({ id, to, template, subject, body, link, status, createdAt })));
}
