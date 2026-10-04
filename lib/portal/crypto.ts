import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const prod = process.env.NODE_ENV === "production";

/** Secrets are read lazily so a build does not need them. Development gets fixed insecure defaults. */
export function secret(name: "JWT_SECRET" | "GATEWAY_WEBHOOK_SECRET" | "INTERNAL_SECRET" | "LINK_SECRET"): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (prod) throw new Error(`${name} must be set to a random value of at least 16 characters in production`);
  return `dev-only-${name.toLowerCase()}-not-for-production`;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("hex");
export const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ---------------------------------------------------------------- passwords (scrypt) */

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(actual, expected);
}

/** Password rule (FR-SEC-003 text was not available; this is the assumed baseline): 8+ characters with a letter and a digit. */
export function passwordProblem(password: string): boolean {
  return !(typeof password === "string" && password.length >= 8 && password.length <= 128 && /[A-Za-z؀-ۿ]/.test(password) && /\d/.test(password));
}

/* ---------------------------------------------------------------- JWT (HS256) */

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export const ACCESS_TTL_SECONDS = 15 * 60;
export const CUSTOMER_AUDIENCE = "flux-customer";
const ISSUER = "flux-business-hub";

export function signAccessToken(userId: string, now = Date.now()): string {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const iat = Math.floor(now / 1000);
  const payload = b64u(JSON.stringify({ iss: ISSUER, aud: CUSTOMER_AUDIENCE, sub: userId, iat, exp: iat + ACCESS_TTL_SECONDS }));
  const sig = createHmac("sha256", secret("JWT_SECRET")).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

/** Returns the user id, or null for anything malformed, expired, tampered or meant for another audience (staff tokens). */
export function verifyAccessToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = createHmac("sha256", secret("JWT_SECRET")).update(`${h}.${p}`).digest("base64url");
  if (!safeEqual(s, expected)) return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    if (header.alg !== "HS256") return null;
    const body = JSON.parse(Buffer.from(p, "base64url").toString()) as { iss?: string; aud?: string; sub?: string; exp?: number };
    if (body.iss !== ISSUER || body.aud !== CUSTOMER_AUDIENCE || !body.sub || typeof body.exp !== "number") return null;
    if (body.exp * 1000 <= now) return null;
    return body.sub;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- signed values */

export function hmac(secretValue: string, data: string): string {
  return createHmac("sha256", secretValue).update(data).digest("hex");
}

/** Time-limited link signature for private document downloads. */
export function signLink(resource: string, expiresAt: number): string {
  return hmac(secret("LINK_SECRET"), `${resource}:${expiresAt}`);
}

export function verifyLink(resource: string, expiresAt: number, signature: string, now = Date.now()): boolean {
  return expiresAt > now && safeEqual(signLink(resource, expiresAt), signature);
}
