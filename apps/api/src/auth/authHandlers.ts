import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import {
  createExpiredSessionCookie,
  createSessionCookie,
  getAuthenticatedUser,
  sanitizeReturnPath
} from "./auth.js";
import { sendLoginLinkEmail, type SendLoginLinkEmailRequest } from "./emailSender.js";
import {
  LoginTokenStore,
  UserStore,
  normalizeEmail,
  type ConsumedLoginToken,
  type CreateLoginTokenRequest,
  type CreatedLoginToken,
  type UserAccount
} from "./userAuth.js";
import {
  defaultRequestLinkRateLimiter,
  type RequestLinkRateLimiter
} from "./requestLinkRateLimiter.js";

const requestLinkExpiryMinutes = 15;

type TokenStoreLike = {
  consumeLoginToken(rawToken: string): Promise<ConsumedLoginToken | null>;
};

type TokenIssuerLike = {
  createLoginToken(request: CreateLoginTokenRequest): Promise<CreatedLoginToken>;
};

type UserStoreLike = {
  getOrCreateUserByEmail(email: string): Promise<UserAccount>;
  getUserById(userId: string): Promise<UserAccount | null>;
};

type RequestLinkDependencies = {
  tokenIssuer?: TokenIssuerLike;
  sendLoginLinkEmail?: (request: SendLoginLinkEmailRequest) => Promise<void>;
  rateLimiter?: RequestLinkRateLimiter;
};

type ConsumeLinkDependencies = {
  tokenStore?: TokenStoreLike;
  userStore?: UserStoreLike;
};

type MeDependencies = {
  userStore?: UserStoreLike;
};

type RequestLinkBody = {
  email?: unknown;
  returnPath?: unknown;
};

/**Issues a magic-link login token and emails it, without revealing whether the email is registered. */
export async function handleRequestLink(
  request: HttpRequest,
  dependencies: RequestLinkDependencies = {}
): Promise<HttpResponseInit> {
  const body = await readRequestLinkBody(request);
  const normalizedEmail = body && typeof body.email === "string" ? tryNormalizeEmail(body.email) : null;

  if (!normalizedEmail) {
    return invalidEmailResponse();
  }

  const rateLimiter = dependencies.rateLimiter ?? defaultRequestLinkRateLimiter;
  const clientIp = getClientIp(request);

  if (!rateLimiter.tryConsume({ email: normalizedEmail, clientIp })) {
    return throttledResponse();
  }

  const returnPath = typeof body?.returnPath === "string" ? body.returnPath : undefined;
  const tokenIssuer = dependencies.tokenIssuer ?? new LoginTokenStore();
  const send = dependencies.sendLoginLinkEmail ?? sendLoginLinkEmail;
  const expiresAt = new Date(Date.now() + requestLinkExpiryMinutes * 60 * 1000).toISOString();

  const createdToken = await tokenIssuer.createLoginToken({
    email: normalizedEmail,
    returnPath: sanitizeReturnPath(returnPath),
    expiresAt
  });

  await send({
    to: createdToken.email,
    magicLink: buildMagicLink(createdToken.rawToken)
  });

  return requestLinkSentResponse();
}

/**Consumes a magic-link token, creates a user session, and redirects back into the app. */
export async function handleConsumeLink(
  request: HttpRequest,
  dependencies: ConsumeLinkDependencies = {}
): Promise<HttpResponseInit> {
  const token = readToken(request.url);

  if (!token) {
    return invalidLinkResponse();
  }

  const tokenStore = dependencies.tokenStore ?? new LoginTokenStore();
  const consumedToken = await tokenStore.consumeLoginToken(token);

  if (!consumedToken) {
    return invalidLinkResponse();
  }

  const userStore = dependencies.userStore ?? new UserStore();
  const user = await userStore.getOrCreateUserByEmail(consumedToken.email);

  return {
    status: 302,
    headers: {
      Location: consumedToken.returnPath
    },
    cookies: [createSessionCookie(user.userId)]
  };
}

/**Returns the current signed-in user state without requiring authentication. */
export async function handleMe(
  request: HttpRequest,
  dependencies: MeDependencies = {}
): Promise<HttpResponseInit> {
  const sessionUser = getAuthenticatedUser(request);

  if (!sessionUser) {
    return anonymousMeResponse();
  }

  const userStore = dependencies.userStore ?? new UserStore();
  const user = await userStore.getUserById(sessionUser.userId);

  if (!user) {
    return anonymousMeResponse();
  }

  return {
    status: 200,
    jsonBody: {
      authenticated: true,
      user: {
        id: user.userId,
        email: user.email
      }
    }
  };
}

/**Expires the current signed user session cookie. */
export function handleLogout(): HttpResponseInit {
  return {
    status: 200,
    cookies: [createExpiredSessionCookie()],
    jsonBody: {
      authenticated: false
    }
  };
}

async function readRequestLinkBody(request: HttpRequest): Promise<RequestLinkBody | null> {
  try {
    return (await request.json()) as RequestLinkBody;
  } catch {
    return null;
  }
}

function tryNormalizeEmail(email: string): string | null {
  try {
    return normalizeEmail(email);
  } catch {
    return null;
  }
}

function buildMagicLink(rawToken: string): string {
  const baseUrl = process.env.APP_BASE_URL;

  if (!baseUrl) {
    throw new Error("APP_BASE_URL is not configured.");
  }

  return `${baseUrl}/api/auth/consume-link?token=${encodeURIComponent(rawToken)}`;
}

function requestLinkSentResponse(): HttpResponseInit {
  return {
    status: 200,
    jsonBody: {
      message: "Check your email for a sign-in link."
    }
  };
}

function throttledResponse(): HttpResponseInit {
  return {
    status: 429,
    jsonBody: {
      message: "Too many sign-in attempts. Try again later."
    }
  };
}

function invalidEmailResponse(): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      message: "Enter a valid email address."
    }
  };
}

function getClientIp(request: HttpRequest): string {
  return readHeader(request, "x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function readHeader(request: HttpRequest, name: string): string | null {
  return request.headers?.get(name) ?? null;
}

function readToken(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

function invalidLinkResponse(): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      message: "This sign-in link is invalid or expired."
    }
  };
}

function anonymousMeResponse(): HttpResponseInit {
  return {
    status: 200,
    jsonBody: {
      authenticated: false
    }
  };
}
