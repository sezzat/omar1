import Image from "next/image";
import Link from "next/link";
import { AuthLink } from "./AuthLink";
import { Icon } from "./Icon";
import { LangSwitch } from "./LangSwitch";
import { NavLinks, type NavItem } from "./NavLinks";
import type { Locale, Messages } from "@/lib/i18n";

export function SiteHeader({ locale, t }: { locale: Locale; t: Messages }) {
  const items: NavItem[] = [
    { href: "", label: t.nav.home },
    { href: "/spaces", label: t.nav.spaces },
    { href: "/packages", label: t.nav.packages },
    { href: "/contact", label: t.nav.contact },
    { href: "/about", label: t.nav.about },
  ];
  return (
    <header className="site-header">
      <div className="wrap site-header__row">
        <Link className="logo" href={`/${locale}`} aria-label={t.meta.siteName}>
          <Image src="/flux-logo.png" alt={t.meta.siteName} width={853} height={492} priority unoptimized />
        </Link>
        <nav className="nav" aria-label={t.nav.label}>
          <NavLinks locale={locale} items={items} />
        </nav>
        <div className="header-actions">
          <LangSwitch locale={locale} name={t.nav.otherLanguageName} label={t.nav.switchLanguage} />
          <AuthLink className="btn btn--ghost" href={`/${locale}/account`} signIn={t.nav.signIn} account={t.nav.myAccount} />
          <details className="menu">
            <summary aria-label={t.nav.menu}>
              <Icon name="menu" size={22} />
            </summary>
            <nav className="menu__panel" aria-label={t.nav.label}>
              <NavLinks locale={locale} items={[...items, { href: "/account", label: t.nav.signIn }]} />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
