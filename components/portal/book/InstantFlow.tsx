"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiFailure, api } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import { formatDay } from "@/lib/portal/format";
import type { Availability, PublicSpace } from "@/lib/catalog/types";
import type { BookingDto, CheckoutDto, PackageBalanceDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { ErrorState, Loading, Money, errorMessage, useApi } from "../ui";
import {
  MAX_HOURS, SpaceChoice, Steps, addDays, pad2, safeCheckoutPath, unitPrice, unitsText, useClock, useSessionGuard,
  useStepHeading, useUnitLabels, validDate,
} from "./shared";

export interface InstantInitial { space?: string; date?: string; start?: string; hours?: number }
type Slot = { start: string; available: boolean };
interface Failure { code: string; alternatives: string[] }

const ALT_TIME = /^\d{2}:00$/;
const ALT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True when every hour from start to start+hours is free and not already past. */
function fits(slots: Slot[], start: string, hours: number, isToday: boolean, hourNow: number): boolean {
  const h = Number(start.slice(0, 2));
  for (let i = 0; i < hours; i++) {
    const s = slots.find((x) => x.start === `${pad2(h + i)}:00`);
    if (!s || !s.available || (isToday && h + i <= hourNow)) return false;
  }
  return true;
}

export function InstantFlow({ spaces, initial }: { spaces: PublicSpace[]; initial: InstantInitial }) {
  const { lang, t, me } = usePortal();
  const router = useRouter();
  const guard = useSessionGuard();
  const unit = useUnitLabels();
  const ids = { spaceErr: useId(), first: useId(), date: useId(), dateErr: useId(), dur: useId(), slotsErr: useId(), slotsHelp: useId(), payGroup: useId() };
  const [clock, refreshClock] = useClock();
  const m = t.book.instant;

  const [step, setStep] = useState<1 | 2 | 3>(initial.space ? 2 : 1);
  const [slug, setSlug] = useState(initial.space ?? "");
  const [date, setDate] = useState(initial.date ?? clock.date);
  const [hours, setHours] = useState(initial.hours ?? 1);
  const [start, setStart] = useState(initial.start ?? "");
  const [choice, setChoice] = useState<"package" | "online" | null>(null);
  const [held, setHeld] = useState<BookingDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Failure | null>(null);
  const [stepErr, setStepErr] = useState<{ field: "space" | "date" | "time"; text: string } | null>(null);
  const [notice, setNotice] = useState("");
  const heading = useStepHeading(step);
  const errRef = useRef<HTMLDivElement>(null);

  const space = spaces.find((s) => s.slug === slug);
  const hourly = !!space && !space.quantityBased;
  const dateOk = validDate(date, clock.date);
  const isToday = date === clock.date;

  const availPath = space && dateOk && step >= 2 ? `/api/v1/public/spaces/${encodeURIComponent(space.slug)}/availability?date=${date}` : null;
  const avail = useApi<{ data: Availability }>(availPath);
  const a = !avail.loading && avail.data?.data.date === date ? avail.data.data : null;
  const slots = useMemo(() => (a?.kind === "hourly" ? a.slots.filter((s) => !isToday || Number(s.start.slice(0, 2)) > clock.hour) : []), [a, isToday, clock.hour]);
  const seatsLeft = a?.kind === "daily" ? a.seatsLeft : null;

  const packages = useApi<PackageBalanceDto[]>("/api/v1/customer/packages");
  const units = hourly ? hours : 1;
  const price = space ? (hourly ? unitPrice(space, "hour") * hours : unitPrice(space, "day")) : 0;
  const covering = useMemo(() => {
    if (!space || !packages.data) return undefined;
    return packages.data
      .filter((p) => p.appliesTo === space.kind && p.status === "Active" && p.validFrom <= clock.date && p.validTo >= date && p.remaining >= units)
      .sort((x, y) => x.validTo.localeCompare(y.validTo))[0];
  }, [space, packages.data, clock.date, date, units]);
  const partial = useMemo(() => {
    if (!space || !packages.data || covering) return undefined;
    return packages.data.find((p) => p.appliesTo === space.kind && p.status === "Active" && p.validTo >= date && p.remaining > 0);
  }, [space, packages.data, covering, date]);
  const pay: "package" | "online" = covering && choice !== "online" ? "package" : "online";

  // When the chosen start no longer fits (new length, new day, or taken meanwhile), clear it and say why.
  useEffect(() => {
    if (step !== 2 || !start || a?.kind !== "hourly") return;
    if (!fits(slots, start, hours, isToday, clock.hour)) {
      setNotice(fmt(m.when.noFit, { time: start, length: unit.hours(hours) }));
      setStart("");
    }
  }, [step, start, a, slots, hours, isToday, clock.hour, m.when.noFit, unit]);

  useEffect(() => {
    if (err) errRef.current?.focus();
  }, [err]);

  useEffect(() => {
    if (!stepErr) return;
    const id = stepErr.field === "space" ? ids.first : stepErr.field === "date" ? ids.date : `${ids.slotsErr}-first`;
    document.getElementById(id)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepErr]);

  function discardHeld() {
    if (held && held.status === "Draft") api(`/api/v1/customer/bookings/${encodeURIComponent(held.id)}/cancel`, { method: "POST" }).catch(() => undefined);
    setHeld(null);
  }
  function go(n: 1 | 2 | 3) {
    if (n < step) discardHeld();
    setErr(null);
    setStepErr(null);
    if (n === 2) refreshClock();
    setStep(n);
  }

  function next() {
    setNotice("");
    if (step === 1) {
      if (!space) return setStepErr({ field: "space", text: m.space.required });
      return go(2);
    }
    if (!dateOk) return setStepErr({ field: "date", text: m.when.dateRequired });
    if (hourly) {
      if (!start || !a || a.kind !== "hourly" || !fits(slots, start, hours, isToday, clock.hour)) return setStepErr({ field: "time", text: m.when.timeRequired });
    } else if (seatsLeft === null || seatsLeft <= 0) {
      return setStepErr({ field: "date", text: m.when.seatsRequired });
    }
    go(3);
  }

  async function submit() {
    if (busy || !space) return;
    setBusy(true);
    setErr(null);
    let created = held !== null;
    try {
      let booking = held;
      if (!booking) {
        booking = await api<BookingDto>("/api/v1/customer/bookings", {
          json: { kind: "instant", spaceSlug: space.slug, date, ...(hourly ? { startTime: start, hours } : {}), ...(pay === "package" ? { usePackage: true } : {}) },
        });
        created = true;
        setHeld(booking);
      }
      if (booking.status === "Confirmed") {
        router.push(`/${lang}/portal/bookings/${encodeURIComponent(booking.id)}?created=1`);
        return;
      }
      const co = await api<CheckoutDto>(`/api/v1/customer/bookings/${encodeURIComponent(booking.id)}/checkout`, { method: "POST" });
      const path = safeCheckoutPath(co.checkoutPath);
      if (!path) throw new ApiFailure(502, "generic");
      window.location.assign(`/${lang}${path}`);
    } catch (e) {
      if (guard(e)) return;
      const code = e instanceof ApiFailure ? e.code : "generic";
      const raw = e instanceof ApiFailure ? e.details?.alternatives : undefined;
      const alternatives = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string" && (ALT_TIME.test(x) || ALT_DATE.test(x))) : [];
      if (code === "hold_expired" || code === "booking_not_found") setHeld(null);
      if (code === "slot_taken") avail.reload();
      if (code === "package_not_applicable") {
        setChoice("online");
        packages.reload();
      }
      if (!created && code === "network") setHeld(null);
      setErr({ code, alternatives });
      setBusy(false);
    }
  }

  function pickAlternative(value: string) {
    if (hourly) setStart(value);
    else setDate(value);
    setErr(null);
  }

  /* ------------------------------------------------------------------ render */

  const whenText = space && dateOk ? formatDay(lang, date, "short") : t.book.notChosen;
  const timeText = hourly ? (start ? `${start} – ${pad2(Number(start.slice(0, 2)) + hours)}:00` : t.book.notChosen) : null;

  const summary = (
    <aside className="pcard bw-aside" aria-labelledby={`${ids.payGroup}-sum`}>
      <div className="pcard__head"><h2 id={`${ids.payGroup}-sum`}>{m.summary.heading}</h2></div>
      <div className="pcard__body">
        <dl className="bw-sum">
          <dt>{m.summary.space}</dt><dd>{space ? space.name[lang] : t.book.notChosen}</dd>
          <dt>{m.summary.date}</dt><dd>{whenText}</dd>
          {hourly && <><dt>{m.summary.time}</dt><dd className={start ? "ltr" : undefined}>{timeText}</dd></>}
          {hourly && <><dt>{m.summary.length}</dt><dd>{unit.hours(hours)}</dd></>}
          {space && <><dt>{m.summary.price}</dt><dd><Money amount={price} /></dd></>}
          {step === 3 && pay === "package" && <><dt /><dd>{m.summary.covered}</dd></>}
          {space && (
            <div className="bw-sum__total">
              <span>{m.summary.total}</span>
              <Money amount={step === 3 && pay === "package" ? 0 : price} />
            </div>
          )}
        </dl>
      </div>
    </aside>
  );

  function errorBlock() {
    if (!err) return null;
    const e = m.errors;
    const bookingHref = held ? `/${lang}/portal/bookings/${encodeURIComponent(held.id)}` : null;
    const retry = <button type="button" className="btn" onClick={submit} disabled={busy}>{e.retry}</button>;
    let body: React.ReactNode;
    switch (err.code) {
      case "slot_taken":
        body = (
          <>
            <p><b>{e.slotTaken}</b> {err.alternatives.length === 0 ? e.slotTakenNone : hourly ? e.slotTakenTimes : e.slotTakenDays}</p>
            {err.alternatives.length > 0 && (
              <div role="group" aria-label={hourly ? e.altTimes : e.altDays} className="bw-links">
                {err.alternatives.map((alt) => (
                  <button key={alt} type="button" className="btn btn--sm" onClick={() => pickAlternative(alt)}>
                    {hourly ? <span className="ltr">{alt} – {pad2(Number(alt.slice(0, 2)) + hours)}:00</span> : formatDay(lang, alt, "short")}
                  </button>
                ))}
              </div>
            )}
          </>
        );
        break;
      case "email_not_verified":
        body = (
          <>
            <p>{e.emailNotVerified}</p>
            <div className="bw-links">{retry}{bookingHref && <Link className="btn btn--ghost" href={bookingHref}>{e.openBooking}</Link>}</div>
          </>
        );
        break;
      case "gateway_unavailable":
        body = (
          <>
            <p>{e.gateway}</p>
            <div className="bw-links">{retry}{bookingHref && <Link className="btn btn--ghost" href={bookingHref}>{e.openBooking}</Link>}</div>
          </>
        );
        break;
      case "hold_expired":
        body = (
          <>
            <p>{e.holdExpired}</p>
            <div className="bw-links"><button type="button" className="btn" onClick={() => go(2)}>{e.chooseAgain}</button></div>
          </>
        );
        break;
      case "booking_not_allowed":
        body = (
          <>
            <p>{e.notAllowed}</p>
            <div className="bw-links"><Link className="btn" href={`/${lang}/contact`}>{e.contact}</Link></div>
          </>
        );
        break;
      case "already_booked_that_day":
        body = (
          <>
            <p>{e.alreadyBooked}</p>
            <div className="bw-links"><Link className="btn" href={`/${lang}/portal/bookings`}>{e.viewBookings}</Link></div>
          </>
        );
        break;
      case "invalid_time":
      case "slot_in_past":
      case "invalid_date":
        body = (
          <>
            <p>{err.code === "invalid_time" ? e.invalidTime : errorMessage(t, new ApiFailure(400, err.code))}</p>
            <div className="bw-links"><button type="button" className="btn" onClick={() => go(2)}>{e.chooseAgain}</button></div>
          </>
        );
        break;
      default:
        body = (
          <>
            <p>{errorMessage(t, new ApiFailure(err.code === "network" ? 0 : 400, err.code))}</p>
            <div className="bw-links">{retry}{bookingHref && <Link className="btn btn--ghost" href={bookingHref}>{e.openBooking}</Link>}</div>
          </>
        );
    }
    return (
      <div className="banner banner--warning bw-banner" role="alert" tabIndex={-1} ref={errRef}>
        {body}
      </div>
    );
  }

  const stepErrFor = (f: "space" | "date" | "time") => (stepErr?.field === f ? stepErr.text : undefined);
  const showPackages = !!space && step === 3;

  return (
    <div className="pgrid">
      <div className="pcol">
        <section className="pcard" aria-labelledby={`${ids.payGroup}-h`}>
          <div className="pcard__head"><Steps labels={[m.steps.space, m.steps.when, m.steps.review]} current={step} /></div>
          <div className="pcard__body bw-body">
            {step === 1 && (
              <>
                <h2 id={`${ids.payGroup}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{m.space.heading}</h2>
                <SpaceChoice
                  spaces={spaces} value={slug} legend={m.space.legend} error={stepErrFor("space")} errorId={ids.spaceErr} firstId={ids.first}
                  onChange={(s) => { setSlug(s); setStart(""); setStepErr(null); }}
                />
              </>
            )}

            {step === 2 && space && (
              <>
                <h2 id={`${ids.payGroup}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{m.when.heading}</h2>
                <div className="bw-fields">
                  <div className={`field${!dateOk || stepErrFor("date") ? " field--error" : ""}`}>
                    <label className="label" htmlFor={ids.date}>{m.when.date}</label>
                    <input
                      id={ids.date} type="date" className="input" dir="ltr" required min={clock.date} max={addDays(clock.date, 365)} value={date}
                      aria-invalid={!dateOk || !!stepErrFor("date") ? true : undefined} aria-describedby={`${ids.dateErr} ${ids.dateErr}-h`}
                      onChange={(e) => { setDate(e.target.value); setStart(""); setNotice(""); setStepErr(null); refreshClock(); }}
                    />
                    <span className="help" id={`${ids.dateErr}-h`}>{m.when.dateHelp}</span>
                    <span className="error" id={ids.dateErr} role={dateOk ? undefined : "alert"}>{!dateOk ? m.when.dateInvalid : stepErrFor("date")}</span>
                  </div>
                  {hourly && (
                    <div className="field">
                      <label className="label" htmlFor={ids.dur}>{m.when.duration}</label>
                      <select id={ids.dur} className="select" value={hours} onChange={(e) => { setHours(Number(e.target.value)); setStepErr(null); }}>
                        {Array.from({ length: MAX_HOURS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{unit.hours(n)}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div aria-live="polite">
                  {dateOk && avail.loading && <Loading label={m.when.checking} />}
                  {dateOk && !avail.loading && avail.error != null && <ErrorState error={avail.error} onRetry={avail.reload} />}
                  {notice && <p className="bw-warn">{notice}</p>}
                </div>

                {dateOk && a?.kind === "hourly" && (
                  <fieldset className="bw-fieldset" aria-describedby={`${ids.slotsHelp} ${ids.slotsErr}`}>
                    <legend className="label">{m.when.slots}</legend>
                    {slots.some((s) => fits(slots, s.start, hours, isToday, clock.hour)) ? (
                      <>
                        <div className="bw-slots">
                          {slots.map((s, i) => {
                            const ok = fits(slots, s.start, hours, isToday, clock.hour);
                            return (
                              <button
                                key={s.start} type="button" id={i === 0 ? `${ids.slotsErr}-first` : undefined}
                                className="pill bw-pill ltr" aria-pressed={start === s.start} aria-disabled={ok ? undefined : true}
                                onClick={() => { if (ok) { setStart(s.start); setNotice(""); setStepErr(null); } }}
                              >
                                {s.start}{!ok && <span className="sr-only"> ({m.when.slotUnavailable})</span>}
                              </button>
                            );
                          })}
                        </div>
                        <span className="help" id={ids.slotsHelp}>{m.when.slotsHelp}</span>
                      </>
                    ) : (
                      <p className="bw-note" id={ids.slotsHelp}>{m.when.noSlots}</p>
                    )}
                    <p className="error" id={ids.slotsErr} role="alert">{stepErrFor("time")}</p>
                  </fieldset>
                )}

                {dateOk && a?.kind === "daily" && (
                  <div className="bw-stack" style={{ gap: "var(--space-2)" }}>
                    {a.seatsLeft > 0 ? <p><b>{a.seatsLeft === 1 ? m.when.seatsOne : fmt(m.when.seatsLeft, { n: a.seatsLeft })}</b></p> : <p className="bw-warn" role="alert">{m.when.noSeats}</p>}
                    <p className="bw-note">{m.when.dayPass}</p>
                  </div>
                )}
              </>
            )}

            {step === 3 && space && (
              <>
                <h2 id={`${ids.payGroup}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{m.review.heading}</h2>
                <p>
                  <b>{space.name[lang]}</b>
                  <br />
                  {formatDay(lang, date)}
                  {hourly && <> <span className="ltr">{start} – {pad2(Number(start.slice(0, 2)) + hours)}:00</span></>}
                </p>

                {showPackages && packages.loading && <Loading />}
                {showPackages && !packages.loading && packages.error != null && <p className="bw-note">{m.review.packagesFailed}</p>}
                {covering && (
                  <fieldset className="bw-fieldset">
                    <legend className="label">{m.review.payLegend}</legend>
                    <div className="bw-choices">
                      <label className="bw-choice">
                        <input type="radio" name={ids.payGroup} checked={pay === "package"} disabled={busy} onChange={() => { discardHeld(); setErr(null); setChoice("package"); }} />
                        <span className="bw-choice__main">
                          <b>{fmt(m.review.usePackage, { left: unitsText(t, covering.unit, covering.remaining) })}</b>
                          <small>{covering.name[lang]}</small>
                        </span>
                      </label>
                      <label className="bw-choice">
                        <input type="radio" name={ids.payGroup} checked={pay === "online"} disabled={busy} onChange={() => { discardHeld(); setErr(null); setChoice("online"); }} />
                        <span className="bw-choice__main"><b>{m.review.payOnline}</b><small><Money amount={price} /></small></span>
                      </label>
                    </div>
                  </fieldset>
                )}
                {partial && (
                  <p className="bw-note">{fmt(m.review.packageShort, { name: partial.name[lang], left: unitsText(t, partial.unit, partial.remaining) })}</p>
                )}

                {pay === "online" && me.permissions.needsEmailVerification && <div className="banner banner--info" role="note"><div>{m.review.verifyNote}</div></div>}
                {errorBlock()}
              </>
            )}

            <div className="bw-actions">
              {step > 1 ? <button type="button" className="btn btn--ghost" onClick={() => go((step - 1) as 1 | 2)} disabled={busy}>{t.book.back}</button> : <span />}
              <div className="bw-actions__end">
                {step === 3 ? (
                  <button type="button" className="btn btn--primary btn--lg" onClick={submit} disabled={busy}>
                    {pay === "package" ? m.review.confirm : m.review.pay}
                  </button>
                ) : (
                  <button type="button" className="btn btn--dark" onClick={next}>{t.book.continue}</button>
                )}
              </div>
            </div>
            {step === 3 && <p className="bw-note">{pay === "package" ? m.review.holdPackage : m.review.hold}</p>}
            <div className="sr-only" role="status" aria-live="polite">{busy ? (pay === "package" ? m.review.busyConfirm : m.review.busyPay) : ""}</div>
          </div>
        </section>
      </div>
      <div className="pcol pcol--side">{summary}</div>
    </div>
  );
}

