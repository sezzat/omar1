import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Checkout } from "@/components/portal/checkout/Checkout";
import { isLocale } from "@/lib/i18n";
import { getPortalMessages } from "@/lib/portal/messages";

export const metadata: Metadata = { title: "Test payment page", robots: { index: false, follow: false } };

/** Stand-in for the payment provider's hosted checkout. No portal or site chrome. */
export default async function CheckoutPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  if (!isLocale(lang)) notFound();
  return <Checkout lang={lang} sessionId={id} messages={getPortalMessages(lang).checkout} />;
}
