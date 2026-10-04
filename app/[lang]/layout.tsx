import type { Metadata } from "next";
import { Cairo, Poppins } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { dirOf, getMessages, isLocale, locales } from "@/lib/i18n";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-poppins", display: "swap" });
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-cairo", display: "swap" });

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = { metadataBase: new URL(siteUrl) };

/** Returning sessions skip the home intro; set before first paint so there is no flash. */
const introGate = `try{if(sessionStorage.getItem("flux-intro"))document.documentElement.dataset.intro="skip"}catch(e){}`;

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getMessages(lang);

  return (
    <html lang={lang} dir={dirOf(lang)} className={`${poppins.variable} ${cairo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introGate }} />
      </head>
      <body>
        <a className="skip-link" href="#main">{t.nav.skipToContent}</a>
        <SiteHeader locale={lang} t={t} />
        <main id="main">{children}</main>
        <SiteFooter locale={lang} t={t} />
      </body>
    </html>
  );
}
