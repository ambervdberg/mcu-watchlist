/** Handles POST /api/logout: expires the current session cookie. */

import type { HttpResponseInit } from "@azure/functions";
import { createExpiredSessionCookie } from "../auth.js";

/** Expires the current signed user session cookie. */
export function handleLogout(): HttpResponseInit {
  return {
    status: 200,
    cookies: [createExpiredSessionCookie()],
    jsonBody: {
      authenticated: false,
    },
  };
}
