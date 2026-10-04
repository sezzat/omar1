import { newId, hashPassword, passwordProblem, randomToken, sha256, verifyPassword } from "./crypto";
import { db } from "./db";
import { absoluteLink, queueEmail } from "./mail";
import type { CustomerRecord, CustomerType, Lang, UserRecord } from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; code: string; fields?: Record<string, string> };
const fail = (status: number, code: string, fields?: Record<string, string>): Result<never> => ({ ok: false, status, code, fields });

const DAY = 86_400_000;
const REFRESH_TTL_MS = 7 * DAY;
const VERIFY_TTL_MS = DAY;
const RESET_TTL_MS = 3_600_000;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Egyptian mobile numbers: 01XXXXXXXXX, 201XXXXXXXXX or +201XXXXXXXXX. Stored as +201XXXXXXXXX. */
export function normalizeMobile(v: unknown): string | null {
  const digits = String(v ?? "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
  const m = /^(?:20)?(1[0125]\d{8})$/.exec(digits.startsWith("0") ? digits.slice(1) : digits);
  return m ? `+20${m[1]}` : null;
}

export const userByEmail = (email: string) => [...db().users.values()].find((u) => u.email === email);
export const customerOf = (user: UserRecord) => db().customers.get(user.customerId);

/* ------------------------------------------------------------------ registration and matching */

export interface RegisterInput {
  type: CustomerType;
  name: string;
  companyName?: string;
  email: string;
  mobile: string;
  password: string;
  language: Lang;
  consent: boolean;
}

/**
 * Registration (US: new visitor, existing customer, company).
 * - New visitor: a new Active Customer and a login; email must be verified before the first payment.
 * - Contact details already on file: no duplicate Customer. The login is linked only after the link sent to the email on
 *   file is clicked, and it cannot sign in until then.
 * - Already registered: the same generic answer, plus an "already have an account" email, so the form cannot be used to
 *   find out who is registered.
 */
export function register(input: RegisterInput): Result<{ sent: true }> {
  const fields: Record<string, string> = {};
  const name = String(input.name ?? "").trim();
  const email = normalizeEmail(input.email);
  const mobile = normalizeMobile(input.mobile);
  const companyName = String(input.companyName ?? "").trim();
  if (input.type !== "individual" && input.type !== "company") fields.type = "invalid";
  if (name.length < 2 || name.length > 120) fields.name = "invalid";
  if (input.type === "company" && (companyName.length < 2 || companyName.length > 160)) fields.companyName = "required";
  if (!emailRe.test(email) || email.length > 200) fields.email = "invalid";
  if (!mobile) fields.mobile = "invalid";
  if (passwordProblem(input.password)) fields.password = "weak";
  if (input.consent !== true) fields.consent = "required";
  if (Object.keys(fields).length) return fail(422, "validation", fields);

  const lang: Lang = input.language === "en" ? "en" : "ar";
  const d = db();
  const existingUser = userByEmail(email) ?? [...d.users.values()].find((u) => u.mobile === mobile);
  if (existingUser) {
    queueEmail("already-registered", existingUser.email, existingUser.preferredLanguage, {});
    return { ok: true, value: { sent: true } };
  }

  const onFile = [...d.customers.values()].find((c) => c.email === email || c.mobile === mobile);
  let customer: CustomerRecord;
  let linkPending = false;
  if (onFile) {
    customer = onFile;
    linkPending = true;
  } else {
    customer = {
      id: newId("cus"), type: input.type, name, companyName: input.type === "company" ? companyName : undefined, email, mobile: mobile as string,
      status: "Active", createdAt: new Date().toISOString(), documentIds: [],
    };
    d.customers.set(customer.id, customer);
  }

  const user: UserRecord = {
    id: newId("usr"), customerId: customer.id, email: linkPending ? customer.email : email, mobile: linkPending ? customer.mobile : (mobile as string),
    emailVerified: false, passwordHash: hashPassword(input.password), preferredLanguage: lang, createdAt: new Date().toISOString(), linkPending,
  };
  d.users.set(user.id, user);
  sendVerification(user, customer);
  return { ok: true, value: { sent: true } };
}

export function sendVerification(user: UserRecord, customer: CustomerRecord): void {
  const token = randomToken();
  db().verifyTokens.set(sha256(token), { userId: user.id, expiresAt: Date.now() + VERIFY_TTL_MS });
  queueEmail("verify-email", user.email, user.preferredLanguage, { name: customer.name, link: absoluteLink(user.preferredLanguage, `/verify?token=${token}`) });
}

export function verifyEmail(token: string): Result<{ lang: Lang }> {
  const key = sha256(String(token ?? ""));
  const rec = db().verifyTokens.get(key);
  if (!rec || rec.expiresAt <= Date.now()) return fail(400, "invalid_token");
  const user = db().users.get(rec.userId);
  db().verifyTokens.delete(key);
  if (!user) return fail(400, "invalid_token");
  user.emailVerified = true;
  user.linkPending = false;
  return { ok: true, value: { lang: user.preferredLanguage } };
}

/* ------------------------------------------------------------------ sign in, sessions */

// Compared against when the email is unknown, so timing does not reveal which emails exist.
const DUMMY_HASH = hashPassword("not-a-real-password-1");

export function authenticate(emailRaw: string, password: string): Result<UserRecord> {
  const user = userByEmail(normalizeEmail(emailRaw));
  const valid = verifyPassword(String(password ?? ""), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return fail(401, "invalid_credentials");
  if (user.linkPending) return fail(403, "verification_required");
  return { ok: true, value: user };
}

export function issueRefresh(userId: string, family = newId("fam")): string {
  const token = randomToken();
  db().refreshTokens.set(sha256(token), { userId, family, expiresAt: Date.now() + REFRESH_TTL_MS, used: false });
  return token;
}
export const REFRESH_MAX_AGE_SECONDS = REFRESH_TTL_MS / 1000;

/** Rotates a refresh token. A token used twice means it leaked: the whole family is revoked. */
export function rotateRefresh(token: string): Result<{ user: UserRecord; refresh: string }> {
  const key = sha256(String(token ?? ""));
  const rec = db().refreshTokens.get(key);
  if (!rec) return fail(401, "invalid_session");
  if (db().revokedFamilies.has(rec.family)) return fail(401, "invalid_session");
  if (rec.used) {
    db().revokedFamilies.add(rec.family);
    return fail(401, "invalid_session");
  }
  if (rec.expiresAt <= Date.now()) return fail(401, "invalid_session");
  const user = db().users.get(rec.userId);
  if (!user || user.linkPending) return fail(401, "invalid_session");
  rec.used = true;
  return { ok: true, value: { user, refresh: issueRefresh(rec.userId, rec.family) } };
}

export function revokeRefresh(token: string | undefined): void {
  if (!token) return;
  const rec = db().refreshTokens.get(sha256(token));
  if (rec) db().revokedFamilies.add(rec.family);
}

export function revokeAllSessions(userId: string): void {
  for (const rec of db().refreshTokens.values()) if (rec.userId === userId) db().revokedFamilies.add(rec.family);
}

/* ------------------------------------------------------------------ password reset and change */

export function requestPasswordReset(emailRaw: string): void {
  const user = userByEmail(normalizeEmail(emailRaw));
  if (!user || user.linkPending) return;
  const customer = customerOf(user);
  const token = randomToken();
  db().resetTokens.set(sha256(token), { userId: user.id, expiresAt: Date.now() + RESET_TTL_MS });
  queueEmail("reset-password", user.email, user.preferredLanguage, { name: customer?.name ?? "", link: absoluteLink(user.preferredLanguage, `/reset-password?token=${token}`) });
}

export function resetPassword(token: string, password: string): Result<{ lang: Lang }> {
  if (passwordProblem(password)) return fail(422, "validation", { password: "weak" });
  const key = sha256(String(token ?? ""));
  const rec = db().resetTokens.get(key);
  if (!rec || rec.expiresAt <= Date.now()) return fail(400, "invalid_token");
  const user = db().users.get(rec.userId);
  db().resetTokens.delete(key);
  if (!user) return fail(400, "invalid_token");
  user.passwordHash = hashPassword(password);
  revokeAllSessions(user.id);
  return { ok: true, value: { lang: user.preferredLanguage } };
}

export function changePassword(user: UserRecord, current: string, next: string): Result<true> {
  if (!verifyPassword(String(current ?? ""), user.passwordHash)) return fail(403, "invalid_credentials");
  if (passwordProblem(next)) return fail(422, "validation", { password: "weak" });
  user.passwordHash = hashPassword(next);
  revokeAllSessions(user.id);
  return { ok: true, value: true };
}

/* ------------------------------------------------------------------ profile */

export interface ProfileInput {
  name?: string;
  companyName?: string;
  mobile?: string;
  preferredLanguage?: string;
}

export function updateProfile(user: UserRecord, customer: CustomerRecord, input: ProfileInput): Result<true> {
  const fields: Record<string, string> = {};
  if (input.name !== undefined) {
    const n = String(input.name).trim();
    if (n.length < 2 || n.length > 120) fields.name = "invalid";
  }
  if (input.companyName !== undefined && customer.type === "company") {
    const n = String(input.companyName).trim();
    if (n.length < 2 || n.length > 160) fields.companyName = "required";
  }
  const mobile = input.mobile !== undefined ? normalizeMobile(input.mobile) : undefined;
  if (input.mobile !== undefined && !mobile) fields.mobile = "invalid";
  if (input.mobile !== undefined && mobile) {
    const clash = [...db().customers.values()].some((c) => c.id !== customer.id && c.mobile === mobile);
    if (clash) fields.mobile = "taken";
  }
  if (input.preferredLanguage !== undefined && input.preferredLanguage !== "ar" && input.preferredLanguage !== "en") fields.preferredLanguage = "invalid";
  if (Object.keys(fields).length) return fail(422, "validation", fields);

  if (input.name !== undefined) customer.name = String(input.name).trim();
  if (input.companyName !== undefined && customer.type === "company") customer.companyName = String(input.companyName).trim();
  if (mobile) { customer.mobile = mobile; user.mobile = mobile; }
  if (input.preferredLanguage) user.preferredLanguage = input.preferredLanguage as Lang;
  return { ok: true, value: true };
}
