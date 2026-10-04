import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerifyEmail } from "@/components/portal/auth/VerifyEmail";
import { authMetadata } from "@/components/portal/auth/meta";
import { isLocale } from "@/lib/i18n";
import { getPortalMessages } from "@/lib/portal/messages";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return authMetadata(lang, "verify", "/verify");
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const m = getPortalMessages(lang);
  return <VerifyEmail lang={lang} t={m.auth} errors={m.common.errors} />;
}
