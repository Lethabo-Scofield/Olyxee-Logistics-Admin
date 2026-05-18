import crypto from "node:crypto";

const COOKIE_NAME = "olyxee_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

let ephemeralSecret: string | null = null;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production (>=16 chars).");
  }
  // Dev fallback: random per-process secret. Restarts invalidate sessions,
  // but this prevents anyone from forging cookies against a known dev key
  // (the Replit preview is internet-reachable).
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString("hex");
    // eslint-disable-next-line no-console
    console.warn(
      "[session] SESSION_SECRET not set — using ephemeral random secret (sessions reset on restart).",
    );
  }
  return ephemeralSecret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface SessionPayload {
  userId: string;
  iat: number;
  exp: number;
}

export function signSession(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { userId, iat: now, exp: now + MAX_AGE_SECONDS };
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", getSecret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
    if (!payload?.userId || typeof payload.exp !== "number") return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS,
  };
}
