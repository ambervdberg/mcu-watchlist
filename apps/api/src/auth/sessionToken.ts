/** Shared session token primitives: cookie name, session lifetime, HMAC signing, and base64url codec. */

import { createHmac } from "node:crypto";

/** The name of the HttpOnly session cookie set on the client after a successful magic-link login. */
export const cookieName = "marvel_user_session";

/** How long a session stays valid: 60 days in seconds. */
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 60;

/** Shape of the JSON payload baked into the signed session cookie value. */
export type SessionPayload = {
  userId: string;
  /** Unix timestamp (seconds) when the token was issued. */
  iat: number;
  /** Unix timestamp (seconds) after which the token is considered expired. */
  exp: number;
};

/**
 * Signs a base64url-encoded payload with HMAC-SHA256 using SESSION_SECRET.
 * Used both when creating a cookie (sign) and when verifying one (re-sign then compare).
 */
export function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

/** Encodes a UTF-8 string as base64url (used when building the cookie value). */
export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

/** Decodes a base64url string back to UTF-8 (used when parsing the cookie value). */
export function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/** Returns the current time as Unix seconds (used for iat/exp comparisons). */
export function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
