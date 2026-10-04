"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addDaysIso, todayIso } from "@/lib/dates";

export interface PickerSpace {
  slug: string;
  name: string;
  quantityBased: boolean;
}

const TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];

export function HeroPicker({
  locale,
  spaces,
  labels,
}: {
  locale: string;
  spaces: PickerSpace[];
  labels: { title: string; space: string; date: string; time: string; go: string };
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(spaces[0]?.slug ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const selected = spaces.find((s) => s.slug === slug);

  useEffect(() => setDate(addDaysIso(1)), []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const q = new URLSearchParams({ date });
    if (!selected.quantityBased) q.set("start", time);
    router.push(`/${locale}/spaces/${selected.slug}?${q.toString()}`);
  }

  return (
    <form className="picker" onSubmit={submit} aria-labelledby="picker-title">
      <h2 id="picker-title">{labels.title}</h2>
      <div className="picker__grid">
        <div className="field wide">
          <label className="label" htmlFor="picker-space">{labels.space}</label>
          <select className="select" id="picker-space" value={slug} onChange={(e) => setSlug(e.target.value)}>
            {spaces.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className={`field${selected?.quantityBased ? " wide" : ""}`}>
          <label className="label" htmlFor="picker-date">{labels.date}</label>
          <input className="input num" id="picker-date" type="date" min={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        {!selected?.quantityBased && (
          <div className="field">
            <label className="label" htmlFor="picker-time">{labels.time}</label>
            <select className="select num" id="picker-time" value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button className="btn btn--primary btn--lg btn--block" type="submit">{labels.go}</button>
    </form>
  );
}
