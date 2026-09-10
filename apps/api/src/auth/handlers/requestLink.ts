/** Handles POST /api/auth/request-link: issues a magic-link token and emails it. */

import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { sanitizeReturnPath } from "../auth.js";
import {
  sendLoginLinkEmail,
  type SendLoginLinkEmailRequest,
} from "../emailSender.js";
import { LoginTokenStore, normalizeEmail } from "../userAuth.js";
import {
  defaultRequestLinkRateLimiter,
  type RequestLinkRateLimiter,
} from "../requestLinkRateLimiter.js";
import type { TokenIssuerLike } from "./storePorts.js";

// How long a magic-link token remains valid after it is issued.
const requestLinkExpiryMinutes = 15;

type RequestLinkBody = {
  email?: unknown;
  returnPath?: unknown;
};

type RequestLinkDependencies = {
  tokenIssuer?: TokenIssuerLike;
  sendLoginLinkEmail?: (request: SendLoginLinkEmailRequest) => Promise<void>;
  rateLimiter?: RequestLinkRateLimiter;
};

/**
 * Issues a magic-link login token and emails it, without revealing whether
 * the email address is already registered (no enumeration).
 */
export async function handleRequestLink(
  request: HttpRequest,
  dependencies: RequestLinkDependencies = {},
): Promise<HttpResponseInit> {
  const body = await readRequestLinkBody(request);
  const normalizedEmail =
    body && typeof body.email === "string"
      ? tryNormalizeEmail(body.email)
      : null;

  if (!normalizedEmail) {
    return invalidEmailResponse();
  }

  const rateLimiter = dependencies.rateLimiter ?? defaultRequestLinkRateLimiter;
  const clientIp = getClientIp(request);

  if (!rateLimiter.tryConsume({ email: normalizedEmail, clientIp })) {
    return throttledResponse();
  }

  const returnPath =
    typeof body?.returnPath === "string" ? body.returnPath : undefined;
  const tokenIssuer = dependencies.tokenIssuer ?? new LoginTokenStore();
  const send = dependencies.sendLoginLinkEmail ?? sendLoginLinkEmail;
  const expiresAt = new Date(
    Date.now() + requestLinkExpiryMinutes * 60 * 1000,
  ).toISOString();

  const createdToken = await tokenIssuer.createLoginToken({
    email: normalizedEmail,
    returnPath: sanitizeReturnPath(returnPath),
    expiresAt,
  });

  await send({
    to: createdToken.email,
    magicLink: buildMagicLink(createdToken.rawToken),
  });

  return requestLinkSentResponse();
}

// ---------------------------------------------------------------------------
// Helpers (in the order the handler reads top to bottom)
// ---------------------------------------------------------------------------

/** Parses the request body, returning null when the payload is missing or not JSON. */
async function readRequestLinkBody(
  request: HttpRequest,
): Promise<RequestLinkBody | null> {
  try {
    return (await request.json()) as RequestLinkBody;
  } catch {
    return null;
  }
}

/** Normalizes an email, returning null instead of throwing when it is invalid. */
function tryNormalizeEmail(email: string): string | null {
  try {
    return normalizeEmail(email);
  } catch {
    return null;
  }
}

/** 400 returned when the submitted email cannot be normalized. */
function invalidEmailResponse(): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      message: "Enter a valid email address.",
    },
  };
}

/** Extracts the caller IP from the x-forwarded-for header for rate limiting. */
function getClientIp(request: HttpRequest): string {
  return (
    readHeader(request, "x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

/** Reads a single request header, returning null when it is absent. */
function readHeader(request: HttpRequest, name: string): string | null {
  return request.headers?.get(name) ?? null;
}

/** 429 returned when the rate limiter rejects further sign-in attempts. */
function throttledResponse(): HttpResponseInit {
  return {
    status: 429,
    jsonBody: {
      message: "Too many sign-in attempts. Try again later.",
    },
  };
}

/** Builds the absolute magic-link URL emailed to the user. */
function buildMagicLink(rawToken: string): string {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return `${baseUrl}/api/auth/consume-link?token=${encodeURIComponent(rawToken)}`;
}

/** 200 returned once the magic link has been emailed (without confirming the email exists). */
function requestLinkSentResponse(): HttpResponseInit {
  return {
    status: 200,
    jsonBody: {
      message: "Check your email for a sign-in link.",
    },
  };
}
