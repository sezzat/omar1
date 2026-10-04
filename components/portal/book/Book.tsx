"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { PublicSpace } from "@/lib/catalog/types";
import { usePortal } from "../PortalProvider";
import { EmptyState, ErrorState, Loading, PageHeader, useApi } from "../ui";
import { InstantFlow, type InstantInitial } from "./InstantFlow";
import { RequestFlow, type RequestInitial } from "./RequestFlow";
import { cairoNow, validDate, type Mode } from "./shared";
import "./book.css";

interface Params { mode?: Mode; space?: string; date?: string; start?: string; hours?: number; term?: 3 | 6 | 12; startDate?: string }

/** Every query value is validated; anything unexpected is ignored. */
function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const today = cairoNow().date;
  const out: Params = {};
  const mode = q.get("mode");
  if (mode === "book") out.mode = "instant";
  else if (mode === "request") out.mode = "request";
  const space = q.get("space");
  if (space && /^[a-z0-9-]{1,80}$/.test(space)) out.space = space;
  const date = q.get("date");
  if (date && validDate(date, today)) out.date = date;
  const start = q.get("start");
  if (start && /^(09|1[0-6]):00$/.test(start)) out.start = start;
  const hours = Number(q.get("hours"));
  if (Number.isInteger(hours) && hours >= 1 && hours <= 3) out.hours = hours;
  const term = Number(q.get("term"));
  if (term === 3 || term === 6 || term === 12) out.term = term;
  // The public booking panel sends the monthly start date as `start` (a time like 09:00 for day bookings).
  const startDate = q.get("startDate") ?? (mode === "request" ? q.get("start") : null);
  if (startDate && validDate(startDate, today)) out.startDate = startDate;
  return out;
}

export function Book() {
  const { lang, t, me } = usePortal();
  const legend = useId();
  const catalogue = useApi<{ data: PublicSpace[] }>("/api/v1/public/spaces");
  const [params, setParams] = useState<Params | null>(null);
  const [picked, setPicked] = useState<Mode | null>(null);

  useEffect(() => {
    setParams(parseParams(window.location.search));
  }, []);

  const spaces = useMemo(() => catalogue.data?.data ?? [], [catalogue.data]);
  const instant = useMemo(() => spaces.filter((s) => s.bookingMode === "instant"), [spaces]);
  const request = useMemo(() => spaces.filter((s) => s.bookingMode === "request"), [spaces]);

  if (me.permissions.contactUs) {
    return (
      <div className="bw-stack">
        <PageHeader title={t.book.title} />
        <section className="pcard">
          <div className="pcard__body bw-body">
            <p>{t.book.unavailable.text}</p>
            <div><Link className="btn" href={`/${lang}/contact`}>{t.book.unavailable.link}</Link></div>
          </div>
        </section>
      </div>
    );
  }

  const ready = params !== null && !catalogue.loading && catalogue.error == null && catalogue.data !== null;
  const fromSpace = params?.space ? spaces.find((s) => s.slug === params.space)?.bookingMode : undefined;
  const mode: Mode = picked ?? params?.mode ?? fromSpace ?? "instant";
  const wanted = (list: PublicSpace[]) => (params?.space && list.some((s) => s.slug === params.space) ? params.space : undefined);

  const instantInitial: InstantInitial = { space: wanted(instant), date: params?.date, start: params?.start, hours: params?.hours };
  const requestInitial: RequestInitial = { space: wanted(request), term: params?.term, startDate: params?.startDate };

  const cards: { value: Mode; title: string; text: string }[] = [
    { value: "instant", title: t.book.modes.instant.title, text: t.book.modes.instant.text },
    { value: "request", title: t.book.modes.request.title, text: t.book.modes.request.text },
  ];

  return (
    <div className="bw-stack">
      <PageHeader title={t.book.title} subtitle={t.book.subtitle} />
      <fieldset className="bw-fieldset" aria-labelledby={legend}>
        <legend className="sr-only" id={legend}>{t.book.modeLegend}</legend>
        <div className="bw-modes" role="radiogroup" aria-labelledby={legend}>
          {cards.map((c) => (
            <label key={c.value} className="bw-mode">
              <input type="radio" name={`${legend}-mode`} value={c.value} checked={mode === c.value} onChange={() => setPicked(c.value)} />
              <span className="bw-mode__main"><b>{c.title}</b><span>{c.text}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {(catalogue.loading || params === null) && <Loading />}
      {!catalogue.loading && catalogue.error != null && <ErrorState error={catalogue.error} onRetry={catalogue.reload} />}
      {ready && (
        <>
          <div className="bw-flow" hidden={mode !== "instant"}>
            {instant.length > 0 ? <InstantFlow spaces={instant} initial={instantInitial} /> : <EmptyState title={t.book.noSpaces.title} text={t.book.noSpaces.text} />}
          </div>
          <div className="bw-flow" hidden={mode !== "request"}>
            {request.length > 0 ? <RequestFlow spaces={request} initial={requestInitial} /> : <EmptyState title={t.book.noSpaces.title} text={t.book.noSpaces.text} />}
          </div>
        </>
      )}
    </div>
  );
}
