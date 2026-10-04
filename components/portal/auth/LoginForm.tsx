"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { refreshSession, safeNext, signIn } from "@/lib/portal/client";
import { AuthCard } from "./AuthCard";
import { FormAlert, PasswordField, TextField } from "./fields";
import { apiErrorText, type AuthFormProps } from "./types";

export function LoginForm({ lang, t, errors }: AuthFormProps) {
  const router = useRouter();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErr, setFieldErr] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const nextRef = useRef<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    nextRef.current = q.get("next");
    if (q.get("reset") === "1") setNotice(t.login.resetDone);
    else if (q.get("verified") === "1") setNotice(t.login.verifiedDone);
    let cancelled = false;
    // Already signed in: go straight to the destination.
    refreshSession().then((s) => {
      if (s && !cancelled) router.replace(safeNext(nextRef.current, lang));
    });
    return () => { cancelled = true; };
  }, [lang, router, t.login.resetDone, t.login.verifiedDone]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const fe: { email?: string; password?: string } = {};
    if (!email.trim()) fe.email = t.fieldErrors.loginEmail;
    if (!password) fe.password = t.fieldErrors.loginPassword;
    setFieldErr(fe);
    setFailure(null);
    if (fe.email) return emailRef.current?.focus();
    if (fe.password) return passRef.current?.focus();
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.push(safeNext(nextRef.current, lang));
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
      setFailure(code === "verification_required" ? t.login.verificationRequired : apiErrorText(errors, err));
      setBusy(false);
      requestAnimationFrame(() => alertRef.current?.focus());
    }
  }

  return (
    <AuthCard
      title={t.login.title}
      lead={t.login.lead}
      links={<>
        <Link href={`/${lang}/forgot-password`}>{t.login.forgot}</Link>
        <span>{t.login.noAccount} <Link href={`/${lang}/register`}>{t.login.create}</Link></span>
      </>}
    >
      {notice && <div className="banner banner--success" role="status"><div>{notice}</div></div>}
      <form className="stack" onSubmit={submit} noValidate aria-busy={busy}>
        <FormAlert message={failure} alertRef={alertRef} />
        <TextField id={`${uid}-email`} inputRef={emailRef} label={t.login.email} type="email" ltr autoComplete="username" inputMode="email"
          value={email} onChange={setEmail} error={fieldErr.email} />
        <PasswordField id={`${uid}-password`} inputRef={passRef} label={t.login.password} autoComplete="current-password" text={t.password}
          value={password} onChange={setPassword} error={fieldErr.password} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t.login.submitting : t.login.submit}</button>
      </form>
    </AuthCard>
  );
}
