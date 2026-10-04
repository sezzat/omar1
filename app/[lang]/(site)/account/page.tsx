import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Entry point for "Sign in" and for the Book / Request buttons on public pages.
 * Booking intents (space, mode, date, start, hours, term, startDate) are forwarded to the portal's Book screen,
 * which sends signed-out visitors to the sign-in page and returns them afterwards.
 */
export default async function AccountEntry({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const q = await searchParams;
  const keep = ["space", "mode", "date", "start", "hours", "term", "startDate"];
  const out = new URLSearchParams();
  for (const k of keep) {
    const v = q[k];
    if (typeof v === "string" && v.length < 60) out.set(k, v);
  }
  redirect(out.get("space") ? `/${lang}/portal/book?${out.toString()}` : `/${lang}/portal`);
}
