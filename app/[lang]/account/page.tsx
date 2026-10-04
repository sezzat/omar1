import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSpace } from "@/lib/catalog";
import { fmt, getMessages, isLocale, localize } from "@/lib/i18n";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ space?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getMessages(lang);
  return { ...pageMetadata(lang, "/account", t.meta.account.title, t.meta.account.description), robots: { index: false } };
}

/** Placeholder for sign in and registration; the customer portal is built in the next release. */
export default async function AccountPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { space: slug } = await searchParams;
  const space = slug ? await getSpace(slug) : null;
  const t = getMessages(lang);

  return (
    <div className="wrap">
      <div className="page-head legal-body" style={{ paddingBottom: 96 }}>
        <h1 className="h1">{t.account.title}</h1>
        <p className="lead">{t.account.lead}</p>
        {space && <p><b>{fmt(t.account.intent, { space: localize(lang, space.name) })}</b></p>}
        <div className="banner banner--info" style={{ marginTop: 16 }}>
          <div>{t.account.pending}<br />{t.account.contactFirst}</div>
        </div>
        <div><Link className="btn btn--dark" href={`/${lang}/contact`}>{t.account.contactLink}</Link></div>
      </div>
    </div>
  );
}
