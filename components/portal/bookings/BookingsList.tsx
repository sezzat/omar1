"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import type { BookingDto } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { EmptyState, ErrorState, Loading, PageHeader, useApi } from "../ui";
import { BookingRow } from "./shared";
import "./bookings.css";

type TabKey = "upcoming" | "past" | "requests";
const TABS: TabKey[] = ["upcoming", "past", "requests"];

export function BookingsList() {
  const { t, lang, me } = usePortal();
  const { data, error, loading, reload } = useApi<BookingDto[]>("/api/v1/customer/bookings?scope=all");
  const [tab, setTab] = useState<TabKey>("upcoming");
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const groups = useMemo(() => {
    const now = Date.now();
    const all = data ?? [];
    const isRequest = (b: BookingDto) => b.mode === "request" && b.status === "Pending";
    const ended = (b: BookingDto) => ["Completed", "Cancelled", "No-show"].includes(b.status) || Date.parse(b.endsAt) <= now;
    return {
      upcoming: all.filter((b) => !isRequest(b) && !ended(b)).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      past: all.filter((b) => !isRequest(b) && ended(b)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      requests: all.filter(isRequest).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    } satisfies Record<TabKey, BookingDto[]>;
  }, [data]);

  function onKey(e: React.KeyboardEvent, i: number) {
    const forward = lang === "ar" ? "ArrowLeft" : "ArrowRight";
    const back = lang === "ar" ? "ArrowRight" : "ArrowLeft";
    let n = i;
    if (e.key === forward) n = (i + 1) % TABS.length;
    else if (e.key === back) n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[n]);
    refs.current[TABS[n]]?.focus();
  }

  const list = groups[tab];
  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <PageHeader
        title={t.bookings.title}
        subtitle={t.bookings.subtitle}
        action={!me.permissions.contactUs ? <Link className="btn btn--primary" href={`/${lang}/portal/book`}>{t.bookings.book}</Link> : undefined}
      />
      {loading && !data && <Loading />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div>
          <div className="tabs" role="tablist" aria-label={t.bookings.tabsLabel}>
            {TABS.map((k, i) => (
              <button
                key={k}
                ref={(el) => { refs.current[k] = el; }}
                type="button"
                role="tab"
                id={`${base}-tab-${k}`}
                className="tab"
                aria-selected={tab === k}
                aria-controls={`${base}-panel-${k}`}
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {t.bookings.tabs[k]}
                <span className="count">{groups[k].length}</span>
              </button>
            ))}
          </div>
          {TABS.map((k) => (
            <div
              key={k}
              role="tabpanel"
              id={`${base}-panel-${k}`}
              aria-labelledby={`${base}-tab-${k}`}
              className="bk-tabpanel"
              tabIndex={0}
              hidden={tab !== k}
            >
              {tab === k && (list.length === 0 ? (
                <EmptyState
                  title={t.bookings.empty[k].title}
                  text={t.bookings.empty[k].text}
                  action={!me.permissions.contactUs ? <Link className="btn" href={`/${lang}/portal/book`}>{t.bookings.book}</Link> : undefined}
                />
              ) : (
                <ul className="plist">
                  {list.map((b) => <BookingRow key={b.id} b={b} onHoldEnd={reload} />)}
                </ul>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
