"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { fmt } from "@/lib/format";
import { ApiFailure, api } from "@/lib/portal/client";
import { formatDay } from "@/lib/portal/format";
import type { DocumentDto, Lang } from "@/lib/portal/types";
import { usePortal } from "../PortalProvider";
import { ConfirmDialog, EmptyState, ErrorState, Loading, PageHeader, errorMessage, fieldMessage, useApi } from "../ui";
import "./profile.css";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png"];

function focusFirstInvalid(form: HTMLElement | null) {
  requestAnimationFrame(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

/** Shared message line: success is announced politely, errors assertively. */
function Notice({ ok, error }: { ok?: string | null; error?: string | null }) {
  return (
    <>
      <p className="pf-ok" role="status">{ok ? <span className="badge badge--success">{ok}</span> : null}</p>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}

/* ------------------------------------------------------------------ 1. contact */

function ContactCard() {
  const { t, me, refreshMe } = usePortal();
  const p = t.profile.contact;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(me.customer.name);
  const [companyName, setCompanyName] = useState(me.customer.companyName ?? "");
  const [mobile, setMobile] = useState(me.user.mobile);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMsg, setResendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const isCompany = me.customer.type === "company";
  const status = me.customer.status;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setOk(null);
    setError(null);
    setFields({});
    try {
      await api("/api/v1/customer/me", { method: "PATCH", json: { name, mobile, ...(isCompany ? { companyName } : {}) } });
      await refreshMe().catch(() => undefined);
      setOk(p.saved);
    } catch (err) {
      if (err instanceof ApiFailure && err.fields) {
        setFields(err.fields);
        focusFirstInvalid(formRef.current);
      }
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendBusy) return;
    setResendBusy(true);
    setResendMsg(null);
    try {
      await api("/api/v1/customer/auth/resend-verification", { method: "POST" });
      setResendMsg({ ok: true, text: p.resendDone });
    } catch (err) {
      setResendMsg({ ok: false, text: errorMessage(t, err) });
    } finally {
      setResendBusy(false);
    }
  }

  const fieldProps = (key: string) => ({
    "aria-invalid": fields[key] ? true : undefined,
    "aria-describedby": [fields[key] ? `${id}-${key}-e` : null, `${id}-${key}-h`].filter(Boolean).join(" "),
  });

  return (
    <section className="pcard pf-section" aria-labelledby={`${id}-h`}>
      <div className="pcard__head"><h2 id={`${id}-h`}>{p.title}</h2></div>
      <form ref={formRef} className="pcard__body" onSubmit={submit} noValidate>
        <p className="muted pf-help">{p.help}</p>
        <div className="form-grid">
          <div className={`field wide${fields.name ? " field--error" : ""}`}>
            <label className="label" htmlFor={`${id}-name`}>{p.name}</label>
            <input id={`${id}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required {...fieldProps("name")} />
            <span id={`${id}-name-h`} className="sr-only" />
            {fields.name && <span id={`${id}-name-e`} className="error">{fieldMessage(t, fields.name)}</span>}
          </div>
          {isCompany && (
            <div className={`field wide${fields.companyName ? " field--error" : ""}`}>
              <label className="label" htmlFor={`${id}-companyName`}>{p.companyName}</label>
              <input id={`${id}-companyName`} className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization" maxLength={160} required {...fieldProps("companyName")} />
              <span id={`${id}-companyName-h`} className="sr-only" />
              {fields.companyName && <span id={`${id}-companyName-e`} className="error">{fieldMessage(t, fields.companyName)}</span>}
            </div>
          )}
          <div className="field wide">
            <span className="label" id={`${id}-email-l`}>{p.email}</span>
            <div className="pf-readonly" aria-labelledby={`${id}-email-l`} role="group">
              <span className="ltr">{me.user.email}</span>
              <span className={`badge ${me.user.emailVerified ? "badge--success" : "badge--warning"}`}>{me.user.emailVerified ? p.verified : p.notVerified}</span>
              {!me.user.emailVerified && (
                <button type="button" className="btn btn--sm" onClick={resend} disabled={resendBusy}>{resendBusy ? p.resendBusy : p.resend}</button>
              )}
            </div>
            <span className="help">{p.emailHelp}</span>
            <span role="status" className={resendMsg && !resendMsg.ok ? "error" : "help"}>{resendMsg?.text}</span>
          </div>
          <div className={`field wide${fields.mobile ? " field--error" : ""}`}>
            <label className="label" htmlFor={`${id}-mobile`}>{p.mobile}</label>
            <input id={`${id}-mobile`} className="input ltr" type="tel" inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required {...fieldProps("mobile")} />
            <span id={`${id}-mobile-h`} className="help">{p.mobileHelp}</span>
            {fields.mobile && <span id={`${id}-mobile-e`} className="error">{fieldMessage(t, fields.mobile)}</span>}
          </div>
          <div className="field">
            <span className="label">{p.accountType}</span>
            <span>{isCompany ? p.company : p.individual}</span>
          </div>
          {status && (
            <div className="field">
              <span className="label">{p.accountStatus}</span>
              <span><span className="badge">{p.status[status]}</span></span>
            </div>
          )}
        </div>
        <div className="pf-actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? p.saving : p.save}</button>
        </div>
        <Notice ok={ok} error={error} />
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ 2. language */

function LanguageCard() {
  const { t, me, lang, refreshMe } = usePortal();
  const p = t.profile.language;
  const id = useId();
  const [value, setValue] = useState<Lang>(me.user.preferredLanguage);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const other = lang === "ar" ? "en" : "ar";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      await api("/api/v1/customer/me", { method: "PATCH", json: { preferredLanguage: value } });
      await refreshMe().catch(() => undefined);
      setOk(p.saved);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pcard pf-section" aria-labelledby={`${id}-h`}>
      <div className="pcard__head"><h2 id={`${id}-h`}>{p.title}</h2></div>
      <form className="pcard__body" onSubmit={submit}>
        <p className="muted pf-help">{p.help}</p>
        <div className="field">
          <label className="label" htmlFor={`${id}-lang`}>{p.label}</label>
          <select id={`${id}-lang`} className="select" value={value} onChange={(e) => setValue(e.target.value as Lang)}>
            <option value="ar">{p.ar}</option>
            <option value="en">{p.en}</option>
          </select>
        </div>
        <div className="pf-actions">
          <button type="submit" className="btn btn--dark" disabled={busy}>{p.save}</button>
          <Link className="btn btn--ghost" href={`/${other}/portal/profile`} hrefLang={other} lang={other}>
            {fmt(p.switchTo, { language: p.switchName })}
          </Link>
        </div>
        <Notice ok={ok} error={error} />
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ 3. password */

function PasswordField({ id, label, value, onChange, autoComplete, invalid, describedBy, error }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string; error?: string;
}) {
  const { t } = usePortal();
  const [shown, setShown] = useState(false);
  return (
    <div className={`field${invalid ? " field--error" : ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="pf-pw">
        <input id={id} className="input ltr" type={shown ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete} aria-invalid={invalid ? true : undefined} aria-describedby={describedBy} required />
        <button type="button" className="btn" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={`${shown ? t.profile.password.hide : t.profile.password.show}: ${label}`}>
          {shown ? t.profile.password.hide : t.profile.password.show}
        </button>
      </div>
      {error && <span id={`${id}-e`} className="error">{error}</span>}
    </div>
  );
}

function PasswordCard() {
  const { t } = usePortal();
  const p = t.profile.password;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errs, setErrs] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const weak = !(next.length >= 8 && /[A-Za-z]/.test(next) && /\d/.test(next));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setOk(null);
    setError(null);
    const local: typeof errs = {};
    if (!current) local.current = t.common.fieldErrors.required;
    if (weak) local.next = t.common.fieldErrors.weak;
    else if (confirm !== next) local.confirm = p.mismatch;
    setErrs(local);
    if (Object.keys(local).length) {
      focusFirstInvalid(formRef.current);
      return;
    }
    setBusy(true);
    try {
      await api("/api/v1/customer/auth/change-password", { json: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      setOk(p.saved);
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "invalid_credentials") {
        setErrs({ current: p.currentWrong });
        focusFirstInvalid(formRef.current);
      } else if (err instanceof ApiFailure && err.code === "validation") {
        setErrs({ next: t.common.fieldErrors.weak });
        focusFirstInvalid(formRef.current);
      } else setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pcard pf-section" aria-labelledby={`${id}-h`}>
      <div className="pcard__head"><h2 id={`${id}-h`}>{p.title}</h2></div>
      <form ref={formRef} className="pcard__body" onSubmit={submit} noValidate>
        <p className="muted pf-help">{p.help}</p>
        <PasswordField id={`${id}-cur`} label={p.current} value={current} onChange={setCurrent} autoComplete="current-password"
          invalid={!!errs.current} describedBy={errs.current ? `${id}-cur-e` : undefined} error={errs.current} />
        <p id={`${id}-rule`} className="help pf-help">{p.rule}</p>
        <PasswordField id={`${id}-new`} label={p.next} value={next} onChange={setNext} autoComplete="new-password"
          invalid={!!errs.next} describedBy={[`${id}-rule`, errs.next ? `${id}-new-e` : null].filter(Boolean).join(" ")} error={errs.next} />
        <PasswordField id={`${id}-conf`} label={p.confirm} value={confirm} onChange={setConfirm} autoComplete="new-password"
          invalid={!!errs.confirm} describedBy={errs.confirm ? `${id}-conf-e` : undefined} error={errs.confirm} />
        <div className="pf-actions">
          <button type="submit" className="btn btn--dark" disabled={busy}>{busy ? p.saving : p.save}</button>
        </div>
        <Notice ok={ok} error={error} />
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ 4. documents */

function sizeLabel(t: ReturnType<typeof usePortal>["t"], bytes: number): string {
  const p = t.profile.documents;
  if (bytes >= 1024 * 1024) return fmt(p.mb, { n: (bytes / 1024 / 1024).toFixed(1) });
  return fmt(p.kb, { n: Math.max(1, Math.round(bytes / 1024)) });
}

function DocumentsCard() {
  const { t, me, lang } = usePortal();
  const p = t.profile.documents;
  const id = useId();
  const docs = useApi<DocumentDto[]>("/api/v1/customer/documents");
  const fileRef = useRef<HTMLInputElement>(null);
  const [purpose, setPurpose] = useState<DocumentDto["purpose"]>("identity");
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [removing, setRemoving] = useState<DocumentDto | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const list = docs.data ?? [];
  const canUpload = me.customer.hasPendingRequest || list.length > 0;
  const privacyHref = `/${lang}/legal/privacy`;
  const [pre, post] = p.privacy.split("{link}");

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) return;
    setOk(null);
    setError(null);
    const file = fileRef.current?.files?.[0];
    let problem: string | null = null;
    if (!file) problem = p.noFile;
    else if (file.size === 0) problem = t.common.errors.empty_file;
    else if (file.size > MAX_BYTES) problem = t.common.errors.file_too_large;
    else if (!TYPES.includes(file.type)) problem = t.common.errors.unsupported_type;
    setFileError(problem);
    if (problem || !file) {
      fileRef.current?.focus();
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("purpose", purpose);
      await api("/api/v1/customer/documents", { method: "POST", body });
      if (fileRef.current) fileRef.current.value = "";
      setOk(p.uploaded);
      docs.reload();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setUploading(false);
    }
  }

  async function view(doc: DocumentDto) {
    if (viewing) return;
    setViewing(doc.id);
    setError(null);
    setFallback(null);
    // Open the tab synchronously so the browser does not treat it as a blocked popup.
    const w = window.open("about:blank", "_blank");
    if (w) w.opener = null;
    try {
      const { url } = await api<{ url: string }>(`/api/v1/customer/documents/${encodeURIComponent(doc.id)}/link`);
      if (!url.startsWith("/api/v1/customer/documents/")) throw new ApiFailure(0, "generic");
      if (w) w.location.href = url;
      else setFallback(url);
    } catch (err) {
      w?.close();
      setError(errorMessage(t, err));
    } finally {
      setViewing(null);
    }
  }

  async function confirmRemove() {
    if (!removing || removeBusy) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await api(`/api/v1/customer/documents/${encodeURIComponent(removing.id)}`, { method: "DELETE" });
      setRemoving(null);
      setOk(p.removed);
      docs.reload();
    } catch (err) {
      setRemoveError(errorMessage(t, err));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <section className="pcard pf-section" aria-labelledby={`${id}-h`}>
      <div className="pcard__head"><h2 id={`${id}-h`}>{p.title}</h2></div>
      {docs.loading && !docs.data ? <Loading /> : docs.error && !docs.data ? <ErrorState error={docs.error} onRetry={docs.reload} /> : (
        <>
          <div className="pcard__body">
            <p className="muted pf-help">{p.help}</p>
            <p className="help pf-help">{pre}<Link href={privacyHref}>{p.privacyLink}</Link>{post}</p>
          </div>
          {list.length > 0 ? (
            <ul className="plist">
              {list.map((d) => (
                <li key={d.id}>
                  <div className="grow">
                    <b className="pf-doc-name">{d.name}</b>
                    <small className="pf-doc-meta">
                      <span>{p.purpose[d.purpose]}</span>
                      <span className="ltr">{d.mime === "application/pdf" ? "PDF" : d.mime === "image/png" ? "PNG" : "JPG"}</span>
                      <span className="ltr">{sizeLabel(t, d.sizeBytes)}</span>
                      <span>{fmt(p.uploadedOn, { date: formatDay(lang, d.uploadedAt.slice(0, 10), "short") })}</span>
                    </small>
                  </div>
                  <div className="pf-actions">
                    <button type="button" className="btn btn--sm" onClick={() => view(d)} disabled={viewing !== null} aria-label={fmt(p.viewAria, { name: d.name })}>
                      {viewing === d.id ? p.viewBusy : p.view}
                    </button>
                    <button type="button" className="btn btn--sm" onClick={() => { setRemoveError(null); setRemoving(d); }} aria-label={fmt(p.removeAria, { name: d.name })}>{p.remove}</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : canUpload ? <EmptyState title={p.none} text={p.noneText} /> : null}
          <div className="pcard__body">
            {list.length > 0 && <p className="help pf-help">{p.linkNote}</p>}
            {fallback && <p><a href={fallback} target="_blank" rel="noopener noreferrer">{p.view}</a></p>}
            {canUpload ? (
              <form className="stack" onSubmit={upload} noValidate>
                <div className="form-grid">
                  <div className="field">
                    <label className="label" htmlFor={`${id}-purpose`}>{p.purposeLabel}</label>
                    <select id={`${id}-purpose`} className="select" value={purpose} onChange={(e) => setPurpose(e.target.value as DocumentDto["purpose"])}>
                      {(["identity", "commercial-registration", "other"] as const).map((k) => <option key={k} value={k}>{p.purpose[k]}</option>)}
                    </select>
                  </div>
                  <div className={`field${fileError ? " field--error" : ""}`}>
                    <label className="label" htmlFor={`${id}-file`}>{p.file}</label>
                    <input ref={fileRef} id={`${id}-file`} className="input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      aria-invalid={fileError ? true : undefined} aria-describedby={`${id}-file-h${fileError ? ` ${id}-file-e` : ""}`} />
                    <span id={`${id}-file-h`} className="help">{p.fileHelp}</span>
                    {fileError && <span id={`${id}-file-e`} className="error">{fileError}</span>}
                  </div>
                </div>
                <div className="pf-actions">
                  <button type="submit" className="btn btn--dark" disabled={uploading}>{uploading ? p.uploading : p.upload}</button>
                </div>
              </form>
            ) : list.length === 0 && (
              <>
                <p>{p.notRequested}</p>
                <div className="pf-actions"><Link className="btn" href={`/${lang}/portal/book?mode=request`}>{p.goRequest}</Link></div>
              </>
            )}
            <Notice ok={ok} error={error} />
          </div>
        </>
      )}
      <ConfirmDialog
        open={removing !== null} title={p.removeTitle} text={removing ? fmt(p.removeText, { name: removing.name }) : ""}
        confirmLabel={p.removeConfirm} cancelLabel={t.common.cancel} busy={removeBusy} danger error={removeError}
        onConfirm={confirmRemove} onClose={() => { if (!removeBusy) setRemoving(null); }}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ 5. account actions */

function ActionsCard() {
  const { t, signOut } = usePortal();
  const p = t.profile.actions;
  const id = useId();
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return (
    <section className="pcard pf-section" aria-labelledby={`${id}-h`}>
      <div className="pcard__head"><h2 id={`${id}-h`}>{p.title}</h2></div>
      <div className="pcard__body">
        <p className="muted pf-help">{p.help}</p>
        <div className="pf-actions">
          <button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); try { await signOut(); } finally { if (mounted.current) setBusy(false); } }}>{p.signOut}</button>
        </div>
      </div>
    </section>
  );
}

export function Profile() {
  const { t } = usePortal();
  return (
    <div className="pf">
      <PageHeader title={t.profile.title} subtitle={t.profile.subtitle} />
      <ContactCard />
      <LanguageCard />
      <PasswordCard />
      <DocumentsCard />
      <ActionsCard />
    </div>
  );
}
