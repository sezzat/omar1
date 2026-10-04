"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ApiFailure, api } from "@/lib/portal/client";
import { AuthCard } from "./AuthCard";
import { DevOutbox } from "./DevOutbox";
import { FormAlert, PasswordField, TextField, emailRe, mobileOk, passwordOk } from "./fields";
import { apiErrorText, type AuthFormProps } from "./types";

type Field = "type" | "name" | "companyName" | "email" | "mobile" | "password" | "consent";
const ORDER: Field[] = ["type", "name", "companyName", "email", "mobile", "password", "consent"];

export function RegisterForm({ lang, t, errors }: AuthFormProps) {
  const uid = useId();
  const [type, setType] = useState<"individual" | "company">("individual");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<"ar" | "en">(lang);
  const [fieldErr, setFieldErr] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});
  const alertRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const setRef = (f: Field) => (el: HTMLElement | null) => { refs.current[f] = el; };

  useEffect(() => { if (sentTo) headingRef.current?.focus(); }, [sentTo]);

  function focusFirst(errs: Partial<Record<Field, string>>) {
    const first = ORDER.find((f) => errs[f]);
    if (first) refs.current[first]?.focus();
  }

  function validate(): Partial<Record<Field, string>> {
    const fe: Partial<Record<Field, string>> = {};
    const fx = t.fieldErrors;
    if (name.trim().length < 2 || name.trim().length > 120) fe.name = fx.name;
    if (type === "company" && (companyName.trim().length < 2 || companyName.trim().length > 160)) fe.companyName = fx.companyName;
    if (!emailRe.test(email.trim()) || email.trim().length > 200) fe.email = fx.email;
    if (!mobileOk(mobile)) fe.mobile = fx.mobile;
    if (!passwordOk(password)) fe.password = fx.password;
    if (!consent) fe.consent = fx.consent;
    return fe;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setFailure(null);
    const fe = validate();
    setFieldErr(fe);
    if (Object.keys(fe).length) return focusFirst(fe);
    setBusy(true);
    try {
      await api("/api/v1/customer/auth/register", {
        json: { type, name: name.trim(), companyName: type === "company" ? companyName.trim() : undefined, email: email.trim(), mobile: mobile.trim(), password, language, consent },
      });
      setSentTo(email.trim());
    } catch (err) {
      if (err instanceof ApiFailure && err.status === 422 && err.fields) {
        const mapped: Partial<Record<Field, string>> = {};
        for (const k of Object.keys(err.fields)) {
          if ((ORDER as string[]).includes(k)) mapped[k as Field] = (t.fieldErrors as Record<string, string>)[k] ?? errors.validation;
        }
        if (Object.keys(mapped).length) {
          setFieldErr(mapped);
          setFailure(errors.validation);
          focusFirst(mapped);
        } else {
          setFailure(errors.validation);
          requestAnimationFrame(() => alertRef.current?.focus());
        }
      } else {
        setFailure(apiErrorText(errors, err));
        requestAnimationFrame(() => alertRef.current?.focus());
      }
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title={t.register.doneTitle} headingRef={headingRef} links={<Link href={`/${lang}/login`}>{t.register.toSignIn}</Link>}>
        <div role="status" className="banner banner--success"><div>{t.register.doneText}</div></div>
        <p>{t.register.doneNext}</p>
        <DevOutbox email={sentTo} template="verify-email" title={t.dev.title} text={t.dev.text} open={t.dev.open} />
      </AuthCard>
    );
  }

  const id = (s: string) => `${uid}-${s}`;
  const consentErr = fieldErr.consent;

  return (
    <AuthCard
      title={t.register.title}
      lead={t.register.lead}
      links={<span>{t.register.haveAccount} <Link href={`/${lang}/login`}>{t.register.signIn}</Link></span>}
    >
      <form className="stack" onSubmit={submit} noValidate aria-busy={busy}>
        <FormAlert message={failure} alertRef={alertRef} />

        <fieldset className="auth__choices field">
          <legend className="label">{t.register.type}</legend>
          <div className="auth__choicerow">
            {(["individual", "company"] as const).map((v, i) => (
              <label key={v} className="auth__choice">
                <input type="radio" name={id("type")} value={v} checked={type === v} ref={i === 0 ? setRef("type") : undefined} onChange={() => setType(v)} />
                {t.register[v]}
              </label>
            ))}
          </div>
        </fieldset>

        <TextField id={id("name")} inputRef={setRef("name")} label={t.register.name} autoComplete="name" value={name} onChange={setName} error={fieldErr.name} maxLength={120} />
        {type === "company" && (
          <TextField id={id("company")} inputRef={setRef("companyName")} label={t.register.companyName} autoComplete="organization" value={companyName} onChange={setCompanyName} error={fieldErr.companyName} maxLength={160} />
        )}
        <TextField id={id("email")} inputRef={setRef("email")} label={t.register.email} help={t.register.emailHelp} type="email" ltr autoComplete="email" inputMode="email" value={email} onChange={setEmail} error={fieldErr.email} maxLength={200} />
        <TextField id={id("mobile")} inputRef={setRef("mobile")} label={t.register.mobile} help={t.register.mobileHelp} type="tel" ltr autoComplete="tel" inputMode="tel" value={mobile} onChange={setMobile} error={fieldErr.mobile} maxLength={20} />
        <PasswordField id={id("password")} inputRef={setRef("password")} label={t.register.password} help={t.password.rule} autoComplete="new-password" text={t.password} value={password} onChange={setPassword} error={fieldErr.password} />

        <div className="field">
          <label className="label" htmlFor={id("lang")}>{t.register.language}</label>
          <select id={id("lang")} className="select" value={language} onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "ar")}>
            <option value="ar">{t.register.arabic}</option>
            <option value="en">{t.register.english}</option>
          </select>
        </div>

        <div className={`auth__consent field${consentErr ? " field--error" : ""}`}>
          <label className="check" htmlFor={id("consent")}>
            <input
              id={id("consent")} type="checkbox" checked={consent} ref={setRef("consent")} onChange={(e) => setConsent(e.target.checked)}
              aria-required="true" aria-invalid={consentErr ? true : undefined} aria-describedby={`${id("consent-help")}${consentErr ? ` ${id("consent-err")}` : ""}`}
            />
            <span>
              {t.register.consent}{" "}
              <a href={`/${lang}/legal/privacy`} target="_blank" rel="noopener">
                {t.register.consentLink}<span className="sr-only"> {t.register.consentNewTab}</span>
              </a>.
            </span>
          </label>
          <p className="help" id={id("consent-help")}>{t.register.consentDocs}</p>
          {consentErr && <p className="error" id={id("consent-err")}>{consentErr}</p>}
        </div>

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>{busy ? t.register.submitting : t.register.submit}</button>
      </form>
    </AuthCard>
  );
}
