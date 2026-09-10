/** Handles GET /api/auth/consume-link: verifies a magic-link token and creates a session. */

import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { createSessionCookie } from "../auth.js";
import { LoginTokenStore, UserStore } from "../userAuth.js";
import type { TokenStoreLike, UserStoreLike } from "./storePorts.js";

type ConsumeLinkDependencies = {
  tokenStore?: TokenStoreLike;
  userStore?: UserStoreLike;
};

/** Consumes a magic-link token, creates a user session, and redirects back into the app. */
export async function handleConsumeLink(
  request: HttpRequest,
  dependencies: ConsumeLinkDependencies = {},
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
      Location: consumedToken.returnPath,
    },
    cookies: [createSessionCookie(user.userId)],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reads the one-time token from the consume-link URL, returning null when malformed. */
function readToken(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

/** 400 returned when the magic-link token is missing, invalid, or already used. */
function invalidLinkResponse(): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      message: "This sign-in link is invalid or expired.",
    },
  };
}
