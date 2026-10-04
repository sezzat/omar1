import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fmt, getMessages, isLocale, locales } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

const docs = ["terms", "privacy", "cancellation"] as const;
type Doc = (typeof docs)[number];
type Props = { params: Promise<{ lang: string; doc: string }> };

export function generateStaticParams() {
  return locales.flatMap((lang) => docs.map((doc) => ({ lang, doc })));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, doc } = await params;
  if (!isLocale(lang) || !docs.includes(doc as Doc)) return {};
  const t = getMessages(lang);
  const title = t.legal[doc as Doc];
  return pageMetadata(lang, `/legal/${doc}`, fmt(t.meta.legal.title, { doc: title }), fmt(t.meta.legal.description, { doc: title }));
}

export default async function LegalPage({ params }: Props) {
  const { lang, doc } = await params;
  if (!isLocale(lang) || !docs.includes(doc as Doc)) notFound();
  const t = getMessages(lang);

  return (
    <div className="wrap">
      <div className="page-head legal-body" style={{ paddingBottom: 96 }}>
        <h1 className="h1">{t.legal[doc as Doc]}</h1>
        <p className="lead">{t.legal.pending}</p>
      </div>
    </div>
  );
}
