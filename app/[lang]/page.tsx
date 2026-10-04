import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroPicker } from "@/components/HeroPicker";
import { Icon } from "@/components/Icon";
import { Intro } from "@/components/Intro";
import { LocalBusinessJsonLd } from "@/components/JsonLd";
import { PriceTag } from "@/components/PriceTag";
import { SpacePhoto } from "@/components/SpacePhoto";
import { ModeBadge } from "@/components/SpaceCard";
import { getSpaces } from "@/lib/catalog";
import { groupByKind } from "@/lib/catalog-view";
import { getMessages, isLocale, localize } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return pageMetadata(lang, "", t.meta.home.title, t.meta.home.description);
}

const rise = (i: number) => ({ "--i": i }) as React.CSSProperties;

export default async function HomePage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);
  const spaces = await getSpaces();
  const groups = groupByKind(spaces);
  const instant = spaces.filter((s) => s.bookingMode === "instant");
  const icons = ["bolt", "receipt", "shield"] as const;

  return (
    <>
      <Intro tagline={t.intro.tagline} skip={t.intro.skip} />
      <LocalBusinessJsonLd locale={lang} />

      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <h1 className="rise" style={rise(0)}>{t.home.heroTitle}</h1>
            <p className="lead rise" style={rise(1)}>{t.home.heroLead}</p>
            <Link className="btn btn--ghost rise" style={rise(2)} href={`/${lang}/spaces`}>{t.home.browse}</Link>
            <ul className="points rise" style={rise(3)}>
              {t.home.points.map((text, i) => (
                <li className="point" key={text}>
                  <Icon name={icons[i]} />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="hero__media rise" style={rise(2)}>
            <div className="hero__photo">
              <SpacePhoto name={t.home.heroPhoto} locale={lang} t={t} sizes="(max-width: 960px) 100vw, 560px" />
            </div>
            <HeroPicker
              locale={lang}
              spaces={instant.map((s) => ({ slug: s.slug, name: localize(lang, s.name), quantityBased: s.quantityBased }))}
              labels={t.picker}
            />
          </div>
        </div>
      </section>

      <section className="section" id="spaces">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">{t.home.spacesTitle}</h2>
            <p className="lead">{t.home.spacesLead}</p>
          </div>
          <div className="cards">
            {groups.map(({ kind, spaces: group, from }) => {
              const first = group[0];
              const href = group.length === 1 ? `/${lang}/spaces/${first.slug}` : `/${lang}/spaces#${kind}`;
              const title = t.kinds[kind];
              return (
                <article className="card" key={kind}>
                  <div className="card__media">
                    <SpacePhoto photo={first.photos[0]} name={title} locale={lang} t={t} badge={<ModeBadge mode={first.bookingMode} t={t} />} />
                  </div>
                  <div className="card__body">
                    <h3 className="card__title">{title}</h3>
                    <p className="card__text">{localize(lang, first.summary)}</p>
                  </div>
                  <div className="card__foot">
                    <PriceTag locale={lang} t={t} amount={from.amount} unit={from.unit} />
                    <Link className="btn btn--sm" href={href} aria-label={`${t.common.details}: ${title}`}>{t.common.details}</Link>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="more"><Link href={`/${lang}/spaces`}>{t.home.viewAll}</Link></p>
        </div>
      </section>

      <section className="section section--tight-top">
        <div className="wrap">
          <div className="head">
            <h2 className="h2">{t.home.flowsTitle}</h2>
          </div>
          <div className="flows">
            <div className="flow">
              <div className="flow__head">
                <h3>{t.home.instantTitle}</h3>
                <span className="badge badge--success">{t.home.instantBadge}</span>
              </div>
              <ol className="steps">
                {t.home.instantSteps.map((s) => (
                  <li key={s.title}><div><b>{s.title}</b><span>{s.text}</span></div></li>
                ))}
              </ol>
            </div>
            <div className="flow">
              <div className="flow__head">
                <h3>{t.home.requestTitle}</h3>
                <span className="badge badge--info">{t.home.requestBadge}</span>
              </div>
              <ol className="steps">
                {t.home.requestSteps.map((s) => (
                  <li key={s.title}><div><b>{s.title}</b><span>{s.text}</span></div></li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap cta__row">
          <div>
            <h2 className="h2">{t.home.ctaTitle}</h2>
            <p className="lead">{t.home.ctaText}</p>
          </div>
          <Link className="btn btn--dark btn--lg" href={`/${lang}/account`}>{t.home.createAccount}</Link>
        </div>
      </section>
    </>
  );
}
