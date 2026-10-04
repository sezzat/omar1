import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackageTypes } from "@/lib/catalog";
import { fmt, formatEgp, getMessages, isLocale, localize } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return pageMetadata(lang, "/packages", t.meta.packages.title, t.meta.packages.description);
}

export default async function PackagesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);
  const packages = await getPackageTypes();

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="h1">{t.packages.title}</h1>
        <p className="lead">{t.packages.lead}</p>
      </div>

      {packages.length === 0 && <p className="lead">{t.packages.empty}</p>}
      <div className="cards">
        {packages.map((p) => {
          const name = localize(lang, p.name);
          const amount = fmt(p.unit === "hours" ? t.packages.hours : t.packages.days, { n: p.quantity });
          return (
            <article className="card" key={p.id}>
              <div className="card__body">
                <span className="badge badge--info" style={{ alignSelf: "flex-start" }}>
                  {p.appliesTo === "meeting-room" ? t.packages.appliesMeeting : t.packages.appliesHotDesk}
                </span>
                <h2 className="card__title">{name}</h2>
                <p className="card__text">{localize(lang, p.description)}</p>
                <ul className="rows">
                  <li><span>{amount}</span><span className="num">{fmt(t.packages.validity, { n: p.validityDays })}</span></li>
                </ul>
              </div>
              <div className="card__foot">
                <span className="price">{formatEgp(lang, p.priceEgp)}</span>
                <Link className="btn btn--sm" href={`/${lang}/contact?about=${encodeURIComponent(name)}#contact-form`}>{t.packages.ask}</Link>
              </div>
            </article>
          );
        })}
      </div>

      <section className="block how" style={{ padding: "48px 0 64px" }}>
        <h2>{t.packages.howTitle}</h2>
        <ol className="steps" style={{ marginTop: 8 }}>
          {t.packages.how.map((text) => (
            <li key={text}><div><span style={{ color: "var(--ink)" }}>{text}</span></div></li>
          ))}
        </ol>
      </section>
    </div>
  );
}
