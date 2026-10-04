import { verifyLink } from "@/lib/portal/crypto";
import { db } from "@/lib/portal/db";
import { fail } from "@/lib/portal/http";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const exp = Number(q.get("exp"));
  const doc = db().documents.get(id);
  if (!doc || !Number.isFinite(exp) || !verifyLink(`doc:${id}`, exp, q.get("sig") ?? "")) return fail(403, "link_expired");
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
