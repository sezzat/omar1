"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** "Sign in" for visitors, "My account" when the (non-secret) session hint cookie is present. */
export function AuthLink({ href, signIn, account, className }: { href: string; signIn: string; account: string; className?: string }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    setSignedIn(document.cookie.split(";").some((c) => c.trim().startsWith("flux_session=")));
  }, []);
  return (
    <Link className={className} href={signedIn ? href.replace(/\/account$/, "/portal") : href}>
      {signedIn ? account : signIn}
    </Link>
  );
}
