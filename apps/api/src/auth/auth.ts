import { createHmac, timingSafeEqual } from "node:crypto";
import type { Cookie, HttpRequest, HttpResponseInit } from "@azure/functions";

const cookieName = "marvel_user_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 60;

type SessionPayload = {
  userId: string;
  iat: number;
  exp: number;
};

export type AuthenticatedUser = {
  userId: string;
};

/**Creates a signed httpOnly cookie for an authenticated user session. */
export function createSessionCookie(userId: string, issuedAt = currentUnixSeconds()): Cookie {
  const payload: SessionPayload = {
    userId,
    iat: issuedAt,
    exp: issuedAt + sessionMaxAgeSeconds
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
    maxAge: sessionMaxAgeSeconds
  };
}

/**Creates the expired cookie used to clear the current user session. */
export function createExpiredSessionCookie(): Cookie {
  return {
    name: cookieName,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 0
  };
}

/**Returns true when the request has a valid signed user session. */
export function isAuthenticated(request: HttpRequest): boolean {
  return getAuthenticatedUser(request) !== null;
}

/**Reads the authenticated user from a signed session cookie. */
export function getAuthenticatedUser(
  request: HttpRequest,
  now = currentUnixSeconds()
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
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;

    if (!isSessionPayload(payload) || payload.exp <= now) {
      return null;
    }

    return { userId: payload.userId };
  } catch {
    return null;
  }
}

/**Returns the authenticated user or the 401 response a protected handler should send. */
export function requireAuthenticatedUser(
  request: HttpRequest,
  now = currentUnixSeconds()
): { user: AuthenticatedUser; response: null } | { user: null; response: HttpResponseInit } {
  const user = getAuthenticatedUser(request, now);

  if (user) {
    return { user, response: null };
  }

  return {
    user: null,
    response: {
      status: 401,
      jsonBody: {
        message: "Not authenticated."
      }
    }
  };
}

/**Guards older handlers that only need a 401 response when the user is anonymous. */
export function requireAuth(request: HttpRequest): HttpResponseInit | null {
  return requireAuthenticatedUser(request).response;
}

/**Keeps magic-link redirects inside this app. */
export function sanitizeReturnPath(returnPath: string | undefined): string {
  if (!returnPath || !returnPath.startsWith("/") || returnPath.startsWith("//")) {
    return "/";
  }

  // Backslashes can confuse downstream URL parsing, so reject them outright.
  if (returnPath.includes("\\")) {
    return "/";
  }

  try {
    const parsed = new URL(returnPath, "https://app.local");

    return parsed.origin === "https://app.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/";
  } catch {
    return "/";
  }
}

function parseCookies(cookieHeader: string): Record<string, string> {
  return cookieHeader
    .split(";")
    .map(value => value.trim())
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

/**Safely decodes a cookie value and rejects malformed percent encoding. */
function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

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

function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
