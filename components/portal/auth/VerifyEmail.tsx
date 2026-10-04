"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, api } from "@/lib/portal/client";
import { AuthCard } from "./AuthCard";
import { apiErrorText, type AuthFormProps } from "./types";

type Phase = "loading" | "success" | "invalid" | "error";

export function VerifyEmail({ lang, t, errors }: AuthFormProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("");
  const started = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const run = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return setPhase("invalid");
    setPhase("loading");
    try {
      await api("/api/v1/customer/auth/verify-email", { json: { token } });
      setPhase("success");
    } catch (e) {
      if (e instanceof ApiFailure && (e.code === "invalid_token" || e.status === 400)) setPhase("invalid");
      else {
        setMessage(apiErrorText(errors, e));
        setPhase("error");
      }
    }
  }, [errors]);

  useEffect(() => {
    // The token is single use, so guard against the strict-mode double effect.
    if (started.current) return;
    started.current = true;
    tokenRef.current = new URLSearchParams(window.location.search).get("token");
    void run();
  }, [run]);

  useEffect(() => { if (phase !== "loading") headingRef.current?.focus(); }, [phase]);

  const title = { loading: t.verify.loadingTitle, success: t.verify.successTitle, invalid: t.verify.invalidTitle, error: t.verify.errorTitle }[phase];

  return (
    <AuthCard title={title} headingRef={headingRef}>
      <div role="status" aria-live="polite">
        {phase === "loading" && <div className="loading"><span className="spinner" aria-hidden="true" />{t.verify.loadingText}</div>}
        {phase === "success" && <p>{t.verify.successText}</p>}
        {phase === "invalid" && <div className="banner banner--warning"><div>{t.verify.invalidText}</div></div>}
        {phase === "error" && <div className="banner banner--warning"><div>{message}</div></div>}
      </div>
      {phase === "success" && <Link href={`/${lang}/portal`} className="btn btn--primary btn--block">{t.verify.continue}</Link>}
      {phase === "invalid" && <Link href={`/${lang}/login`} className="btn btn--block">{t.verify.signIn}</Link>}
      {phase === "error" && <button type="button" className="btn btn--block" onClick={() => void run()}>{t.verify.retry}</button>}
    </AuthCard>
  );
}
