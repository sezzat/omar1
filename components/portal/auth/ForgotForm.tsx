"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/portal/client";
import { AuthCard } from "./AuthCard";
import { DevOutbox } from "./DevOutbox";
import { FormAlert, TextField, emailRe } from "./fields";
import { apiErrorText, type AuthFormProps } from "./types";

export function ForgotForm({ lang, t, errors }: AuthFormProps) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [fieldErr, setFieldErr] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (sentTo) headingRef.current?.focus(); }, [sentTo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    if (!emailRe.test(email.trim())) {
      setFieldErr(t.fieldErrors.email);
      return emailRef.current?.focus();
    }
    setFieldErr(undefined);
    setBusy(true);
    try {
      await api("/api/v1/customer/auth/forgot-password", { json: { email: email.trim() } });
      setSentTo(email.trim());
    } catch (err) {
      setFailure(apiErrorText(errors, err));
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  const signInLink = <Link href={`/${lang}/login`}>{t.forgot.back}</Link>;

  if (sentTo) {
    return (
      <AuthCard title={t.forgot.doneTitle} headingRef={headingRef} links={<>{signInLink}</>}>
        <div role="status" className="banner banner--success"><div>{t.forgot.doneText}</div></div>
        <DevOutbox email={sentTo} template="reset-password" title={t.dev.resetTitle} text={t.dev.text} open={t.dev.open} />
        <div><button type="button" className="btn btn--ghost" onClick={() => setSentTo(null)}>{t.forgot.another}</button></div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.forgot.title} lead={t.forgot.lead} links={signInLink}>
      <form className="stack" onSubmit={submit} noValidate aria-busy={busy}>
        <FormAlert message={failure} alertRef={alertRef} />
        <TextField id={`${uid}-email`} inputRef={emailRef} label={t.forgot.email} type="email" ltr autoComplete="email" inputMode="email"
          value={email} onChange={setEmail} error={fieldErr} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t.forgot.submitting : t.forgot.submit}</button>
      </form>
    </AuthCard>
  );
}
