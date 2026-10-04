import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingPanel } from "@/components/BookingPanel";
import { Icon } from "@/components/Icon";
import { ModeBadge, capacityText } from "@/components/SpaceCard";
import { SpacePhoto } from "@/components/SpacePhoto";
import { getSpace, getSpaces } from "@/lib/catalog";
import { fmt, getMessages, isLocale, localize, locales } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateStaticParams() {
  const spaces = await getSpaces();
  return locales.flatMap((lang) => spaces.map((s) => ({ lang, slug: s.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const space = await getSpace(slug);
  if (!space) return {};
  const t = getMessages(lang);
  const name = localize(lang, space.name);
  return pageMetadata(lang, `/spaces/${slug}`, `${name} | ${t.meta.siteName}`, localize(lang, space.summary));
}

export default async function SpaceDetailPage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const space = await getSpace(slug);
  if (!space) notFound();
  const t = getMessages(lang);
  const name = localize(lang, space.name);
  const photos = space.photos.length ? space.photos : [undefined];

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label={t.common.breadcrumb}>
        <Link href={`/${lang}`}>{t.nav.home}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/${lang}/spaces`}>{t.nav.spaces}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>

      <div className="page-title">
        <div>
          <h1 className="h1">{name}</h1>
          <div className="meta">
            <span><Icon name="users" />{capacityText(space, t)}</span>
            <span><Icon name="pin" />{fmt(t.common.floor, { n: space.floor })}, {t.common.branch}</span>
          </div>
        </div>
        <ModeBadge mode={space.bookingMode} t={t} />
      </div>

      <div className="gallery">
        <div className="gallery__main"><SpacePhoto photo={photos[0]} name={name} locale={lang} t={t} sizes="(max-width: 960px) 100vw, 780px" /></div>
        <div className="gallery__side">
          <div><SpacePhoto photo={photos[1]} name={name} locale={lang} t={t} sizes="400px" /></div>
          <div><SpacePhoto photo={photos[2]} name={name} locale={lang} t={t} sizes="400px" /></div>
        </div>
      </div>

      <div className="detail">
        <div className="detail__main">
          <section className="block">
            <h2>{t.detail.about}</h2>
            <p>{localize(lang, space.description)}</p>
          </section>
          <section className="block">
            <h2>{t.detail.amenities}</h2>
            <ul className="chips">
              {space.amenities.map((a) => (
                <li className="chip" key={a}><Icon name={a} size={16} />{t.amenities[a]}</li>
              ))}
            </ul>
          </section>
          <section className="block">
            <h2>{t.detail.cancellation}</h2>
            <p>{t.detail.cancellationText}</p>
            <Link href={`/${lang}/legal/cancellation`}>{t.detail.policyLink}</Link>
          </section>
        </div>
        <aside className="detail__side">
          <BookingPanel
            locale={lang}
            space={{ slug: space.slug, bookingMode: space.bookingMode, quantityBased: space.quantityBased, price: space.fromPrice }}
            t={{ ...t.detail, perHour: t.common.perHour, perDay: t.common.perDay, perMonth: t.common.perMonth, from: t.common.from }}
          />
        </aside>
      </div>
    </div>
  );
}
