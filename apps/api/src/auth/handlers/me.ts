/** Handles GET /api/me: returns current session state without requiring authentication. */

import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { getAuthenticatedUser } from "../auth.js";
import { UserStore } from "../userAuth.js";
import type { UserStoreLike } from "./storePorts.js";

type MeDependencies = {
  userStore?: UserStoreLike;
};

/** Returns the current signed-in user state without requiring authentication. */
export async function handleMe(
  request: HttpRequest,
  dependencies: MeDependencies = {},
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
        email: user.email,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 200 signed-out state returned when no valid session is present. */
function anonymousMeResponse(): HttpResponseInit {
  return {
    status: 200,
    jsonBody: {
      authenticated: false,
    },
  };
}
