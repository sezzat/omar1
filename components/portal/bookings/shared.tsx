"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, api, apiBlob, saveBlob } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import { formatDay, remaining, tileParts, timeRange } from "@/lib/portal/format";
import type { BookingDto, CheckoutDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { ConfirmDialog, StatusBadge, errorMessage } from "../ui";
import "./bookings.css";

/** Left-to-right isolate so times keep their order inside Arabic sentences. */
const isolate = (s: string) => `⁦${s}⁩`;

/** One line describing when a booking happens: a day and time, or a start date and term. */
export function useWhen() {
  const { lang, t } = usePortal();
  return (b: BookingDto): string => {
    if (b.startDate) {
      return fmt(t.bookings.when.monthly, { date: formatDay(lang, b.startDate, "short"), term: fmt(t.common.months, { n: b.termMonths ?? 0 }) });
    }
    const date = formatDay(lang, b.date ?? b.startsAt.slice(0, 10), "short");
    if (b.startTime && b.hours) return fmt(t.bookings.when.time, { date, range: isolate(timeRange(b.startTime, b.hours)) });
    return fmt(t.bookings.when.day, { date });
  };
}

export function DateTile({ iso }: { iso: string }) {
  const { lang } = usePortal();
  const p = tileParts(lang, iso);
  return (
    <div className="pdate" aria-hidden="true">
      <b>{p.day}</b>
      <span>{p.month}</span>
    </div>
  );
}

/** Ticks once a second while enabled. */
export function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * Hold countdown. The visible clock updates every second but is hidden from screen readers;
 * a polite live region changes only when the whole minute changes.
 */
export function Countdown({ iso, onEnd, big }: { iso: string; onEnd?: () => void; big?: boolean }) {
  const { t } = usePortal();
  const now = useNow(true);
  const r = remaining(iso, now);
  const ended = useRef(false);
  useEffect(() => {
    if (r.total === 0 && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
    if (r.total > 0) ended.current = false;
  }, [r.total, onEnd]);

  if (r.total === 0) return <span className="muted">{t.bookings.holdEnded}</span>;
  const minutes = Math.ceil(r.total / 60);
  return (
    <span>
      <span className={`bk-clock ltr${big ? " bk-clock--big" : ""}`} aria-hidden="true">{r.mm}:{r.ss}</span>
      <span className="sr-only" role="status">{r.total < 60 ? t.bookings.holdSeconds : fmt(t.bookings.holdMinutes, { n: minutes })}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ cancel and release */

export type CancelOutcome = { booking: BookingDto; released: boolean };

function dialogText(t: ReturnType<typeof usePortal>["t"], b: BookingDto): string {
  const d = t.bookings.cancelDialog;
  if (b.status === "Draft") return t.bookings.releaseDialog.text;
  if (b.status === "Pending") return d.textPending;
  if (b.paid) return d.textPaid;
  if (b.paidByPackage) return d.textPackage;
  return d.textPlain;
}

/** Cancel or release a booking through the shared confirm dialog. Render `dialog` once in the screen. */
export function useCancelFlow(onDone: (o: CancelOutcome) => void, onStale?: () => void) {
  const { t } = usePortal();
  const [target, setTarget] = useState<BookingDto | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback((b: BookingDto) => {
    setTarget(b);
    setError(null);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    if (!busy) setOpen(false);
  }, [busy]);

  const confirm = useCallback(async () => {
    if (!target || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<BookingDto>(`/api/v1/customer/bookings/${encodeURIComponent(target.id)}/cancel`, { method: "POST" });
      setOpen(false);
      onDone({ booking: updated, released: target.status === "Draft" });
    } catch (e) {
      setError(errorMessage(t, e));
      if (e instanceof ApiFailure && ["outside_cancel_window", "cannot_cancel", "booking_not_found"].includes(e.code)) onStale?.();
    } finally {
      setBusy(false);
    }
  }, [target, busy, onDone, onStale, t]);

  const draft = target?.status === "Draft";
  const dialog = (
    <ConfirmDialog
      open={open}
      title={draft ? t.bookings.releaseDialog.title : t.bookings.cancelDialog.title}
      text={target ? dialogText(t, target) : ""}
      confirmLabel={draft ? t.bookings.releaseDialog.confirm : t.bookings.actions.cancel}
      cancelLabel={draft ? t.bookings.releaseDialog.keep : t.bookings.cancelDialog.keep}
      busy={busy}
      danger
      error={error}
      onConfirm={confirm}
      onClose={() => { if (!busy) setOpen(false); }}
    />
  );
  return { ask, close, dialog, busy };
}

/** The label of the cancel action depends on what is being cancelled. */
export const cancelLabel = (t: ReturnType<typeof usePortal>["t"], b: BookingDto) => (b.status === "Draft" ? t.bookings.actions.release : t.bookings.actions.cancel);

/* ------------------------------------------------------------------ checkout */

/** POST checkout and send the browser to the hosted payment page. */
export function useCheckout(onFailed?: (e: unknown) => void) {
  const { t, lang } = usePortal();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const dto = await api<CheckoutDto>(`/api/v1/customer/bookings/${encodeURIComponent(id)}/checkout`, { method: "POST" });
      if (!/^\/checkout\/[A-Za-z0-9_-]+$/.test(dto.checkoutPath)) throw new ApiFailure(500, "generic");
      window.location.assign(`/${lang}${dto.checkoutPath}`);
      // Stay busy: the browser is leaving this page.
    } catch (e) {
      setError(errorMessage(t, e));
      setBusyId(null);
      onFailed?.(e);
    }
  }, [busyId, lang, t, onFailed]);

  return { start, busyId, error };
}

/* ------------------------------------------------------------------ invoice pdf */

export function PdfButton({ invoice, label, ariaLabel, className = "btn btn--sm" }: { invoice: { id: string; number: string }; label: string; ariaLabel?: string; className?: string }) {
  const { t } = usePortal();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setFailed(null);
    try {
      const blob = await apiBlob(`/api/v1/customer/invoices/${encodeURIComponent(invoice.id)}/pdf`);
      saveBlob(blob, `${invoice.number}.pdf`);
    } catch (e) {
      setFailed(e instanceof ApiFailure && e.status === 0 ? errorMessage(t, e) : t.bookings.invoiceFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className={className} onClick={download} disabled={busy} aria-label={ariaLabel}>
        {busy ? t.bookings.actions.downloading : label}
      </button>
      {failed && <span className="bk-fail" role="alert" style={{ display: "block" }}>{failed}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ booking row */

export function BookingRow({ b, onHoldEnd, children, extra }: { b: BookingDto; onHoldEnd?: () => void; children?: React.ReactNode; extra?: React.ReactNode }) {
  const { lang, t } = usePortal();
  const when = useWhen();
  const name = b.spaceName[lang];
  return (
    <li className="bk-row">
      <DateTile iso={b.startsAt} />
      <div className="grow">
        <Link className="bk-name" href={`/${lang}/portal/bookings/${encodeURIComponent(b.id)}`}>{name}</Link>
        <small>{when(b)}</small>
        <small>{t.common.kinds[b.kind]}, {fmt(t.bookings.reference, { ref: isolate(b.ref) })}</small>
        {b.review === "payment_review" && <small className="bk-note">{t.bookings.paymentCheck}</small>}
        {extra}
      </div>
      <div className="bk-meta">
        <StatusBadge kind="booking" status={b.status} />
        {b.status === "Draft" && b.holdExpiresAt && (
          <span className="muted" style={{ fontSize: 13 }}>
            {t.bookings.detail.hold.left}: <Countdown iso={b.holdExpiresAt} onEnd={onHoldEnd} />
          </span>
        )}
      </div>
      {children && <div className="bk-actions">{children}</div>}
    </li>
  );
}
