import Link from "next/link";
import { PriceTag } from "./PriceTag";
import { SpacePhoto } from "./SpacePhoto";
import type { PublicSpace } from "@/lib/catalog";
import { fmt, localize, type Locale, type Messages } from "@/lib/i18n";

export function ModeBadge({ mode, t }: { mode: PublicSpace["bookingMode"]; t: Messages }) {
  return mode === "instant" ? (
    <span className="badge badge--success">{t.common.instant}</span>
  ) : (
    <span className="badge badge--info">{t.common.byRequest}</span>
  );
}

export function capacityText(space: PublicSpace, t: Messages): string {
  if (space.quantityBased) return fmt(t.common.seats, { n: space.capacity });
  if (space.kind === "private-office") return fmt(t.common.desks, { n: space.capacity });
  if (space.kind === "dedicated-desk") return t.kinds["dedicated-desk"];
  return fmt(t.common.capacity, { n: space.capacity });
}

export function SpaceCard({ space, locale, t, titleLevel = 3 }: { space: PublicSpace; locale: Locale; t: Messages; titleLevel?: 2 | 3 }) {
  const name = localize(locale, space.name);
  const Heading = titleLevel === 2 ? "h2" : "h3";
  return (
    <article className="card">
      <div className="card__media">
        <SpacePhoto photo={space.photos[0]} name={name} locale={locale} t={t} badge={<ModeBadge mode={space.bookingMode} t={t} />} />
      </div>
      <div className="card__body">
        <Heading className="card__title">{name}</Heading>
        <p className="card__text">{localize(locale, space.summary)}</p>
        <p className="card__meta">
          {capacityText(space, t)}, {fmt(t.common.floor, { n: space.floor })}
        </p>
      </div>
      <div className="card__foot">
        <PriceTag locale={locale} t={t} amount={space.fromPrice.amount} unit={space.fromPrice.unit} />
        <Link className="btn btn--sm" href={`/${locale}/spaces/${space.slug}`} aria-label={`${t.common.details}: ${name}`}>
          {t.common.details}
        </Link>
      </div>
    </article>
  );
}
