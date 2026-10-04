"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { formatDay } from "@/lib/portal/format";
import type { BookingDto, DashboardDto, InvoiceDto, PackageBalanceDto } from "@/lib/portal/types";
import { localize } from "@/lib/i18n";
import { usePortal } from "../PortalProvider";
import { EmptyState, ErrorState, Loading, Money, PageHeader, StatusBadge, useApi } from "../ui";
import { BookingRow, PdfButton, cancelLabel, useCancelFlow, useCheckout } from "../bookings/shared";
import { QrCode } from "./QrCode";
import "../bookings/bookings.css";

export function Home() {
  const { me, t, lang } = usePortal();
  const dash = useApi<DashboardDto>("/api/v1/customer/dashboard");
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const firstName = me.customer.name.trim().split(/\s+/)[0] || me.customer.name;
  const company = me.customer.type === "company" ? me.customer.companyName : undefined;

  const { reload } = dash;
  const cancel = useCancelFlow(
    useCallback(({ booking, released }) => {
      setNotice(fmt(released ? t.bookings.released : t.bookings.cancelled, { ref: booking.ref }));
      reload();
    }, [reload, t]),
    reload,
  );
  const checkout = useCheckout(useCallback((e: unknown) => {
    const code = (e as { code?: string })?.code;
    if (code === "hold_expired" || code === "not_payable") reload();
  }, [reload]));

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  const pending = me.customer.status === "Pending Approval" && me.customer.hasPendingRequest;

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <PageHeader
        title={fmt(t.home.greeting, { name: firstName })}
        subtitle={company}
        action={!me.permissions.contactUs ? <Link className="btn btn--primary btn--lg" href={`/${lang}/portal/book`}>{t.home.book}</Link> : undefined}
      />

      {pending && (
        <div className="banner banner--warning" role="status"><div>{t.home.pendingBanner}</div></div>
      )}
      {notice && <div ref={noticeRef} className="bk-status" role="status" tabIndex={-1}>{notice}</div>}
      {checkout.error && <div className="banner banner--warning" role="alert"><div>{checkout.error}</div></div>}

      {dash.loading && !dash.data && <Loading />}
      {dash.error != null && !dash.data && <ErrorState error={dash.error} onRetry={dash.reload} />}
      {dash.data && (
        <div className="pgrid">
          <div className="pcol">
            <UpcomingCard
              items={dash.data.upcoming}
              onCancel={cancel.ask}
              onPay={checkout.start}
              payingId={checkout.busyId}
              onHoldEnd={dash.reload}
            />
            <InvoicesCard items={dash.data.outstandingInvoices} />
          </div>
          <div className="pcol pcol--side">
            <RequestsCard items={dash.data.pendingRequests} onCancel={cancel.ask} />
            <PackagesCard items={dash.data.packages} />
            <HelpCard />
          </div>
        </div>
      )}
      {cancel.dialog}
    </div>
  );
}

function UpcomingCard({ items, onCancel, onPay, payingId, onHoldEnd }: {
  items: BookingDto[]; onCancel: (b: BookingDto) => void; onPay: (id: string) => void; payingId: string | null; onHoldEnd: () => void;
}) {
  const { t, lang } = usePortal();
  return (
    <section className="pcard" aria-labelledby="home-up">
      <div className="pcard__head">
        <h2 id="home-up">{t.home.upcoming.title}</h2>
        <Link className="btn btn--ghost btn--sm" href={`/${lang}/portal/bookings`}>{t.home.upcoming.all}</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title={t.home.upcoming.emptyTitle}
          text={t.home.upcoming.emptyText}
          action={<Link className="btn" href={`/${lang}/portal/book`}>{t.home.upcoming.emptyAction}</Link>}
        />
      ) : (
        <ul className="plist">
          {items.map((b) => (
            <BookingRow key={b.id} b={b} onHoldEnd={onHoldEnd}>
              {b.status === "Draft" && (
                <button type="button" className="btn btn--sm" onClick={() => onPay(b.id)} disabled={payingId !== null}>
                  {payingId === b.id ? t.bookings.actions.paying : t.bookings.actions.pay}
                </button>
              )}
              {b.canCancel && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCancel(b)}>{cancelLabel(t, b)}</button>
              )}
            </BookingRow>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestsCard({ items, onCancel }: { items: BookingDto[]; onCancel: (b: BookingDto) => void }) {
  const { t } = usePortal();
  return (
    <section className="pcard" aria-labelledby="home-req">
      <div className="pcard__head"><h2 id="home-req">{t.home.requests.title}</h2></div>
      {items.length === 0 ? (
        <EmptyState title={t.home.requests.emptyTitle} text={t.home.requests.emptyText} />
      ) : (
        <>
          <ul className="plist">
            {items.map((b) => (
              <BookingRow key={b.id} b={b}>
                {b.canCancel && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onCancel(b)}>{t.bookings.actions.cancel}</button>}
              </BookingRow>
            ))}
          </ul>
          <div className="pcard__foot">{t.home.requests.note}</div>
        </>
      )}
    </section>
  );
}

function InvoicesCard({ items }: { items: InvoiceDto[] }) {
  const { t, lang } = usePortal();
  const c = t.home.invoices.columns;
  return (
    <section className="pcard" aria-labelledby="home-inv">
      <div className="pcard__head">
        <h2 id="home-inv">{t.home.invoices.title}</h2>
        <Link className="btn btn--ghost btn--sm" href={`/${lang}/portal/invoices`}>{t.home.invoices.all}</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t.home.invoices.emptyTitle} text={t.home.invoices.emptyText} />
      ) : (
        <div className="ptable-wrap" tabIndex={0} role="region" aria-labelledby="home-inv">
          <table className="ptable">
            <thead>
              <tr>
                <th scope="col">{c.number}</th>
                <th scope="col">{c.description}</th>
                <th scope="col">{c.due}</th>
                <th scope="col" className="num">{c.amount}</th>
                <th scope="col">{c.status}</th>
                <th scope="col"><span className="sr-only">{c.file}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const left = i.amountEgp - i.paidEgp;
                return (
                  <tr key={i.id}>
                    <td className="ltr">{i.number}</td>
                    <td>{localize(lang, i.description)}</td>
                    <td>
                      {i.status === "Overdue" ? <b style={{ color: "var(--danger)" }}>{fmt(t.home.invoices.overdue, { date: formatDay(lang, i.dueDate, "short") })}</b> : formatDay(lang, i.dueDate, "short")}
                    </td>
                    <td className="num">
                      <Money amount={i.amountEgp} />
                      {i.paidEgp > 0 && left > 0 && <small>{fmt(t.home.invoices.balance, { amount: lang === "ar" ? `${left.toLocaleString("en-US")} ج.م` : `EGP ${left.toLocaleString("en-US")}` })}</small>}
                    </td>
                    <td><StatusBadge kind="invoice" status={i.status} /></td>
                    <td><PdfButton invoice={i} label={t.home.invoices.download} ariaLabel={fmt(t.home.invoices.downloadLabel, { number: i.number })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="pcard__foot">{t.home.invoices.note}</div>
    </section>
  );
}

function PackagesCard({ items }: { items: PackageBalanceDto[] }) {
  const { t, lang } = usePortal();
  return (
    <section className="pcard" aria-labelledby="home-pkg">
      <div className="pcard__head">
        <h2 id="home-pkg">{t.home.packages.title}</h2>
        <Link className="btn btn--ghost btn--sm" href={`/${lang}/portal/packages`}>{t.home.packages.all}</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t.home.packages.emptyTitle} text={t.home.packages.emptyText} />
      ) : (
        items.map((p) => {
          const pct = p.total > 0 ? Math.max(0, Math.min(100, Math.round((p.remaining / p.total) * 100))) : 0;
          const name = localize(lang, p.name);
          return (
            <div className="bk-pkg" key={p.id}>
              <div className="kpi">
                <span className="kpi__label">{name}</span>
                <span className="kpi__value">
                  {fmt(t.home.packages.remaining, { remaining: p.remaining, total: p.total, unit: t.home.packages[p.unit] })}
                </span>
                <div className="meter" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
                <span className="kpi__meta">{fmt(t.home.packages.valid, { date: formatDay(lang, p.validTo, "short") })}</span>
              </div>
              <QrCode payload={p.qrPayload} name={name} />
              <p className="muted" style={{ fontSize: 14 }}>{t.home.packages.qrLine}</p>
            </div>
          );
        })
      )}
    </section>
  );
}

function HelpCard() {
  const { t, lang } = usePortal();
  return (
    <section className="pcard" aria-labelledby="home-help">
      <div className="pcard__body stack" style={{ gap: "var(--space-2)" }}>
        <h2 id="home-help" style={{ fontSize: 16, fontWeight: 600 }}>{t.home.help.title}</h2>
        <p className="muted">{t.home.help.text}</p>
        <Link className="btn btn--sm" href={`/${lang}/contact`} style={{ alignSelf: "flex-start" }}>{t.home.help.link}</Link>
      </div>
    </section>
  );
}
