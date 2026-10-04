"use client";

import { useEffect, useState } from "react";

interface OutboxMessage { template?: string; link?: string | null }

/**
 * Development only. Looks up the queued email for an address and links to its path, so the flow can be finished without a
 * mail server. The endpoint answers 404 in production, and then nothing is rendered.
 */
export function DevOutbox({ email, template, title, text, open }: { email: string; template: string; title: string; text: string; open: string }) {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/dev/outbox?to=${encodeURIComponent(email.trim().toLowerCase())}`, { credentials: "same-origin" });
        if (!res.ok) return;
        const list = (await res.json()) as OutboxMessage[];
        const hit = Array.isArray(list) ? list.find((m) => m.template === template && typeof m.link === "string" && m.link) : undefined;
        if (!hit?.link) return;
        const u = new URL(hit.link, window.location.origin);
        // Keep only the path and query so the link works on any origin, and only for our own language routes.
        if (!/^\/(ar|en)\//.test(u.pathname)) return;
        if (!cancelled) setHref(u.pathname + u.search);
      } catch {
        /* no outbox available */
      }
    })();
    return () => { cancelled = true; };
  }, [email, template]);

  if (!href) return null;
  return (
    <div className="auth__dev" role="note">
      <strong>{title}</strong>
      <span>{text}</span>
      <a href={href} className="ltr">{open}</a>
    </div>
  );
}
