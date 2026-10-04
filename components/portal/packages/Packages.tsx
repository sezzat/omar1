"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";
import { localize } from "@/lib/i18n";
import { formatDay } from "@/lib/portal/format";
import type { PackageBalanceDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { EmptyState, ErrorState, Loading, PageHeader, useApi } from "../ui";
import "./packages.css";

function Qr({ payload, name }: { payload: string; name: string }) {
  const { t } = usePortal();
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    import("qrcode")
      .then((QR) => QR.toDataURL(payload, { errorCorrectionLevel: "M", margin: 3, width: 400, color: { dark: "#111820", light: "#ffffff" } }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div className="pk-qr">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={200} height={200} alt={fmt(t.packages.qrAlt, { name })} />
      ) : (
        !failed && <div className="pk-qr__ph" aria-hidden="true" />
      )}
      <div className="pk-qr__text">
        <b>{t.packages.qrTitle}</b>
        <p>{t.packages.qrHelp}</p>
        {failed && <p className="pk-fail" role="alert">{t.packages.qrFailed}</p>}
        <code className="ltr"><span className="sr-only">{t.packages.qrCodeText}: </span>{payload}</code>
      </div>
    </div>
  );
}

function PackageCard({ pkg, past }: { pkg: PackageBalanceDto; past?: boolean }) {
  const { t, lang } = usePortal();
  const name = localize(lang, pkg.name);
  const unit = t.packages.units[pkg.unit];
  const pct = pkg.total > 0 ? Math.max(0, Math.min(100, Math.round((pkg.remaining / pkg.total) * 100))) : 0;
  const tone = pkg.status === "Active" ? "badge--success" : "";

  return (
    <li className="pcard pk-card" style={{ listStyle: "none" }}>
      <div className="pcard__body pk-card__body">
        <div className="pk-card__top">
          <div>
            <h3>{name}</h3>
            <small>{fmt(t.packages.appliesTo, { kind: t.common.kinds[pkg.appliesTo] })}</small>
          </div>
          <span className={`badge ${tone}`}>{t.packages.status[pkg.status]}</span>
        </div>
        <div>
          <p className="pk-left num">{fmt(t.packages.left, { remaining: pkg.remaining, total: pkg.total, unit })}</p>
          <div className="meter" role="progressbar" aria-label={fmt(t.packages.meterLabel, { name })} aria-valuemin={0} aria-valuemax={pkg.total} aria-valuenow={pkg.remaining} aria-valuetext={fmt(t.packages.left, { remaining: pkg.remaining, total: pkg.total, unit })}>
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ul className="pk-facts">
          {pkg.reserved > 0 && <li className="num">{fmt(t.packages.reserved, { n: pkg.reserved, unit })}</li>}
          {pkg.consumed > 0 && <li className="num">{fmt(t.packages.used, { n: pkg.consumed, unit })}</li>}
          <li>{fmt(t.packages.validity, { from: formatDay(lang, pkg.validFrom, "short"), to: formatDay(lang, pkg.validTo, "short") })}</li>
        </ul>
        {!past && pkg.status === "Active" && <Qr payload={pkg.qrPayload} name={name} />}
      </div>
    </li>
  );
}

export function Packages() {
  const { t, lang, me } = usePortal();
  const { data, error, loading, reload } = useApi<PackageBalanceDto[]>("/api/v1/customer/packages");

  const active = data?.filter((p) => p.status === "Active") ?? [];
  const past = data?.filter((p) => p.status !== "Active") ?? [];

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <PageHeader
        title={t.packages.title}
        subtitle={t.packages.subtitle}
        action={!me.permissions.contactUs ? <Link className="btn btn--primary" href={`/${lang}/portal/book`}>{t.packages.book}</Link> : undefined}
      />

      {loading && !data && <Loading />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.length === 0 && (
        <div className="pcard">
          <EmptyState
            title={t.packages.emptyTitle}
            text={t.packages.emptyText}
            action={
              <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap" }}>
                <Link className="btn" href={`/${lang}/packages`}>{t.packages.emptyPackages}</Link>
                <Link className="btn btn--ghost" href={`/${lang}/contact`}>{t.packages.emptyContact}</Link>
              </div>
            }
          />
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <section className="pcard" aria-labelledby="pk-how">
            <div className="pcard__body pk-how">
              <h2 id="pk-how" style={{ fontSize: 16, fontWeight: 600 }}>{t.packages.how.title}</h2>
              <ol>
                <li>{t.packages.how.p1}</li>
                <li>{t.packages.how.p2}</li>
                <li>{t.packages.how.p3}</li>
              </ol>
            </div>
          </section>

          {active.length > 0 && (
            <section className="stack" aria-labelledby="pk-active">
              <h2 id="pk-active" style={{ fontSize: 18, fontWeight: 600 }}>{t.packages.activeHeading}</h2>
              <ul className="pk-list" style={{ margin: 0, padding: 0 }}>
                {active.map((p) => <PackageCard key={p.id} pkg={p} />)}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="stack pk-past" aria-labelledby="pk-past">
              <div>
                <h2 id="pk-past" style={{ fontSize: 16, fontWeight: 600 }}>{t.packages.pastHeading}</h2>
                <p className="muted" style={{ fontSize: 14 }}>{t.packages.pastText}</p>
              </div>
              <ul className="pk-list" style={{ margin: 0, padding: 0 }}>
                {past.map((p) => <PackageCard key={p.id} pkg={p} past />)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
