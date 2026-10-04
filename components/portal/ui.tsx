"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ApiFailure, api } from "@/lib/portal/client";
import { formatEgp } from "@/lib/format";
import type { BookingStatus, InvoiceStatus } from "@/lib/portal/types";
import { usePortal } from "./PortalProvider";
import type { PortalMessages } from "@/lib/portal/messages";

/* ------------------------------------------------------------------ errors */

/** Turns any thrown value into a message the customer can act on, in the current language. */
export function errorMessage(t: PortalMessages, e: unknown): string {
  const errors = t.common.errors as Record<string, string>;
  if (e instanceof ApiFailure) return errors[e.code] ?? (e.status === 0 ? errors.network : errors.generic);
  return errors.generic;
}

export function fieldMessage(t: PortalMessages, code: string | undefined): string | undefined {
  if (!code) return undefined;
  return (t.common.fieldErrors as Record<string, string>)[code] ?? t.common.fieldErrors.invalid;
}

/* ------------------------------------------------------------------ data loading */

export interface ApiState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/** GET a portal API path with loading and error state. Pass null to skip. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

/* ------------------------------------------------------------------ small pieces */

export function Loading({ label }: { label?: string }) {
  const { t } = usePortal();
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label ?? t.common.loading}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = usePortal();
  return (
    <div className="banner banner--warning" role="alert" style={{ margin: "var(--space-4)" }}>
      <div>
        {errorMessage(t, error)}{" "}
        {onRetry && <button type="button" className="btn btn--sm" onClick={onRetry}>{t.common.retry}</button>}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="phead">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Money({ amount }: { amount: number }) {
  const { lang } = usePortal();
  return <span className="num">{formatEgp(lang, amount)}</span>;
}

const BOOKING_TONE: Record<BookingStatus, string> = {
  Draft: "", Pending: "badge--warning", Confirmed: "badge--success", "Checked-in": "badge--info", Completed: "badge--success", Cancelled: "badge--danger", "No-show": "badge--danger",
};
const INVOICE_TONE: Record<InvoiceStatus, string> = {
  Draft: "", Issued: "badge--info", "Partially Paid": "badge--warning", Paid: "badge--success", Overdue: "badge--danger", Cancelled: "badge--danger",
};

/** Status is always a word, never colour alone. */
export function StatusBadge({ kind, status }: { kind: "booking"; status: BookingStatus } | { kind: "invoice"; status: InvoiceStatus }) {
  const { t } = usePortal();
  const label = kind === "booking" ? t.common.bookingStatus[status as BookingStatus] : t.common.invoiceStatus[status as InvoiceStatus];
  const tone = kind === "booking" ? BOOKING_TONE[status as BookingStatus] : INVOICE_TONE[status as InvoiceStatus];
  return <span className={`badge ${tone}`}>{label}</span>;
}

/* ------------------------------------------------------------------ confirmation dialog */

/** Native <dialog>: focus is trapped, Escape closes it, and it is announced by screen readers. */
export function ConfirmDialog({
  open, title, text, confirmLabel, cancelLabel, busy, danger, error, onConfirm, onClose,
}: {
  open: boolean; title: string; text: string; confirmLabel: string; cancelLabel: string; busy?: boolean; danger?: boolean; error?: string | null;
  onConfirm: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dlg" aria-labelledby={`${id}-t`} onClose={onClose} onCancel={onClose}>
      <div className="dlg__body">
        <h2 id={`${id}-t`}>{title}</h2>
        <p className="muted">{text}</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      <div className="dlg__foot">
        <button type="button" className="btn" onClick={onClose} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={`btn ${danger ? "btn--danger" : "btn--dark"}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
