"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ApiFailure, api } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import { formatDay } from "@/lib/portal/format";
import type { PublicSpace } from "@/lib/catalog/types";
import type { BookingDto, DocumentDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { ErrorState, Loading, Money, StatusBadge, errorMessage, fieldMessage, useApi } from "../ui";
import { SpaceChoice, Steps, addDays, unitPrice, useSessionGuard, useStepHeading, validDate, useClock } from "./shared";

export interface RequestInitial { space?: string; term?: 3 | 6 | 12; startDate?: string }
type Purpose = DocumentDto["purpose"];
interface Upload { key: string; name: string; state: "uploading" | "failed"; message?: string }

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DOCS = 10;
const EXT = /\.(pdf|jpe?g|png)$/i;
const MIMES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const TERMS = [3, 6, 12] as const;

const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function RequestFlow({ spaces, initial }: { spaces: PublicSpace[]; initial: RequestInitial }) {
  const { lang, t, me, refreshMe } = usePortal();
  const guard = useSessionGuard();
  const m = t.book.request;
  const d = m.documents;
  const ids = {
    h: useId(), first: useId(), spaceErr: useId(), date: useId(), dateErr: useId(), term: useId(), termErr: useId(), notes: useId(), notesErr: useId(),
    notesHelp: useId(), purpose: useId(), file: useId(), consent: useId(), consentErr: useId(), docsErr: useId(),
  };
  const [clock, refreshClock] = useClock();
  const company = me.customer.type === "company";

  const [step, setStep] = useState<1 | 2 | 3>(initial.space ? 2 : 1);
  const [slug, setSlug] = useState(initial.space ?? "");
  const [startDate, setStartDate] = useState(initial.startDate ?? clock.date);
  const [term, setTerm] = useState<3 | 6 | 12>(initial.term ?? 3);
  const [notes, setNotes] = useState("");
  const [purpose, setPurpose] = useState<Purpose>(company ? "commercial-registration" : "identity");
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  const [rejects, setRejects] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [consent, setConsent] = useState(false);
  const [fe, setFe] = useState<Record<string, string>>({});
  const [focusKey, setFocusKey] = useState<{ id: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<string | null>(null);
  const [done, setDone] = useState<BookingDto | null>(null);
  const [over, setOver] = useState(false);
  const heading = useStepHeading(step);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const space = spaces.find((s) => s.slug === slug);
  const monthly = space ? unitPrice(space, "month") : 0;
  const docsApi = useApi<DocumentDto[]>("/api/v1/customer/documents");

  useEffect(() => {
    if (docsApi.data) setDocs(docsApi.data);
  }, [docsApi.data]);
  useEffect(() => {
    if (focusKey) document.getElementById(focusKey.id)?.focus();
  }, [focusKey]);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);
  useEffect(() => {
    if (top) topRef.current?.focus();
  }, [top]);

  const focus = (id: string) => setFocusKey((k) => ({ id, n: (k?.n ?? 0) + 1 }));

  function validateDetails(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!validDate(startDate, clock.date)) out.startDate = m.details.startDateInvalid;
    if (notes.length > 1000) out.notes = m.details.notesTooLong;
    return out;
  }

  function next() {
    setTop(null);
    if (step === 1) {
      if (!space) {
        setFe({ space: m.space.required });
        return focus(ids.first);
      }
      setFe({});
      return setStep(2);
    }
    if (step === 2) {
      const errs = validateDetails();
      setFe(errs);
      if (errs.startDate) return focus(ids.date);
      if (errs.notes) return focus(ids.notes);
      return setStep(3);
    }
  }
  function back() {
    setTop(null);
    setFe({});
    if (step === 2) refreshClock();
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2) : s));
  }

  /* ------------------------------------------------------------------ documents */

  function check(f: File): string | null {
    if (f.size === 0) return fmt(d.fileEmpty, { name: f.name });
    if (!EXT.test(f.name) || (f.type && !MIMES.has(f.type))) return fmt(d.fileType, { name: f.name });
    if (f.size > MAX_BYTES) return fmt(d.fileSize, { name: f.name });
    return null;
  }

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (files.length === 0) return;
    const problems: string[] = [];
    const ok: File[] = [];
    let room = MAX_DOCS - docs.length - uploads.filter((u) => u.state === "uploading").length;
    for (const f of files) {
      const p = check(f);
      if (p) problems.push(p);
      else if (room <= 0) {
        if (!problems.includes(d.limit)) problems.push(d.limit);
      } else {
        ok.push(f);
        room -= 1;
      }
    }
    setRejects(problems);
    for (const f of ok) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploads((u) => [...u, { key, name: f.name, state: "uploading" }]);
      setStatus(fmt(d.uploading, { name: f.name }));
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("purpose", purpose);
        const doc = await api<DocumentDto>("/api/v1/customer/documents", { method: "POST", body: fd });
        setDocs((x) => [...x, doc]);
        setSelected((x) => [...x, doc.id]);
        setUploads((u) => u.filter((i) => i.key !== key));
        setStatus(fmt(d.uploaded, { name: doc.name }));
      } catch (e) {
        if (guard(e)) return;
        setUploads((u) => u.map((i) => (i.key === key ? { ...i, state: "failed", message: errorMessage(t, e) } : i)));
        setStatus("");
      }
    }
  }

  async function removeDoc(doc: DocumentDto) {
    if (removing) return;
    setRemoving(doc.id);
    try {
      await api(`/api/v1/customer/documents/${encodeURIComponent(doc.id)}`, { method: "DELETE" });
      setDocs((x) => x.filter((i) => i.id !== doc.id));
      setSelected((x) => x.filter((i) => i !== doc.id));
      setStatus(fmt(d.removed, { name: doc.name }));
      listRef.current?.focus();
    } catch (e) {
      if (guard(e)) return;
      setRejects([`${doc.name}: ${errorMessage(t, e)}`]);
    } finally {
      setRemoving(null);
    }
  }

  /* ------------------------------------------------------------------ submit */

  async function submit() {
    if (busy || !space) return;
    setTop(null);
    const errs = validateDetails();
    if (errs.startDate || errs.notes) {
      setFe(errs);
      setStep(2);
      return focus(errs.startDate ? ids.date : ids.notes);
    }
    if (!consent) {
      setFe({ consent: d.consentRequired });
      return focus(ids.consent);
    }
    setFe({});
    setBusy(true);
    try {
      const b = await api<BookingDto>("/api/v1/customer/bookings", {
        json: { kind: "request", spaceSlug: space.slug, startDate, termMonths: term, ...(notes.trim() ? { notes: notes.trim() } : {}), documentIds: selected },
      });
      setDone(b);
      refreshMe().catch(() => undefined);
    } catch (e) {
      if (guard(e)) return;
      if (e instanceof ApiFailure && e.code === "validation" && e.fields) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(e.fields)) mapped[k] = fieldMessage(t, v) ?? t.common.fieldErrors.invalid;
        setFe(mapped);
        if (mapped.startDate || mapped.termMonths || mapped.notes) {
          setStep(2);
          focus(mapped.startDate ? ids.date : mapped.termMonths ? `${ids.term}-0` : ids.notes);
        } else if (mapped.documentIds) {
          focus(ids.file);
        }
        setTop(t.common.errors.validation);
      } else {
        setTop(e instanceof ApiFailure ? e.code : "generic");
      }
    } finally {
      setBusy(false);
    }
  }

  /* ------------------------------------------------------------------ render */

  if (done) {
    return (
      <section className="pcard" aria-labelledby={`${ids.h}-done`}>
        <div className="pcard__body bw-body">
          <h2 id={`${ids.h}-done`} className="bw-heading bw-done" tabIndex={-1} ref={doneRef}>{m.done.heading}</h2>
          <dl className="bw-sum" style={{ maxWidth: 420 }}>
            <dt>{m.done.reference}</dt><dd className="bw-done__ref ltr">{done.ref}</dd>
            <dt>{m.done.status}</dt><dd><StatusBadge kind="booking" status={done.status} /></dd>
          </dl>
          <div className="bw-stack" style={{ gap: "var(--space-3)" }}>
            <h3 className="bw-heading" style={{ fontSize: 17 }}>{m.done.nextHeading}</h3>
            <ol className="bw-next">
              <li>{m.done.next1}</li>
              <li>{m.done.next2}</li>
              <li>{m.done.next3}</li>
            </ol>
            <p className="bw-note">{m.done.pendingNote}</p>
          </div>
          <div className="bw-actions__end">
            <Link className="btn btn--primary" href={`/${lang}/portal/bookings/${encodeURIComponent(done.id)}`}>{m.done.viewRequest}</Link>
            <Link className="btn" href={`/${lang}/portal/bookings`}>{m.done.myBookings}</Link>
          </div>
        </div>
      </section>
    );
  }

  const topBanner = top && (
    <div className="banner banner--warning bw-banner" role="alert" tabIndex={-1} ref={topRef}>
      {top === "too_many_requests" ? (
        <><p>{m.errors.tooMany}</p><div className="bw-links"><Link className="btn" href={`/${lang}/portal/bookings`}>{m.errors.viewBookings}</Link></div></>
      ) : top === "booking_not_allowed" ? (
        <><p>{m.errors.notAllowed}</p><div className="bw-links"><Link className="btn" href={`/${lang}/contact`}>{m.errors.contact}</Link></div></>
      ) : (
        <p>{top === t.common.errors.validation ? top : errorMessage(t, new ApiFailure(top === "network" ? 0 : 400, top))}</p>
      )}
    </div>
  );

  const err = (k: string) => fe[k];

  return (
    <div className="pgrid">
      <div className="pcol">
        <section className="pcard" aria-labelledby={`${ids.h}-h`}>
          <div className="pcard__head"><Steps labels={[m.steps.space, m.steps.details, m.steps.documents]} current={step} /></div>
          <div className="pcard__body bw-body">
            {step === 1 && (
              <>
                <h2 id={`${ids.h}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{m.space.heading}</h2>
                <SpaceChoice spaces={spaces} value={slug} legend={m.space.legend} error={err("space")} errorId={ids.spaceErr} firstId={ids.first} showFrom
                  onChange={(s) => { setSlug(s); setFe({}); }} />
              </>
            )}

            {step === 2 && space && (
              <>
                <h2 id={`${ids.h}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{m.details.heading}</h2>
                <p><b>{space.name[lang]}</b></p>
                <div className="bw-fields">
                  <div className={`field${err("startDate") ? " field--error" : ""}`}>
                    <label className="label" htmlFor={ids.date}>{m.details.startDate}</label>
                    <input id={ids.date} type="date" className="input" dir="ltr" required min={clock.date} max={addDays(clock.date, 365)} value={startDate}
                      aria-invalid={err("startDate") ? true : undefined} aria-describedby={`${ids.date}-h ${ids.dateErr}`}
                      onChange={(e) => { setStartDate(e.target.value); setFe((f) => ({ ...f, startDate: "" })); }} />
                    <span className="help" id={`${ids.date}-h`}>{m.details.startDateHelp}</span>
                    <span className="error" id={ids.dateErr} role={err("startDate") ? "alert" : undefined}>{err("startDate")}</span>
                  </div>
                  <fieldset className="bw-fieldset" aria-describedby={`${ids.termErr}`}>
                    <legend className="label">{m.details.term}</legend>
                    <div className="bw-terms" role="radiogroup">
                      {TERMS.map((n, i) => (
                        <label key={n} className="bw-choice">
                          <input id={`${ids.term}-${i}`} type="radio" name={ids.term} checked={term === n} onChange={() => setTerm(n)} aria-invalid={err("termMonths") ? true : undefined} />
                          <span className="bw-choice__main"><b>{fmt(t.common.months, { n })}</b></span>
                        </label>
                      ))}
                    </div>
                    <span className="error" id={ids.termErr} role={err("termMonths") ? "alert" : undefined}>{err("termMonths")}</span>
                  </fieldset>
                </div>
                <div className="banner banner--info" role="note">
                  <div>
                    <b>{m.details.total}: <Money amount={monthly * term} /></b>
                    <br />{m.details.totalNote}
                  </div>
                </div>
                <div className={`field${err("notes") ? " field--error" : ""}`}>
                  <label className="label" htmlFor={ids.notes}>{m.details.notes} <span className="muted">({t.common.optional})</span></label>
                  <textarea id={ids.notes} className="textarea" value={notes} maxLength={1200} onChange={(e) => { setNotes(e.target.value); setFe((f) => ({ ...f, notes: "" })); }}
                    aria-invalid={err("notes") || notes.length > 1000 ? true : undefined} aria-describedby={`${ids.notesHelp} ${ids.notesErr}`} />
                  <span className="help" id={ids.notesHelp}>{m.details.notesHelp} <span className="ltr">{fmt(m.details.notesCount, { n: notes.length })}</span></span>
                  <span className="error" id={ids.notesErr} role={err("notes") ? "alert" : undefined}>{err("notes") || (notes.length > 1000 ? m.details.notesTooLong : "")}</span>
                </div>
              </>
            )}

            {step === 3 && space && (
              <>
                <h2 id={`${ids.h}-h`} className="bw-heading" tabIndex={-1} ref={heading}>{d.heading}</h2>
                <p>{company ? d.introCompany : d.introIndividual}</p>
                <p className="bw-note">{d.optional}</p>

                <div className="field" style={{ maxWidth: 360 }}>
                  <label className="label" htmlFor={ids.purpose}>{d.purpose}</label>
                  <select id={ids.purpose} className="select" value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
                    <option value="identity">{d.purposes.identity}</option>
                    <option value="commercial-registration">{d.purposes["commercial-registration"]}</option>
                  </select>
                </div>

                <label
                  className={`bw-drop${over ? " is-over" : ""}`} htmlFor={ids.file}
                  onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e) => { e.preventDefault(); setOver(false); void addFiles(e.dataTransfer.files); }}
                >
                  <span className="bw-drop__row">
                    <span>{d.dropTitle}</span>
                    <span className="btn bw-drop__btn">{d.choose}</span>
                  </span>
                  <span className="help">{d.hint}</span>
                  <input
                    id={ids.file} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-describedby={`${ids.docsErr}`}
                    onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ""; }}
                  />
                </label>
                <p className="help">{d.private}</p>

                <div id={ids.docsErr} aria-live="polite">
                  {rejects.map((r) => <p key={r} className="error" role="alert">{r}</p>)}
                  {err("documentIds") && <p className="error" role="alert">{err("documentIds")}</p>}
                </div>

                <h3 className="bw-heading" style={{ fontSize: 16 }} tabIndex={-1} ref={listRef}>{d.listHeading}</h3>
                {docsApi.loading && <Loading />}
                {!docsApi.loading && docsApi.error != null && <ErrorState error={docsApi.error} onRetry={docsApi.reload} />}
                {!docsApi.loading && docs.length === 0 && uploads.length === 0 && docsApi.error == null && <p className="bw-note">{d.none}</p>}
                {(docs.length > 0 || uploads.length > 0) && (
                  <ul className="bw-docs">
                    {docs.map((doc) => (
                      <li key={doc.id}>
                        <label className="check">
                          <input type="checkbox" checked={selected.includes(doc.id)} aria-label={fmt(d.attach, { name: doc.name })}
                            onChange={(e) => setSelected((x) => (e.target.checked ? [...x, doc.id] : x.filter((i) => i !== doc.id)))} />
                          <span>
                            <b>{doc.name}</b>
                            <small>{d.purposes[doc.purpose]}, <span className="ltr">{sizeText(doc.sizeBytes)}</span></small>
                          </span>
                        </label>
                        <button type="button" className="btn btn--sm" onClick={() => void removeDoc(doc)} disabled={removing !== null} aria-label={fmt(d.removeLabel, { name: doc.name })}>
                          {removing === doc.id ? d.removing : d.remove}
                        </button>
                      </li>
                    ))}
                    {uploads.map((u) => (
                      <li key={u.key}>
                        {u.state === "uploading" ? (
                          <div className="grow bw-uploading"><span className="spinner" aria-hidden="true" /><span>{fmt(d.uploading, { name: u.name })}</span></div>
                        ) : (
                          <>
                            <div className="grow"><b>{u.name}</b><span className="bw-fail" role="alert">{u.message}</span></div>
                            <button type="button" className="btn btn--sm" onClick={() => setUploads((x) => x.filter((i) => i.key !== u.key))}>{d.dismiss}</button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className={`field${err("consent") ? " field--error" : ""}`}>
                  <label className="check">
                    <input id={ids.consent} type="checkbox" checked={consent} aria-invalid={err("consent") ? true : undefined} aria-describedby={ids.consentErr}
                      onChange={(e) => { setConsent(e.target.checked); setFe((f) => ({ ...f, consent: "" })); }} />
                    <span>
                      {d.consentBefore}
                      <Link href={`/${lang}/legal/privacy`} target="_blank" rel="noopener">{d.consentLink}<span className="sr-only"> ({d.newTab})</span></Link>
                      {d.consentAfter}
                    </span>
                  </label>
                  <span className="error" id={ids.consentErr} role={err("consent") ? "alert" : undefined}>{err("consent")}</span>
                </div>
                {topBanner}
              </>
            )}

            <div className="bw-actions">
              {step > 1 ? <button type="button" className="btn btn--ghost" onClick={back} disabled={busy}>{t.book.back}</button> : <span />}
              <div className="bw-actions__end">
                {step === 3 ? (
                  <button type="button" className="btn btn--primary btn--lg" onClick={submit} disabled={busy}>{m.submit}</button>
                ) : (
                  <button type="button" className="btn btn--dark" onClick={next}>{t.book.continue}</button>
                )}
              </div>
            </div>
            <div className="sr-only" role="status" aria-live="polite">{busy ? m.busy : status}</div>
          </div>
        </section>
      </div>
      <div className="pcol pcol--side">
        <aside className="pcard bw-aside" aria-labelledby={`${ids.h}-sum`}>
          <div className="pcard__head"><h2 id={`${ids.h}-sum`}>{m.summary.heading}</h2></div>
          <div className="pcard__body">
            <dl className="bw-sum">
              <dt>{m.summary.space}</dt><dd>{space ? space.name[lang] : t.book.notChosen}</dd>
              {space && <><dt>{m.summary.term}</dt><dd>{fmt(t.common.months, { n: term })}</dd></>}
              {space && <><dt>{m.summary.start}</dt><dd>{validDate(startDate, clock.date) ? formatDay(lang, startDate, "short") : t.book.notChosen}</dd></>}
              {space && (
                <div className="bw-sum__total">
                  <span>{m.details.total}</span>
                  <Money amount={monthly * term} />
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
