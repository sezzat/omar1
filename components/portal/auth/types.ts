import type { Locale } from "@/lib/i18n";
import type { PortalMessages } from "@/lib/portal/messages";

/** Props every auth form receives from its server page (these pages have no PortalProvider). */
export interface AuthFormProps {
  lang: Locale;
  t: PortalMessages["auth"];
  /** common.errors, keyed by API error code. */
  errors: Record<string, string>;
}

export function apiErrorText(errors: Record<string, string>, e: unknown): string {
  const code = typeof e === "object" && e && "code" in e ? String((e as { code: unknown }).code) : "";
  const status = typeof e === "object" && e && "status" in e ? Number((e as { status: unknown }).status) : -1;
  return errors[code] ?? (status === 0 ? errors.network : errors.generic);
}
