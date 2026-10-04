import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalProvider } from "@/components/portal/PortalProvider";
import { PortalShell } from "@/components/portal/PortalShell";
import { isLocale } from "@/lib/i18n";
import { getPortalMessages } from "@/lib/portal/messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Signed-in area: client-rendered behind sign in, with its own light top navigation (the public header does not appear here). */
export default async function PortalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <PortalProvider lang={lang} messages={getPortalMessages(lang)}>
      <PortalShell>{children}</PortalShell>
    </PortalProvider>
  );
}
