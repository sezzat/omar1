"use client";

import { useId, useMemo, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { localize } from "@/lib/i18n";
import { ApiFailure, apiBlob, saveBlob } from "@/lib/portal/client";
import { formatDay } from "@/lib/portal/format";
import type { InvoiceDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { EmptyState, ErrorState, Loading, Money, PageHeader, StatusBadge, errorMessage, useApi } from "../ui";
import "./invoices.css";

type Filter = "all" | "outstanding" | "paid";
const FILTERS: Filter[] = ["all", "outstanding", "paid"];
const isOutstanding = (i: InvoiceDto) => i.status === "Issued" || i.status === "Partially Paid" || i.status === "Overdue";

function PdfButton({ invoice }: { invoice: InvoiceDto }) {
  const { t } = usePortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      saveBlob(await apiBlob(`/api/v1/customer/invoices/${encodeURIComponent(invoice.id)}/pdf`), `${invoice.number}.pdf`);
    } catch (e) {
      setError(e instanceof ApiFailure && e.status === 0 ? errorMessage(t, e) : t.invoices.pdfFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className="btn btn--sm" onClick={download} disabled={busy} aria-label={fmt(t.invoices.pdfAria, { number: invoice.number })}>
        {busy ? t.invoices.pdfBusy : t.invoices.pdfButton}
      </button>
      <span className="iv-fail" role="alert">{error}</span>
    </div>
  );
}

export function Invoices() {
  const { t, lang } = usePortal();
  const { data, error, loading, reload } = useApi<InvoiceDto[]>("/api/v1/customer/invoices");
  const [filter, setFilter] = useState<Filter>("all");
  const uid = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const outstanding = useMemo(() => (data ?? []).filter(isOutstanding), [data]);
  const owed = outstanding.reduce((sum, i) => sum + Math.max(0, i.amountEgp - i.paidEgp), 0);
  const shown = useMemo(() => {
    const all = data ?? [];
    return filter === "outstanding" ? all.filter(isOutstanding) : filter === "paid" ? all.filter((i) => i.status === "Paid") : all;
  }, [data, filter]);
  const counts: Record<Filter, number> = {
    all: data?.length ?? 0, outstanding: outstanding.length, paid: (data ?? []).filter((i) => i.status === "Paid").length,
  };

  function onTabKey(e: React.KeyboardEvent, idx: number) {
    const dir = (document.documentElement.dir === "rtl" ? -1 : 1) * (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0);
    let next = idx + dir;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = FILTERS.length - 1;
    else if (dir === 0) return;
    next = (next + FILTERS.length) % FILTERS.length;
    e.preventDefault();
    setFilter(FILTERS[next]);
    tabRefs.current[next]?.focus();
  }

  const desc = (i: InvoiceDto) => localize(lang, i.description);

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <PageHeader title={t.invoices.title} subtitle={t.invoices.subtitle} />

      {loading && !data && <Loading />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.length === 0 && (
        <div className="pcard"><EmptyState title={t.invoices.emptyTitle} text={t.invoices.emptyText} /></div>
      )}

      {data && data.length > 0 && (
        <>
          <section className="pcard" aria-labelledby={`${uid}-total`}>
            <div className="pcard__body iv-total">
              <div className="kpi">
                <span className="kpi__label" id={`${uid}-total`}>{t.invoices.outstanding}</span>
                {owed > 0 ? <span className="kpi__value"><Money amount={owed} /></span> : <span className="kpi__value is-clear">{t.invoices.outstandingNone}</span>}
                {outstanding.length > 0 && (
                  <span className="kpi__meta">{outstanding.length === 1 ? t.invoices.outstandingOne : fmt(t.invoices.outstandingCount, { n: outstanding.length })}</span>
                )}
              </div>
            </div>
          </section>

          <section className="pcard">
            <div className="tabs iv-tabs" role="tablist" aria-label={t.invoices.tabsLabel}>
              {FILTERS.map((f, idx) => (
                <button
                  key={f}
                  ref={(el) => { tabRefs.current[idx] = el; }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${f}`}
                  className="tab"
                  aria-selected={filter === f}
                  aria-controls={`${uid}-panel`}
                  tabIndex={filter === f ? 0 : -1}
                  onClick={() => setFilter(f)}
                  onKeyDown={(e) => onTabKey(e, idx)}
                >
                  {t.invoices.tabs[f]} <span className="count num">{counts[f]}</span>
                </button>
              ))}
            </div>

            <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${filter}`}>
              {shown.length === 0 ? (
                <EmptyState title={t.invoices.emptyFilter} text={t.invoices.emptyFilterText} />
              ) : (
                <>
                  <div className="iv-wrap" tabIndex={0} role="region" aria-label={t.invoices.table.caption}>
                    <table className="ptable iv-table">
                      <caption className="sr-only">{t.invoices.table.caption}</caption>
                      <thead>
                        <tr>
                          <th scope="col">{t.invoices.table.number}</th>
                          <th scope="col">{t.invoices.table.description}</th>
                          <th scope="col">{t.invoices.table.booking}</th>
                          <th scope="col">{t.invoices.table.issued}</th>
                          <th scope="col">{t.invoices.table.due}</th>
                          <th scope="col" className="num">{t.invoices.table.amount}</th>
                          <th scope="col" className="num">{t.invoices.table.paid}</th>
                          <th scope="col">{t.invoices.table.status}</th>
                          <th scope="col"><span className="sr-only">{t.invoices.table.pdf}</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((i) => (
                          <tr key={i.id}>
                            <th scope="row" style={{ textAlign: "start", fontWeight: 500, padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--border)" }}><span className="ltr">{i.number}</span></th>
                            <td>{desc(i)}</td>
                            <td>{i.bookingRef ? <span className="ltr">{i.bookingRef}</span> : t.invoices.none}</td>
                            <td>{formatDay(lang, i.issueDate, "short")}</td>
                            <td>{formatDay(lang, i.dueDate, "short")}</td>
                            <td className="num"><Money amount={i.amountEgp} /></td>
                            <td className="num"><Money amount={i.paidEgp} /></td>
                            <td><StatusBadge kind="invoice" status={i.status} /></td>
                            <td><PdfButton invoice={i} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="iv-cards">
                    {shown.map((i) => (
                      <li key={i.id} className="iv-card">
                        <div className="iv-card__top">
                          <div>
                            <b className="ltr">{i.number}</b>
                            <div className="muted" style={{ fontSize: 14 }}>{desc(i)}</div>
                          </div>
                          <StatusBadge kind="invoice" status={i.status} />
                        </div>
                        <dl>
                          <dt>{t.invoices.table.booking}</dt>
                          <dd>{i.bookingRef ? <span className="ltr">{i.bookingRef}</span> : t.invoices.none}</dd>
                          <dt>{t.invoices.table.issued}</dt>
                          <dd>{formatDay(lang, i.issueDate, "short")}</dd>
                          <dt>{t.invoices.table.due}</dt>
                          <dd>{formatDay(lang, i.dueDate, "short")}</dd>
                          <dt>{t.invoices.table.amount}</dt>
                          <dd><Money amount={i.amountEgp} /></dd>
                          <dt>{t.invoices.table.paid}</dt>
                          <dd><Money amount={i.paidEgp} /></dd>
                        </dl>
                        <PdfButton invoice={i} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>

          <div className="iv-note">
            <p className="banner banner--info" style={{ margin: 0 }}>{t.invoices.payNote}</p>
            <p className="iv-foot">{t.invoices.vatNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
