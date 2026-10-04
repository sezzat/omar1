"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiFailure, api } from "@/lib/portal/client";
import { AuthCard } from "./AuthCard";
import { FormAlert, PasswordField, passwordOk } from "./fields";
import { apiErrorText, type AuthFormProps } from "./types";

export function ResetForm({ lang, t, errors }: AuthFormProps) {
  const router = useRouter();
  const uid = useId();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErr, setFieldErr] = useState<{ password?: string; confirm?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token")); }, []);
  const bad = invalid || token === null;
  useEffect(() => { if (bad) headingRef.current?.focus(); }, [bad]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !token) return;
    const fe: { password?: string; confirm?: string } = {};
    if (!passwordOk(password)) fe.password = t.fieldErrors.password;
    else if (confirm !== password) fe.confirm = t.fieldErrors.confirm;
    setFieldErr(fe);
    setFailure(null);
    if (fe.password) return passRef.current?.focus();
    if (fe.confirm) return confirmRef.current?.focus();
    setBusy(true);
    try {
      await api("/api/v1/customer/auth/reset-password", { json: { token, password } });
      router.push(`/${lang}/login?reset=1`);
    } catch (err) {
      if (err instanceof ApiFailure && err.status === 422 && err.fields?.password) {
        setFieldErr({ password: t.fieldErrors.password });
        passRef.current?.focus();
      } else if (err instanceof ApiFailure && err.code === "invalid_token") {
        setInvalid(true);
      } else {
        setFailure(apiErrorText(errors, err));
        requestAnimationFrame(() => alertRef.current?.focus());
      }
      setBusy(false);
    }
  }

  if (token === undefined) return <AuthCard title={t.reset.title}><div className="loading" role="status"><span className="spinner" aria-hidden="true" />{t.verify.loadingText}</div></AuthCard>;

  if (bad) {
    return (
      <AuthCard title={t.reset.invalidTitle} headingRef={headingRef}>
        <div role="status" className="banner banner--warning"><div>{t.reset.invalidText}</div></div>
        <Link href={`/${lang}/forgot-password`} className="btn btn--primary btn--block">{t.reset.requestNew}</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t.reset.title} lead={t.reset.lead}>
      <form className="stack" onSubmit={submit} noValidate aria-busy={busy}>
        <FormAlert message={failure} alertRef={alertRef} />
        <PasswordField id={`${uid}-password`} inputRef={passRef} label={t.reset.password} help={t.password.rule} autoComplete="new-password" text={t.password}
          value={password} onChange={setPassword} error={fieldErr.password} />
        <PasswordField id={`${uid}-confirm`} inputRef={confirmRef} label={t.reset.confirm} autoComplete="new-password" text={t.password}
          value={confirm} onChange={setConfirm} error={fieldErr.confirm} />
        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t.reset.submitting : t.reset.submit}</button>
      </form>
    </AuthCard>
  );
}
