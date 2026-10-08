import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Dedicated platform-admin login. This is not a CRM user and not the
// per-account owner/admin role. Email and password come from the
// server environment; a matching POST sets a signed httpOnly cookie.

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface PlatformAdminCreds {
  email: string;
  password: string;
}

export function readPlatformAdminCreds(
  env: {
    PLATFORM_ADMIN_EMAIL?: string;
    PLATFORM_ADMIN_PASSWORD?: string;
  } = process.env,
): PlatformAdminCreds {
  return {
    email: (env.PLATFORM_ADMIN_EMAIL ?? "").trim().toLowerCase(),
    password: env.PLATFORM_ADMIN_PASSWORD ?? "",
  };
}

export function platformAdminConfigured(
  creds: PlatformAdminCreds = readPlatformAdminCreds(),
): boolean {
  return creds.email.length > 0 && creds.password.length > 0;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** True only when both email and password match the env credentials. */
export function platformAdminCredentialsMatch(
  email: string,
  password: string,
  creds: PlatformAdminCreds = readPlatformAdminCreds(),
): boolean {
  if (!platformAdminConfigured(creds)) return false;
  return (
    safeEqual(email.trim().toLowerCase(), creds.email) &&
    safeEqual(password, creds.password)
  );
}

function signingKey(creds: PlatformAdminCreds): Buffer {
  return createHash("sha256")
    .update(`wacrm-platform-admin\0${creds.email}\0${creds.password}`)
    .digest();
}

/** Signed expiry token. Null when admin credentials are not configured. */
export function signPlatformAdminToken(
  now = Date.now(),
  creds: PlatformAdminCreds = readPlatformAdminCreds(),
): string | null {
  if (!platformAdminConfigured(creds)) return null;
  const exp = String(now + SESSION_TTL_MS);
  const mac = createHmac("sha256", signingKey(creds)).update(exp).digest("base64url");
  return `${exp}.${mac}`;
}

export function verifyPlatformAdminToken(
  token: string | null | undefined,
  now = Date.now(),
  creds: PlatformAdminCreds = readPlatformAdminCreds(),
): boolean {
  if (!token || !platformAdminConfigured(creds)) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expRaw = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", signingKey(creds))
    .update(expRaw)
    .digest("base64url");
  return safeEqual(mac, expected);
}
