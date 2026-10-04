import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceCard } from "@/components/SpaceCard";
import { getSpaces } from "@/lib/catalog";
import { groupByKind } from "@/lib/catalog-view";
import { getMessages, isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return pageMetadata(lang, "/spaces", t.meta.spaces.title, t.meta.spaces.description);
}

export default async function SpacesPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);
  const groups = groupByKind(await getSpaces());

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="h1">{t.spaces.title}</h1>
        <p className="lead">{t.spaces.lead}</p>
      </div>
      <div style={{ paddingBottom: 64 }}>
        {groups.length === 0 && <p className="lead">{t.spaces.empty}</p>}
        {groups.map(({ kind, spaces }) => (
          <section className="group" id={kind} key={kind} style={{ scrollMarginTop: 24 }}>
            <h2 className="group__title">{t.kinds[kind]}</h2>
            <div className="cards">
              {spaces.map((space) => (
                <SpaceCard key={space.id} space={space} locale={lang} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
