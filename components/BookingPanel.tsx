"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import { addDaysIso, todayIso } from "@/lib/dates";
import { fmt, formatDate, formatEgp, type Loc } from "@/lib/format";
import type { Availability, Envelope, PriceUnit } from "@/lib/catalog/types";

export interface PanelText {
  bookTitle: string; requestTitle: string; date: string; startTime: string; duration: string;
  hours1: string; hours2: string; hours3: string; slotsHelp: string; conflict: string;
  summaryWhen: string; summaryLine: string; total: string; bookAndPay: string; holdNote: string;
  packageNote: string; signInToUse: string; packageNoteEnd: string; loading: string; loadError: string;
  retry: string; dayTitle: string; seatsLeft: string; dayTotal: string; dayHelp: string;
  requestLead: string; earliestStart: string; startDate: string; term: string;
  term3: string; term6: string; term12: string; requestCta: string; requestNote: string;
  perHour: string; perDay: string; perMonth: string; from: string;
}

export interface PanelSpace {
  slug: string;
  bookingMode: "instant" | "request";
  quantityBased: boolean;
  price: { unit: PriceUnit; amount: number };
}

type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Availability };

export function BookingPanel({ locale, space, t }: { locale: Loc; space: PanelSpace; t: PanelText }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState<string | null>(null);
  const [wantedStart, setWantedStart] = useState<string | null>(null);
  const [hours, setHours] = useState(1);
  const [term, setTerm] = useState(3);
  const [monthStart, setMonthStart] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Preset from the home-page picker (?date=...&start=...), otherwise tomorrow.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("date");
    setDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayIso() ? d : addDaysIso(1));
    setWantedStart(q.get("start"));
  }, []);

  useEffect(() => {
    if (!date) return;
    const ctrl = new AbortController();
    setState({ status: "loading" });
    fetch(`/api/v1/public/spaces/${space.slug}/availability?date=${date}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Envelope<Availability>>) : Promise.reject(new Error(String(r.status)))))
      .then(({ data }) => {
        setState({ status: "ready", data });
        if (data.kind === "hourly") {
          const free = data.slots.filter((s) => s.available);
          setStart((prev) => {
            const keep = [prev, wantedStart].find((c) => c && free.some((s) => s.start === c));
            return keep ?? free[0]?.start ?? null;
          });
        }
        if (data.kind === "monthly") setMonthStart((prev) => prev || data.earliestStart);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setState({ status: "error" });
      });
    return () => ctrl.abort();
  }, [date, space.slug, attempt, wantedStart]);

  const hourLabels: Record<number, string> = { 1: t.hours1, 2: t.hours2, 3: t.hours3 };
  const unitText = space.price.unit === "hour" ? t.perHour : space.price.unit === "day" ? t.perDay : t.perMonth;

  const conflict = useMemo(() => {
    if (state.status !== "ready" || state.data.kind !== "hourly" || !start) return false;
    const slots = state.data.slots;
    const i = slots.findIndex((s) => s.start === start);
    if (i < 0) return true;
    const needed = slots.slice(i, i + hours);
    return needed.length < hours || needed.some((s) => !s.available);
  }, [state, start, hours]);

  const heading = space.bookingMode === "request" ? t.requestTitle : space.quantityBased ? t.dayTitle : t.bookTitle;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ space: space.slug, ...extra }).toString();

  return (
    <form className="book" aria-labelledby="book-title" onSubmit={(e) => e.preventDefault()}>
      <div className="book__head">
        <h2 id="book-title">{heading}</h2>
        <span className="price">
          <span className="from">{t.from}</span>
          {formatEgp(locale, space.price.amount)} <small>{unitText}</small>
        </span>
      </div>

      {space.bookingMode === "request" ? (
        <>
          <p className="muted">{t.requestLead}</p>
          <div className="field">
            <label className="label" htmlFor="bk-start">{t.startDate}</label>
            <input className="input num" id="bk-start" type="date" min={todayIso()} value={monthStart} onChange={(e) => setMonthStart(e.target.value)} />
            {state.status === "ready" && state.data.kind === "monthly" && (
              <span className="help">{t.earliestStart}: <span className="num">{formatDate(locale, state.data.earliestStart)}</span></span>
            )}
          </div>
          <div className="field">
            <label className="label" htmlFor="bk-term">{t.term}</label>
            <select className="select" id="bk-term" value={term} onChange={(e) => setTerm(Number(e.target.value))}>
              <option value={3}>{t.term3}</option>
              <option value={6}>{t.term6}</option>
              <option value={12}>{t.term12}</option>
            </select>
          </div>
          <div className="sum">
            <div className="total">
              <span>{t.total}</span>
              <span className="num">{formatEgp(locale, space.price.amount * term)}</span>
            </div>
          </div>
          <Link className="btn btn--primary btn--lg btn--block" href={`/${locale}/account?${qs({ mode: "request", start: monthStart, term: String(term) })}`}>
            {t.requestCta}
          </Link>
          <p className="note"><Icon name="info" size={16} />{t.requestNote}</p>
        </>
      ) : (
        <>
          <div className="field">
            <label className="label" htmlFor="bk-date">{t.date}</label>
            <input className="input num" id="bk-date" type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div aria-live="polite">
            {state.status === "loading" && <p className="muted">{t.loading}</p>}
            {state.status === "error" && (
              <div className="banner banner--warning" role="alert">
                <Icon name="alert" size={20} />
                <div>
                  {t.loadError}{" "}
                  <button type="button" className="btn btn--sm" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button>
                </div>
              </div>
            )}
          </div>

          {state.status === "ready" && state.data.kind === "hourly" && (
            <>
              <div className="field">
                <span className="label" id="bk-slot-label">{t.startTime}</span>
                <div className="slots" role="group" aria-labelledby="bk-slot-label">
                  {state.data.slots.map((s) => (
                    <button key={s.start} type="button" className="pill" aria-pressed={s.start === start} disabled={!s.available} onClick={() => setStart(s.start)}>
                      {s.start}
                    </button>
                  ))}
                </div>
                <span className="help">{t.slotsHelp}</span>
              </div>
              <div className="field">
                <span className="label" id="bk-dur-label">{t.duration}</span>
                <div className="pills" role="group" aria-labelledby="bk-dur-label">
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" className="pill" aria-pressed={n === hours} onClick={() => setHours(n)}>
                      {hourLabels[n]}
                    </button>
                  ))}
                </div>
              </div>
              {conflict && (
                <div className="banner banner--warning" role="alert">
                  <Icon name="alert" size={20} />
                  <div>{t.conflict}</div>
                </div>
              )}
              <div className="sum">
                <div>
                  <span>{t.summaryWhen}</span>
                  <span className="num ltr">{start ? `${start} – ${String(Number(start.slice(0, 2)) + hours).padStart(2, "0")}:00` : "—"}</span>
                </div>
                <div>
                  <span>{fmt(t.summaryLine, { hours: hourLabels[hours], price: formatEgp(locale, space.price.amount) })}</span>
                  <span className="num">{formatEgp(locale, space.price.amount * hours)}</span>
                </div>
                <div className="total">
                  <span>{t.total}</span>
                  <span className="num">{formatEgp(locale, space.price.amount * hours)}</span>
                </div>
              </div>
              {conflict || !start ? (
                <button className="btn btn--primary btn--lg btn--block" type="button" disabled>{t.bookAndPay}</button>
              ) : (
                <Link className="btn btn--primary btn--lg btn--block" href={`/${locale}/account?${qs({ mode: "book", date, start, hours: String(hours) })}`}>
                  {t.bookAndPay}
                </Link>
              )}
            </>
          )}

          {state.status === "ready" && state.data.kind === "daily" && (
            <>
              <p className="muted">{t.dayHelp}</p>
              <p className="num">{fmt(t.seatsLeft, { n: state.data.seatsLeft, total: state.data.seatsTotal })}</p>
              <div className="sum">
                <div>
                  <span>{t.summaryWhen}</span>
                  <span className="num">{formatDate(locale, date)}</span>
                </div>
                <div className="total">
                  <span>{t.dayTotal}</span>
                  <span className="num">{formatEgp(locale, space.price.amount)}</span>
                </div>
              </div>
              {state.data.seatsLeft > 0 ? (
                <Link className="btn btn--primary btn--lg btn--block" href={`/${locale}/account?${qs({ mode: "book", date })}`}>
                  {t.bookAndPay}
                </Link>
              ) : (
                <button className="btn btn--primary btn--lg btn--block" type="button" disabled>{t.bookAndPay}</button>
              )}
            </>
          )}

          <p className="note"><Icon name="clock" size={16} />{t.holdNote}</p>
          <p className="note">
            <Icon name="lock" size={16} />
            <span>{t.packageNote} <Link href={`/${locale}/account`}>{t.signInToUse}</Link> {t.packageNoteEnd}</span>
          </p>
        </>
      )}
    </form>
  );
}
