import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionCookie,
  getAuthenticatedUser,
  requireAuthenticatedUser,
  sanitizeReturnPath
} from "./auth.js";

class TestHeaders {
  constructor(private readonly values: Record<string, string>) {}

  /**Returns a header value using the same lowercase lookup Azure request headers expose. */
  get(name: string): string | null {
    return this.values[name.toLowerCase()] ?? null;
  }
}

/**Creates the smallest request shape needed by the auth helpers. */
function requestWithCookie(cookie: string): { headers: TestHeaders } {
  return {
    headers: new TestHeaders({ cookie })
  };
}

test("createSessionCookie signs a user session that can be read back", () => {
  process.env.SESSION_SECRET = "test-secret";

  const cookie = createSessionCookie("user_123", 1_700_000_000);
  const request = requestWithCookie(`${cookie.name}=${encodeURIComponent(cookie.value)}`);

  assert.equal(cookie.name, "marvel_user_session");
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, "Strict");
  assert.deepEqual(getAuthenticatedUser(request as never, 1_700_000_001), {
    userId: "user_123"
  });
});

test("getAuthenticatedUser rejects tampered and expired sessions", () => {
  process.env.SESSION_SECRET = "test-secret";

  const cookie = createSessionCookie("user_123", 1_700_000_000);
  const tampered = `${cookie.value.slice(0, -1)}x`;
  const tamperedRequest = requestWithCookie(`${cookie.name}=${encodeURIComponent(tampered)}`);
  const expiredRequest = requestWithCookie(`${cookie.name}=${encodeURIComponent(cookie.value)}`);

  assert.equal(getAuthenticatedUser(tamperedRequest as never, 1_700_000_001), null);
  assert.equal(getAuthenticatedUser(expiredRequest as never, 1_705_184_001), null);
});

test("getAuthenticatedUser ignores malformed cookie encoding", () => {
  process.env.SESSION_SECRET = "test-secret";

  const malformedCookieRequest = requestWithCookie("marvel_user_session=%");

  assert.equal(getAuthenticatedUser(malformedCookieRequest as never), null);
});

test("requireAuthenticatedUser returns the user or a 401 response", () => {
  process.env.SESSION_SECRET = "test-secret";

  const cookie = createSessionCookie("user_123", 1_700_000_000);
  const validRequest = requestWithCookie(`${cookie.name}=${encodeURIComponent(cookie.value)}`);
  const anonymousRequest = requestWithCookie("");

  assert.deepEqual(requireAuthenticatedUser(validRequest as never, 1_700_000_001), {
    user: { userId: "user_123" },
    response: null
  });
  assert.deepEqual(requireAuthenticatedUser(anonymousRequest as never, 1_700_000_001), {
    user: null,
    response: {
      status: 401,
      jsonBody: {
        message: "Not authenticated."
      }
    }
  });
});

test("sanitizeReturnPath only accepts safe relative app paths", () => {
  assert.equal(sanitizeReturnPath("/title/iron-man"), "/title/iron-man");
  assert.equal(sanitizeReturnPath("/"), "/");
  assert.equal(sanitizeReturnPath("https://evil.test/title/iron-man"), "/");
  assert.equal(sanitizeReturnPath("//evil.test/path"), "/");
  assert.equal(sanitizeReturnPath("/\\evil"), "/");
  assert.equal(sanitizeReturnPath(undefined), "/");
});
