/** Verifies session cookies and guards protected handlers against anonymous requests. */

import { timingSafeEqual } from "node:crypto";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  cookieName,
  currentUnixSeconds,
  decodeBase64Url,
  sign,
  type SessionPayload,
} from "./sessionToken.js";

/** The identity extracted from a verified session cookie. */
export type AuthenticatedUser = {
  userId: string;
};

/** Returns true when the request carries a valid signed user session. */
export function isAuthenticated(request: HttpRequest): boolean {
  return getAuthenticatedUser(request) !== null;
}

/**
 * Reads the authenticated user from a signed session cookie.
 *
 * Verification steps:
 *  1. Parse the `cookie` header and locate the session cookie.
 *  2. Split the cookie value into `<encodedPayload>.<signature>`.
 *  3. Re-sign the payload with SESSION_SECRET and compare using timingSafeEqual
 *     to prevent timing-based signature oracle attacks.
 *  4. Decode and validate the payload shape, then check expiry.
 *
 * Returns null for any missing, malformed, tampered, or expired session.
 */
export function getAuthenticatedUser(
  request: HttpRequest,
  now = currentUnixSeconds(),
): AuthenticatedUser | null {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookies(cookieHeader);
  const session = cookies[cookieName];

  if (!session) {
    return null;
  }

  const [encodedPayload, signature] = session.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload),
    ) as SessionPayload;

    if (!isSessionPayload(payload) || payload.exp <= now) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

/** Returns the authenticated user or the 401 response a protected handler should send. */
export function requireAuthenticatedUser(
  request: HttpRequest,
  now = currentUnixSeconds(),
):
  | { user: AuthenticatedUser; response: null }
  | { user: null; response: HttpResponseInit } {
  const user = getAuthenticatedUser(request, now);

  if (user) {
    return { user, response: null };
  }

  return {
    user: null,
    response: {
      status: 401,
      jsonBody: {
        message: "Not authenticated.",
      },
    },
  };
}

/** Guards older handlers that only need a 401 response when the user is anonymous. */
export function requireAuth(request: HttpRequest): HttpResponseInit | null {
  return requireAuthenticatedUser(request).response;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Parses a raw `Cookie` header string into a name→value map.
 * Each value is percent-decoded; entries with malformed encoding are dropped silently.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, cookie) => {
      const separatorIndex = cookie.indexOf("=");

      if (separatorIndex === -1) {
        return cookies;
      }

      const key = cookie.slice(0, separatorIndex);
      const value = cookie.slice(separatorIndex + 1);
      const decodedValue = decodeCookieValue(value);

      if (decodedValue === null) {
        return cookies;
      }

      cookies[key] = decodedValue;

      return cookies;
    }, {});
}

/** Safely decodes a cookie value and rejects malformed percent encoding. */
function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Type guard for the session payload shape decoded from the cookie. */
function isSessionPayload(value: unknown): value is SessionPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    "iat" in value &&
    "exp" in value &&
    typeof value.userId === "string" &&
    typeof value.iat === "number" &&
    typeof value.exp === "number"
  );
}

/**
 * Compares two strings in constant time to prevent timing-based attacks.
 * Rejects immediately if lengths differ (length difference is not a secret).
 */
function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
