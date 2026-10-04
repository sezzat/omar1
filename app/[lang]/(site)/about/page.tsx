import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, isLocale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return pageMetadata(lang, "/about", t.meta.about.title, t.meta.about.description);
}

export default async function AboutPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 className="h1">{t.about.title}</h1>
        <p className="lead">{t.about.lead}</p>
      </div>
      <div className="flows" style={{ paddingBottom: 24 }}>
        {t.about.blocks.map((b) => (
          <section className="flow" key={b.title}>
            <h2 style={{ fontSize: 19, lineHeight: "28px", fontWeight: 600 }}>{b.title}</h2>
            <p className="muted">{b.text}</p>
          </section>
        ))}
      </div>
      <p className="note" style={{ paddingBottom: 64 }}>{t.about.storyNote}</p>
    </div>
  );
}
