import Image from "next/image";
import type { Photo } from "@/lib/catalog";
import { fmt, localize, type Locale, type Messages } from "@/lib/i18n";

/** Shows the first photo, or a labelled placeholder until professional photography is supplied. */
export function SpacePhoto({
  photo,
  name,
  locale,
  t,
  badge,
  sizes = "(max-width: 640px) 100vw, 400px",
}: {
  photo?: Photo;
  name: string;
  locale: Locale;
  t: Messages;
  badge?: React.ReactNode;
  sizes?: string;
}) {
  return (
    <div className="photo">
      {photo?.url ? (
        <Image src={photo.url} alt={localize(locale, photo.alt)} fill sizes={sizes} style={{ objectFit: "cover" }} />
      ) : (
        <span className="photo__label">{fmt(t.common.photoOf, { name })}</span>
      )}
      {badge}
    </div>
  );
}
