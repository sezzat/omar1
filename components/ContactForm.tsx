"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "./Icon";

export interface ContactText {
  name: string; emailField: string; message: string; send: string; sending: string; sent: string; sentText: string;
  another: string; errName: string; errEmail: string; errMessage: string; errRate: string; errGeneral: string;
  aboutPrefill: string;
}

type Errors = Partial<Record<"name" | "email" | "message", string>>;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactForm({ t }: { t: ContactText }) {
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  // A link such as /contact?about=Hot%20desk,%2010%20days pre-fills the message.
  useEffect(() => {
    const about = new URLSearchParams(window.location.search).get("about");
    if (about) setMessage(t.aboutPrefill.replace("{name}", about.slice(0, 120)));
  }, [t.aboutPrefill]);

  function validate(): Errors {
    const e: Errors = {};
    if (name.trim().length < 2) e.name = t.errName;
    if (!emailRe.test(email.trim())) e.email = t.errEmail;
    if (message.trim().length < 5) e.message = t.errMessage;
    return e;
  }

  async function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setFailure(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;
    setPhase("sending");
    try {
      const website = String(new FormData(ev.currentTarget).get("website") ?? "");
      const res = await fetch("/api/v1/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      if (res.ok) {
        setPhase("sent");
        return;
      }
      setPhase("idle");
      if (res.status === 429) setFailure(t.errRate);
      else if (res.status === 422) {
        const body = (await res.json()) as { error?: { fields?: Record<string, string> } };
        const f = body.error?.fields ?? {};
        setErrors({ name: f.name ? t.errName : undefined, email: f.email ? t.errEmail : undefined, message: f.message ? t.errMessage : undefined });
      } else setFailure(t.errGeneral);
    } catch {
      setPhase("idle");
      setFailure(t.errGeneral);
    }
  }

  if (phase === "sent") {
    return (
      <div className="banner banner--success" role="status" style={{ marginTop: 20 }}>
        <Icon name="check" size={20} />
        <div>
          <b>{t.sent}</b>
          <p>{t.sentText}</p>
          <button type="button" className="btn btn--sm" style={{ marginTop: 12 }} onClick={() => { setPhase("idle"); setName(""); setEmail(""); setMessage(""); }}>
            {t.another}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className={`field${errors.name ? " field--error" : ""}`}>
        <label className="label" htmlFor={`${id}-name`}>{t.name}</label>
        <input className="input" id={`${id}-name`} name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-e` : undefined} />
        {errors.name && <span className="error" id={`${id}-name-e`}>{errors.name}</span>}
      </div>
      <div className={`field${errors.email ? " field--error" : ""}`}>
        <label className="label" htmlFor={`${id}-email`}>{t.emailField}</label>
        <input className="input ltr" id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-e` : undefined} />
        {errors.email && <span className="error" id={`${id}-email-e`}>{errors.email}</span>}
      </div>
      <div className={`field${errors.message ? " field--error" : ""}`}>
        <label className="label" htmlFor={`${id}-msg`}>{t.message}</label>
        <textarea className="textarea" id={`${id}-msg`} name="message" value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? `${id}-msg-e` : undefined} />
        {errors.message && <span className="error" id={`${id}-msg-e`}>{errors.message}</span>}
      </div>
      <div className="hp" aria-hidden="true">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {failure && <p className="error" role="alert">{failure}</p>}
      <div>
        <button className="btn btn--dark" type="submit" disabled={phase === "sending"}>{phase === "sending" ? t.sending : t.send}</button>
      </div>
    </form>
  );
}
