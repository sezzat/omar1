import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getMessages, isLocale } from "@/lib/i18n";

/** Public website chrome: header, footer and skip link. The portal has its own layout. */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);
  return (
    <>
      <a className="skip-link" href="#main">{t.nav.skipToContent}</a>
      <SiteHeader locale={lang} t={t} />
      <main id="main">{children}</main>
      <SiteFooter locale={lang} t={t} />
    </>
  );
}
