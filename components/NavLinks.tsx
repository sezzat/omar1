"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export interface NavItem {
  href: string; // path after the locale, "" for home
  label: string;
}

export function NavLinks({ locale, items }: { locale: Locale; items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const full = `/${locale}${item.href}`;
        const current = item.href === "" ? pathname === full : pathname === full || pathname.startsWith(`${full}/`);
        return (
          <Link key={item.href} href={full} aria-current={current ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
