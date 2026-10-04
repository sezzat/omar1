"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiFailure } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import type { PublicSpace } from "@/lib/catalog/types";
import { usePortal } from "../PortalProvider";
import type { PortalMessages } from "@/lib/portal/messages";
import { Money } from "../ui";
import "./book.css";

export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 17;
export const MAX_HOURS = 3;
export type Mode = "instant" | "request";

/* ------------------------------------------------------------------ dates (Alexandria wall clock) */

export function cairoNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Today and the current hour in Alexandria, refreshed every minute so past hours drop out. */
export function useClock() {
  const [clock, setClock] = useState(cairoNow);
  useEffect(() => {
    const id = window.setInterval(() => setClock(cairoNow()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return [clock, () => setClock(cairoNow())] as const;
}

export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A date the API accepts: today up to one year ahead. */
export function validDate(v: string, today: string): boolean {
  return isIsoDate(v) && v >= today && v <= addDays(today, 365);
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ prices and labels */

export function unitPrice(space: PublicSpace, unit: "hour" | "day" | "month"): number {
  return space.prices.find((p) => p.unit === unit)?.amount ?? space.fromPrice.amount;
}

export function useUnitLabels() {
  const { t } = usePortal();
  return {
    unit: (u: "hour" | "day" | "month") => (u === "hour" ? t.common.perHour : u === "day" ? t.common.perDay : t.common.perMonth),
    hours: (n: number) => (n === 1 ? t.common.hour : fmt(t.common.hours, { n })),
    days: (n: number) => (n === 1 ? t.common.day : fmt(t.common.days, { n })),
  };
}

export function unitsText(t: PortalMessages, unit: "hours" | "days", n: number): string {
  if (unit === "hours") return n === 1 ? t.common.hour : fmt(t.common.hours, { n });
  return n === 1 ? t.common.day : fmt(t.common.days, { n });
}

/* ------------------------------------------------------------------ focus and auth helpers */

/** Heading that receives focus whenever the step changes (not on first render). */
export function useStepHeading(step: number | string) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus();
  }, [step]);
  return ref;
}

/** Sends the visitor to sign in when the session is gone even after the client's one refresh. */
export function useSessionGuard() {
  const router = useRouter();
  const { lang } = usePortal();
  return (e: unknown): boolean => {
    if (e instanceof ApiFailure && e.status === 401) {
      router.replace(`/${lang}/login?next=${encodeURIComponent(`/${lang}/portal/book`)}`);
      return true;
    }
    return false;
  };
}

/** Only hosted checkout paths are followed after the API answers. */
export function safeCheckoutPath(path: unknown): string | null {
  return typeof path === "string" && /^\/checkout\/[A-Za-z0-9_-]{1,80}$/.test(path) ? path : null;
}

/* ------------------------------------------------------------------ pieces */

export function Steps({ labels, current }: { labels: string[]; current: number }) {
  const { t } = usePortal();
  return (
    <div className="bw-progress">
      <ol className="bw-steps" aria-label={t.book.progress}>
        {labels.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label} className={n < current ? "is-done" : n === current ? "is-current" : undefined} aria-current={n === current ? "step" : undefined}>
              <span className="bw-steps__n" aria-hidden="true">{n}</span>
              <span className="bw-steps__label">
                {label}
                {n < current && <span className="sr-only"> ({t.book.stepDone})</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="muted bw-steps__of">{fmt(t.book.stepOf, { n: current, total: labels.length })}</p>
    </div>
  );
}

/** Radio list of spaces. */
export function SpaceChoice({
  spaces, value, onChange, legend, error, errorId, firstId, showFrom,
}: {
  spaces: PublicSpace[]; value: string; onChange: (slug: string) => void; legend: string; error?: string; errorId: string; firstId: string; showFrom?: boolean;
}) {
  const { lang, t } = usePortal();
  const group = useId();
  const unit = useUnitLabels();
  const fromWord = showFrom ? fmt(t.book.request.space.from, { price: "" }).trim() : "";
  return (
    <fieldset className="bw-fieldset" aria-describedby={error ? errorId : undefined}>
      <legend className="label">{legend}</legend>
      <div className="bw-choices" role="radiogroup">
        {spaces.map((s, i) => {
          return (
            <label key={s.slug} className="bw-choice">
              <input
                type="radio" name={group} value={s.slug} checked={value === s.slug} onChange={() => onChange(s.slug)}
                id={i === 0 ? firstId : undefined} aria-invalid={error ? true : undefined}
              />
              <span className="bw-choice__main">
                <b>{s.name[lang]}</b>
                <small>{t.common.kinds[s.kind]}</small>
                <small>{s.quantityBased ? fmt(t.book.space.seats, { n: s.capacity }) : fmt(t.book.space.capacity, { n: s.capacity })}</small>
                <small>{s.summary[lang]}</small>
              </span>
              <span className="bw-choice__price">
                {fromWord && <span className="muted">{fromWord}</span>}
                <Money amount={s.fromPrice.amount} />
                <span className="muted">{unit.unit(s.fromPrice.unit)}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="error" id={errorId} role="alert">{error}</p>}
    </fieldset>
  );
}
