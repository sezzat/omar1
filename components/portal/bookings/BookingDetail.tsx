"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import { formatDay, formatInstant, timeRange } from "@/lib/portal/format";
import type { BookingDto, InvoiceDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { ErrorState, Loading, Money, PageHeader, StatusBadge } from "../ui";
import { Countdown, PdfButton, useCancelFlow, useCheckout } from "./shared";
import "./bookings.css";

const POLL_MS = 2000;
const POLL_LIMIT_MS = 30_000;

export function BookingDetail({ id }: { id: string }) {
  const { t, lang } = usePortal();
  const d = t.bookings.detail;
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [returned, setReturned] = useState(false);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [invoiceError, setInvoiceError] = useState<unknown>(null);

  const path = `/api/v1/customer/bookings/${encodeURIComponent(id)}`;

  const load = useCallback(async () => {
    setError(null);
    try {
      setBooking(await api<BookingDto>(path));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setReturned(new URLSearchParams(window.location.search).get("returned") === "1");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // After the payment page: only DISPLAY status, polling until the webhook has confirmed it.
  const isDraft = booking?.status === "Draft";
  useEffect(() => {
    if (!returned || !isDraft || slow) return;
    const started = Date.now();
    const timer = setInterval(async () => {
      try {
        setBooking(await api<BookingDto>(path));
      } catch {
        /* keep polling until the time limit */
      }
      if (Date.now() - started >= POLL_LIMIT_MS) {
        clearInterval(timer);
        setSlow(true);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [returned, isDraft, slow, path]);

  const invoiceId = booking?.invoiceId;
  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    setInvoiceError(null);
    try {
      const list = await api<InvoiceDto[]>("/api/v1/customer/invoices");
      setInvoice(list.find((i) => i.id === invoiceId) ?? null);
    } catch (e) {
      setInvoiceError(e);
    }
  }, [invoiceId]);
  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const cancel = useCancelFlow(
    useCallback(({ booking: updated, released }) => {
      setBooking(updated);
      setNotice(fmt(released ? t.bookings.released : t.bookings.cancelled, { ref: updated.ref }));
    }, [t]),
    load,
  );
  const checkout = useCheckout(useCallback((e: unknown) => {
    const code = (e as { code?: string })?.code;
    if (code === "hold_expired" || code === "not_payable") load();
  }, [load]));

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const back = <Link className="btn btn--ghost btn--sm" href={`/${lang}/portal/bookings`} style={{ alignSelf: "flex-start" }}>{t.bookings.actions.back}</Link>;

  if (loading && !booking) return <Loading />;
  if (error != null && !booking) {
    return (
      <div className="stack">
        {back}
        <ErrorState error={error} onRetry={load} />
      </div>
    );
  }
  if (!booking) return null;
  const b = booking;

  const holdAlive = b.status === "Draft" && !!b.holdExpiresAt && Date.parse(b.holdExpiresAt) > Date.now();
  const isRequest = b.mode === "request";

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      {back}
      <PageHeader title={b.spaceName[lang]} subtitle={fmt(t.bookings.reference, { ref: `⁦${b.ref}⁩` })} />

      {notice && <div ref={noticeRef} className="bk-status" role="status" tabIndex={-1}>{notice}</div>}

      {returned && b.status === "Draft" && (
        <div className="banner banner--info" role="status">
          <div>
            <b>{slow ? d.returned.slow : d.returned.confirming}</b>
            <p>{slow ? d.returned.slowText : d.returned.confirmingText}</p>
          </div>
        </div>
      )}
      {returned && b.status === "Confirmed" && !notice && (
        <div className="banner banner--success" role="status"><div><b>{d.returned.done}</b></div></div>
      )}
      {b.review === "payment_review" && (
        <div className="banner banner--warning" role="status">
          <div>
            <b>{d.review.title}</b>
            <p>{d.review.text}</p>
          </div>
        </div>
      )}

      {b.status === "Draft" && (
        <section className="pcard" aria-labelledby="bk-hold">
          <div className="pcard__body bk-section">
            <h2 id="bk-hold">{d.hold.title}</h2>
            {holdAlive && b.holdExpiresAt ? (
              <p>{d.hold.left}: <Countdown iso={b.holdExpiresAt} onEnd={load} big /></p>
            ) : (
              <p className="muted">{t.bookings.holdGone}</p>
            )}
            <p className="muted">{d.next.draft}</p>
            {checkout.error && <p className="error" role="alert">{checkout.error}</p>}
            {holdAlive && (
              <div className="bk-actions">
                <button type="button" className="btn btn--primary" onClick={() => checkout.start(b.id)} disabled={checkout.busyId !== null}>
                  {checkout.busyId ? t.bookings.actions.paying : t.bookings.actions.pay}
                </button>
                {b.canCancel && <button type="button" className="btn" onClick={() => cancel.ask(b)} disabled={checkout.busyId !== null}>{t.bookings.actions.release}</button>}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="pcard" aria-labelledby="bk-sum">
        <div className="pcard__head">
          <h2 id="bk-sum">{d.summary}</h2>
          <StatusBadge kind="booking" status={b.status} />
        </div>
        <div className="pcard__body">
          <dl className="bk-dl">
            <dt>{d.fields.reference}</dt><dd className="ltr">{b.ref}</dd>
            <dt>{d.fields.space}</dt><dd>{b.spaceName[lang]}</dd>
            <dt>{d.fields.kind}</dt><dd>{t.common.kinds[b.kind]}</dd>
            {isRequest || b.startDate ? (
              <>
                {b.startDate && <><dt>{d.fields.startDate}</dt><dd>{formatDay(lang, b.startDate)}</dd></>}
                {b.termMonths && <><dt>{d.fields.term}</dt><dd>{fmt(t.common.months, { n: b.termMonths })}</dd></>}
              </>
            ) : (
              <>
                <dt>{d.fields.date}</dt><dd>{formatDay(lang, b.date ?? b.startsAt.slice(0, 10))}</dd>
                {b.startTime && b.hours ? <><dt>{d.fields.time}</dt><dd className="ltr">{timeRange(b.startTime, b.hours)}</dd></> : null}
              </>
            )}
            <dt>{d.fields.price}</dt><dd>{b.paidByPackage ? d.free : <Money amount={b.priceEgp} />}</dd>
            <dt>{d.fields.status}</dt><dd><StatusBadge kind="booking" status={b.status} /></dd>
            {isRequest && b.notes && <><dt>{d.fields.notes}</dt><dd style={{ whiteSpace: "pre-wrap" }}>{b.notes}</dd></>}
          </dl>
        </div>
      </section>

      <NextSteps b={b} />

      <CancelSection b={b} onCancel={() => cancel.ask(b)} />

      {b.invoiceId && (
        <section className="pcard" aria-labelledby="bk-inv">
          <div className="pcard__body bk-section">
            <h2 id="bk-inv">{d.invoice.title}</h2>
            {b.paidByPackage && <p className="muted">{d.invoice.package}</p>}
            {invoiceError != null ? (
              <ErrorState error={invoiceError} onRetry={loadInvoice} />
            ) : invoice ? (
              <div className="bk-actions" style={{ justifyContent: "space-between" }}>
                <div className="bk-meta">
                  <span>{fmt(d.invoice.number, { number: `⁦${invoice.number}⁩` })}</span>
                  <StatusBadge kind="invoice" status={invoice.status} />
                  <Money amount={invoice.amountEgp} />
                </div>
                <PdfButton invoice={invoice} label={t.bookings.actions.downloadInvoice} className="btn" />
              </div>
            ) : null}
          </div>
        </section>
      )}
      {cancel.dialog}
    </div>
  );
}

function NextSteps({ b }: { b: BookingDto }) {
  const { t } = usePortal();
  const n = t.bookings.detail.next;
  let text: string | null = null;
  switch (b.status) {
    case "Draft": return null; // shown inside the payment section
    case "Pending": text = n.pending; break;
    case "Confirmed": text = b.mode === "request" ? n.confirmedRequest : n.confirmedInstant; break;
    case "Checked-in": text = n.checkedIn; break;
    case "Completed": text = n.completed; break;
    case "Cancelled": text = b.cancelReason === "hold_expired" ? n.cancelledHold : b.cancelReason === "staff" ? n.cancelledStaff : n.cancelledCustomer; break;
    case "No-show": text = n.noShow; break;
  }
  if (b.review === "payment_review") return null;
  return (
    <section className="pcard" aria-labelledby="bk-next">
      <div className="pcard__body bk-section">
        <h2 id="bk-next">{n.title}</h2>
        <p>{text}</p>
      </div>
    </section>
  );
}

function CancelSection({ b, onCancel }: { b: BookingDto; onCancel: () => void }) {
  const { t, lang } = usePortal();
  const c = t.bookings.detail.cancel;
  const contact = <Link className="btn btn--sm" href={`/${lang}/contact`} style={{ alignSelf: "flex-start" }}>{t.bookings.actions.contact}</Link>;

  if (b.status === "Cancelled") {
    const returned = b.paidByPackage && b.cancelReason === "customer";
    if (!b.refundRequested && !returned) return null;
    return (
      <section className="pcard" aria-labelledby="bk-can">
        <div className="pcard__body bk-section">
          <h2 id="bk-can">{c.title}</h2>
          {b.refundRequested && <p>{c.refundRecorded}</p>}
          {returned && <p>{c.packageReturned}</p>}
        </div>
      </section>
    );
  }
  if (b.status === "Draft" || b.status === "Checked-in" || b.status === "Completed" || b.status === "No-show") return null;

  return (
    <section className="pcard" aria-labelledby="bk-can">
      <div className="pcard__body bk-section">
        <h2 id="bk-can">{c.title}</h2>
        {b.canCancel ? (
          <>
            {b.status === "Pending" && <p>{c.pending}</p>}
            {b.cancelDeadline && <p>{fmt(c.until, { when: formatInstant(lang, b.cancelDeadline) })}</p>}
            {b.paid && <p className="muted">{c.refund}</p>}
            {b.paidByPackage && <p className="muted">{c.package}</p>}
            <button type="button" className="btn btn--danger" onClick={onCancel} style={{ alignSelf: "flex-start" }}>{t.bookings.actions.cancel}</button>
          </>
        ) : (
          <>
            <p>{b.cancelDeadline ? fmt(c.closed, { when: formatInstant(lang, b.cancelDeadline) }) : t.common.errors.outside_cancel_window}</p>
            <p className="muted">{c.closedHelp}</p>
            {contact}
          </>
        )}
      </div>
    </section>
  );
}
