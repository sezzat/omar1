import { problem } from "@/lib/api";
import { clientIp, limited } from "@/lib/rate-limit";

/**
 * Contact form endpoint. In production the backend emails the branch inbox through the Email
 * adapter; no lead record is created (CRM/Leads is deferred in the BRD). Here the adapter is a stub.
 */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (limited(`contact:${clientIp(req)}`, 5, 10 * 60_000)) return problem(429, "rate_limited");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return problem(400, "invalid_body");
  }

  // Honeypot: real visitors never fill the hidden "website" field.
  if (typeof body.website === "string" && body.website.trim() !== "") return Response.json({ ok: true });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const message = String(body.message ?? "").trim();
  const errors: Record<string, string> = {};
  if (name.length < 2 || name.length > 120) errors.name = "name";
  if (!emailRe.test(email) || email.length > 200) errors.email = "email";
  if (message.length < 5 || message.length > 2000) errors.message = "message";
  if (Object.keys(errors).length) return Response.json({ error: { code: "validation", fields: errors } }, { status: 422 });

  console.info("[contact] message for branch inbox", { name, email, length: message.length });
  return Response.json({ ok: true });
}
