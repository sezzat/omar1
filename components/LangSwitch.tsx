"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { otherLocale, type Locale } from "@/lib/i18n";

/** Keeps the visitor on the same page in the other language. */
export function LangSwitch({ locale, name, label }: { locale: Locale; name: string; label: string }) {
  const pathname = usePathname();
  const target = otherLocale(locale);
  const href = pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${target}`) || `/${target}`;
  return (
    <Link className="lang-switch" href={href} lang={target} hrefLang={target} aria-label={label}>
      <Icon name="globe" size={16} />
      {name}
    </Link>
  );
}
