/** Creates and destroys the signed HttpOnly session cookie. */

import type { Cookie } from "@azure/functions";
import {
  cookieName,
  currentUnixSeconds,
  encodeBase64Url,
  sessionMaxAgeSeconds,
  sign,
} from "./sessionToken.js";

/**
 * Creates a signed HttpOnly session cookie for an authenticated user.
 *
 * The cookie value is `<base64url(payload)>.<HMAC-SHA256(base64url(payload))>`,
 * so any tampering with either part invalidates the signature on the next request.
 * Secure + SameSite=Strict limit delivery to same-origin HTTPS requests only.
 */
export function createSessionCookie(
  userId: string,
  issuedAt = currentUnixSeconds(),
): Cookie {
  const payload = {
    userId,
    iat: issuedAt,
    exp: issuedAt + sessionMaxAgeSeconds,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    name: cookieName,
    value: `${encodedPayload}.${signature}`,
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  };
}

/**
 * Creates an expired cookie that instructs the browser to delete the current session.
 * maxAge: 0 causes immediate expiry on the client side.
 */
export function createExpiredSessionCookie(): Cookie {
  return {
    name: cookieName,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  };
}
