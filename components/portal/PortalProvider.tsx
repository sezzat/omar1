"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, refreshSession, signOut as clientSignOut } from "@/lib/portal/client";
import type { PortalMessages } from "@/lib/portal/messages";
import type { MeDto } from "@/lib/portal/types";
import type { Loc } from "@/lib/format";

interface PortalContext {
  lang: Loc;
  t: PortalMessages;
  me: MeDto;
  /** Re-reads the profile, for example after a status change or a profile edit. */
  refreshMe: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<PortalContext | null>(null);

export function usePortal(): PortalContext {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePortal must be used inside the portal layout");
  return v;
}

/**
 * Restores the session from the refresh cookie, then renders the portal. Without a session the visitor goes to sign in
 * and comes back to the page they asked for.
 */
export function PortalProvider({ lang, messages, children }: { lang: Loc; messages: PortalMessages; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    refreshSession().then((session) => {
      if (cancelled) return;
      if (session) setMe(session.me);
      else router.replace(`/${lang}/login?next=${encodeURIComponent(pathname + window.location.search)}`);
    });
    return () => {
      cancelled = true;
    };
    // Runs once per portal visit; navigation inside the portal keeps this layout mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMe = useCallback(async () => {
    setMe(await api<MeDto>("/api/v1/customer/me"));
  }, []);

  const signOut = useCallback(async () => {
    await clientSignOut();
    router.replace(`/${lang}/login`);
  }, [lang, router]);

  const value = useMemo(() => (me ? { lang, t: messages, me, refreshMe, signOut } : null), [lang, messages, me, refreshMe, signOut]);

  if (!value) {
    return (
      <div className="loading" role="status" style={{ minHeight: "60vh", justifyContent: "center" }}>
        <span className="spinner" aria-hidden="true" />
        {messages.shell.restoring}
      </div>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
