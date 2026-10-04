"use client";

import { useState, type HTMLAttributes, type Ref } from "react";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  ltr?: boolean;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
}

const describedBy = (id: string, help?: string, error?: string) => [help && `${id}-help`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;

export function TextField({ id, label, value, onChange, error, help, type = "text", autoComplete, inputMode, ltr, maxLength, inputRef }: FieldProps) {
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      {help && <p className="help" id={`${id}-help`}>{help}</p>}
      <input
        id={id} ref={inputRef} className={`input${ltr ? " ltr" : ""}`} type={type} value={value} maxLength={maxLength}
        dir={ltr ? "ltr" : undefined} autoComplete={autoComplete} inputMode={inputMode} spellCheck={false}
        autoCapitalize="none" aria-required="true" aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, help, error)}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

export interface PasswordText { show: string; hide: string; showLabel: string; hideLabel: string }

/** Password input with a show/hide toggle. The rule, when given, is announced as help before the user types. */
export function PasswordField({ id, label, value, onChange, error, help, autoComplete, inputRef, text }: Omit<FieldProps, "type" | "ltr" | "inputMode" | "maxLength"> & { text: PasswordText }) {
  const [shown, setShown] = useState(false);
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label className="label" htmlFor={id}>{label}</label>
      {help && <p className="help" id={`${id}-help`}>{help}</p>}
      <div className="auth__pw">
        <input
          id={id} ref={inputRef} className="input ltr" dir="ltr" type={shown ? "text" : "password"} value={value} maxLength={128}
          autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} aria-required="true"
          aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, help, error)}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="auth__toggle" aria-controls={id} aria-label={shown ? text.hideLabel : text.showLabel} onClick={() => setShown((s) => !s)}>
          {shown ? text.hide : text.show}
        </button>
      </div>
      {error && <p className="error" id={`${id}-err`}>{error}</p>}
    </div>
  );
}

/** Form-level failure. Focusable so it can receive focus when there is no single field to blame. */
export function FormAlert({ message, alertRef }: { message: string | null; alertRef?: Ref<HTMLDivElement> }) {
  if (!message) return null;
  return (
    <div className="banner banner--warning" role="alert" tabIndex={-1} ref={alertRef}>
      <div>{message}</div>
    </div>
  );
}

export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors the server rule: 8 to 128 characters with a letter and a number. */
export function passwordOk(p: string): boolean {
  return p.length >= 8 && p.length <= 128 && /[A-Za-z؀-ۿ]/.test(p) && /\d/.test(p);
}

/** Mirrors the server rule: 01XXXXXXXXX, 201XXXXXXXXX or +201XXXXXXXXX (operators 10, 11, 12, 15). */
export function mobileOk(v: string): boolean {
  const digits = v.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  return /^(?:20)?(1[0125]\d{8})$/.test(digits.startsWith("0") ? digits.slice(1) : digits);
}
