"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, formatEgp, type Loc } from "@/lib/format";
import { localize } from "@/lib/i18n";
import { remaining } from "@/lib/portal/format";
import type { PortalMessages } from "@/lib/portal/messages";
import type { L10n } from "@/lib/i18n";
import "./checkout.css";

interface Session {
  id: string;
  amountEgp: number;
  status: "open" | "paid" | "failed" | "expired";
  bookingId: string;
  bookingRef: string;
  spaceName: L10n | null;
  expiresAt: string;
}

type Outcome = "paid" | "paid_lost_webhook" | "declined" | "abandoned";
type Load = { kind: "loading" } | { kind: "ready"; session: Session } | { kind: "notfound" } | { kind: "error" };

/** Only same-site portal paths are followed after an outcome. */
function safeReturn(path: unknown): string | null {
  return typeof path === "string" && /^\/portal\/[A-Za-z0-9/_?=&.-]*$/.test(path) && !path.includes("//") ? path : null;
}

export function Checkout({ lang, sessionId, messages }: { lang: Loc; sessionId: string; messages: PortalMessages["checkout"] }) {
  const m = messages;
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const fetchSession = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const res = await fetch(`/api/v1/mock-gateway/sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (res.status === 404) return setLoad({ kind: "notfound" });
      if (!res.ok) return setLoad({ kind: "error" });
      setLoad({ kind: "ready", session: (await res.json()) as Session });
    } catch {
      setLoad({ kind: "error" });
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const session = load.kind === "ready" ? load.session : null;
  const left = session ? remaining(session.expiresAt, now) : null;
  const expired = !!session && (session.status === "expired" || (session.status === "open" && left!.total === 0));
  const closed = !!session && !expired && session.status !== "open";
  const finished = expired || closed || load.kind === "notfound";

  useEffect(() => {
    if (finished) headingRef.current?.focus();
  }, [finished]);

  async function choose(outcome: Outcome) {
    if (busy || !session) return;
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/v1/mock-gateway/sessions/${encodeURIComponent(session.id)}/complete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { returnPath?: string };
      const path = safeReturn(data.returnPath);
      if (!path) throw new Error("bad return path");
      router.push(`/${lang}${path}`);
    } catch {
      setError(m.actionFailed);
      setBusy(null);
    }
  }

  const other: Loc = lang === "ar" ? "en" : "ar";
  const bookingHref = session ? `/${lang}/portal/bookings/${encodeURIComponent(session.bookingId)}` : `/${lang}/portal/bookings`;

  const actions: { outcome: Outcome; label: string; help: string; cls?: string }[] = [
    { outcome: "paid", label: m.pay, help: m.payHelp, cls: "co__btn--pay" },
    { outcome: "paid_lost_webhook", label: m.payDelayed, help: m.payDelayedHelp },
    { outcome: "declined", label: m.decline, help: m.declineHelp },
    { outcome: "abandoned", label: m.abandon, help: m.abandonHelp },
  ];

  return (
    <div className="co">
      <div className="co__banner" role="note">
        {m.banner}
        <small>{m.bannerNote}</small>
      </div>
      <div className="co__top">
        <a href={`/${other}/checkout/${encodeURIComponent(sessionId)}`} lang={other} hrefLang={other}>{m.switchLanguage}</a>
      </div>
      <main className="co__main">
        {load.kind === "loading" && <p className="co__loading" role="status">{m.loading}</p>}

        {load.kind === "error" && (
          <section className="co__card">
            <p className="co__error" role="alert">{m.loadFailed}</p>
            <button type="button" className="co__btn" onClick={() => void fetchSession()}>{m.retry}</button>
          </section>
        )}

        {load.kind === "notfound" && (
          <section className="co__card co__msg">
            <h1 ref={headingRef} tabIndex={-1}>{m.notFoundTitle}</h1>
            <p>{m.notFoundText}</p>
            <a className="co__link" href={`/${lang}/portal/bookings`}>{m.toBookings}</a>
          </section>
        )}

        {session && (expired || closed) && (
          <section className="co__card co__msg" role="status">
            <h1 ref={headingRef} tabIndex={-1}>{expired ? m.expiredTitle : m.closedTitle}</h1>
            <p>{expired ? m.expiredText : m.closedText}</p>
            <a className="co__link" href={bookingHref}>{m.backToBooking}</a>
          </section>
        )}

        {session && !expired && !closed && left && (
          <>
            <section className="co__card" aria-labelledby="co-title">
              <p className="co__merchant">{m.merchant}: <b>{m.merchantName}</b></p>
              <h1 id="co-title" className="sr-only">{m.pageTitle}</h1>
              <div>
                <p className="co__merchant">{m.amount}</p>
                <p className="co__amount">{formatEgp(lang, session.amountEgp)}</p>
              </div>
              <dl className="co__facts">
                <dt>{m.booking}</dt>
                <dd dir="ltr">{session.bookingRef}</dd>
                {session.spaceName && (<><dt>{m.space}</dt><dd>{localize(lang, session.spaceName)}</dd></>)}
                <dt>{m.timeLeft}</dt>
                <dd><span className={`co__timer${left.total < 120 ? " is-low" : ""}`} dir="ltr" role="timer">{fmt(m.timeLeftValue, { mm: left.mm, ss: left.ss })}</span></dd>
              </dl>
            </section>

            <section className="co__card" aria-labelledby="co-outcomes">
              <h2 id="co-outcomes">{m.outcomesTitle}</h2>
              <div className="co__actions">
                {actions.map((a) => (
                  <div className="co__action" key={a.outcome}>
                    <button type="button" className={`co__btn ${a.cls ?? ""}`} disabled={busy !== null} onClick={() => void choose(a.outcome)} aria-describedby={`co-help-${a.outcome}`}>
                      {busy === a.outcome ? m.working : a.label}
                    </button>
                    <p id={`co-help-${a.outcome}`}>{a.help}</p>
                  </div>
                ))}
              </div>
              <p className="co__error" role="alert">{error}</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
