"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/portal/client";
import { fmt } from "@/lib/format";
import { usePortal } from "./PortalProvider";

const NAV = [
  { href: "", key: "home" },
  { href: "/book", key: "book" },
  { href: "/bookings", key: "bookings" },
  { href: "/packages", key: "packages" },
  { href: "/invoices", key: "invoices" },
  { href: "/profile", key: "profile" },
] as const;

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { lang, t, me, signOut } = usePortal();
  const pathname = usePathname();
  const base = `/${lang}/portal`;
  const other = lang === "ar" ? "en" : "ar";
  const switchHref = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${other}`);
  const [resend, setResend] = useState<"idle" | "sent" | "failed">("idle");

  const items = NAV.map((n) => {
    const href = `${base}${n.href}`;
    const current = n.href === "" ? pathname === base : pathname === href || pathname.startsWith(`${href}/`);
    return { ...n, href, current };
  });
  const links = items.map((n) => (
    <Link key={n.key} href={n.href} aria-current={n.current ? "page" : undefined}>
      {t.shell.nav[n.key]}
    </Link>
  ));

  async function resendLink() {
    try {
      await api("/api/v1/customer/auth/resend-verification", { method: "POST" });
      setResend("sent");
    } catch {
      setResend("failed");
    }
  }

  return (
    <div className="pshell">
      <a className="skip-link" href="#portal-main">{t.shell.skipToContent}</a>
      <header className="ptop">
        <div className="wrap ptop__row">
          <Link className="logo" href={`/${lang}`} aria-label={t.shell.backToSite}>
            <Image src="/flux-logo.png" alt="Flux Business Hub" width={853} height={492} priority unoptimized />
          </Link>
          <nav className="pnav" aria-label={t.shell.nav.label}>{links}</nav>
          <div className="spacer" />
          <details className="pmenu">
            <summary aria-label={t.shell.openMenu}><Icon name="menu" size={22} /></summary>
            <nav className="pmenu__panel" aria-label={t.shell.nav.label}>{links}</nav>
          </details>
          <Link className="lang-switch" href={switchHref} lang={other} hrefLang={other} aria-label={t.shell.switchLanguage}>
            <Icon name="globe" size={16} />
            {t.shell.otherLanguageName}
          </Link>
          <details className="umenu">
            <summary aria-label={t.shell.account}><span className="avatar" aria-hidden="true">{initials(me.customer.name)}</span></summary>
            <div className="umenu__panel">
              <div className="umenu__who"><b>{me.customer.companyName ?? me.customer.name}</b><span className="ltr">{me.user.email}</span></div>
              <Link href={`${base}/profile`}>{t.shell.nav.profile}</Link>
              <Link href={`/${lang}`}>{t.shell.backToSite}</Link>
              <button type="button" onClick={() => void signOut()}>{t.shell.signOut}</button>
            </div>
          </details>
        </div>
      </header>

      <main id="portal-main" className="pshell__main">
        <div className="wrap pshell__stack">
          {!me.user.emailVerified && (
            <div className="banner banner--info" role="status">
              <Icon name="mail" size={20} />
              <div>
                {fmt(t.shell.verifyBanner.text, { email: me.user.email })}{" "}
                {resend === "idle" && <button type="button" className="btn btn--sm" onClick={() => void resendLink()}>{t.shell.verifyBanner.resend}</button>}
                {resend === "sent" && <b>{t.shell.verifyBanner.sent}</b>}
                {resend === "failed" && <b>{t.shell.verifyBanner.failed}</b>}
              </div>
            </div>
          )}
          {me.permissions.contactUs && (
            <div className="banner banner--warning" role="status">
              <Icon name="info" size={20} />
              <div>{t.shell.contactUsBanner} <Link href={`/${lang}/contact`}>{t.shell.supportLink}</Link></div>
            </div>
          )}
          {children}
        </div>
      </main>

      <footer className="pfoot">
        <div className="wrap">
          <span>{t.shell.support} {t.shell.supportText} <Link href={`/${lang}/contact`}>{t.shell.supportLink}</Link></span>
          <span className="ltr">© 2026 Flux Business Hub</span>
        </div>
      </footer>
    </div>
  );
}
