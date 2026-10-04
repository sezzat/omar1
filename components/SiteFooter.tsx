import Image from "next/image";
import Link from "next/link";
import type { Locale, Messages } from "@/lib/i18n";
import { otherLocale } from "@/lib/i18n";

export function SiteFooter({ locale, t }: { locale: Locale; t: Messages }) {
  const other = otherLocale(locale);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div className="footer__brand">
            <div className="footer__tile">
              <Image src="/flux-logo.png" alt={t.meta.siteName} width={853} height={492} unoptimized />
            </div>
            <p>{t.footer.tagline}</p>
          </div>
          <div>
            <h2>{t.footer.spaces}</h2>
            <ul>
              <li><Link href={`/${locale}/spaces#hot-desk`}>{t.kinds["hot-desk"]}</Link></li>
              <li><Link href={`/${locale}/spaces#meeting-room`}>{t.kinds["meeting-room"]}</Link></li>
              <li><Link href={`/${locale}/spaces#dedicated-desk`}>{t.kinds["dedicated-desk"]}</Link></li>
              <li><Link href={`/${locale}/spaces#private-office`}>{t.kinds["private-office"]}</Link></li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.legal}</h2>
            <ul>
              <li><Link href={`/${locale}/legal/terms`}>{t.legal.terms}</Link></li>
              <li><Link href={`/${locale}/legal/privacy`}>{t.legal.privacy}</Link></li>
              <li><Link href={`/${locale}/legal/cancellation`}>{t.legal.cancellation}</Link></li>
            </ul>
          </div>
          <div>
            <h2>{t.footer.contactHeading}</h2>
            <ul>
              <li><Link href={`/${locale}/contact`}>{t.nav.contact}</Link></li>
              <li><Link href={`/${locale}/account`}>{t.nav.signIn}</Link></li>
              <li><Link href={`/${locale}/about`}>{t.nav.about}</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer__base">
          <span className="ltr">{t.footer.rights}</span>
          <Link href={`/${other}`} lang={other} hrefLang={other}>{t.nav.otherLanguageName}</Link>
        </div>
      </div>
    </footer>
  );
}
