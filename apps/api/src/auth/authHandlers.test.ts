import assert from "node:assert/strict";
import test from "node:test";
import { getAuthenticatedUser } from "./auth.js";
import {
  handleConsumeLink,
  handleLogout,
  handleMe,
  handleRequestLink
} from "./authHandlers.js";
import type { ConsumedLoginToken, CreateLoginTokenRequest, CreatedLoginToken, UserAccount } from "./userAuth.js";
import {
  InMemoryRequestLinkRateLimiter,
  type RateLimitRequest
} from "./requestLinkRateLimiter.js";

class TestHeaders {
  constructor(private readonly values: Record<string, string>) {}

  /**Returns a header value using the same lowercase lookup Azure request headers expose. */
  get(name: string): string | null {
    return this.values[name.toLowerCase()] ?? null;
  }
}

type TestRequest = {
  url: string;
  headers: TestHeaders;
};

class FakeTokenStore {
  constructor(private readonly consumedToken: ConsumedLoginToken | null) {}

  /**Consumes a token using the configured fake result. */
  async consumeLoginToken(): Promise<ConsumedLoginToken | null> {
    return this.consumedToken;
  }
}

class FakeUserStore {
  constructor(private readonly user: UserAccount) {}

  /**Returns the fake user for magic-link sign-in. */
  async getOrCreateUserByEmail(): Promise<UserAccount> {
    return this.user;
  }

  /**Returns the fake user when the requested id matches. */
  async getUserById(userId: string): Promise<UserAccount | null> {
    return userId === this.user.userId ? this.user : null;
  }
}

const user: UserAccount = {
  userId: "user_123",
  email: "amber@example.com",
  emailHash: "email_hash"
};

class FakeTokenIssuer {
  public lastRequest: CreateLoginTokenRequest | null = null;

  constructor(private readonly createdToken: CreatedLoginToken) {}

  /**Records the request and returns the configured fake created token. */
  async createLoginToken(request: CreateLoginTokenRequest): Promise<CreatedLoginToken> {
    this.lastRequest = request;

    return this.createdToken;
  }
}

class FakeEmailSender {
  public lastRequest: { to: string; magicLink: string } | null = null;

  /**Records the email request instead of calling a real provider. */
  send = async (request: { to: string; magicLink: string }): Promise<void> => {
    this.lastRequest = request;
  };
}

class FakeRateLimiter {
  constructor(private readonly allowed: boolean) {}

  /**Returns the configured rate-limit decision. */
  tryConsume(_request: RateLimitRequest): boolean {
    return this.allowed;
  }
}

/**Creates the smallest request shape needed by the auth handlers. */
function createRequest(url: string, cookie = ""): TestRequest {
  return {
    url,
    headers: new TestHeaders({ cookie })
  };
}

/**Creates a request with a JSON body, as used by the request-link handler. */
function createJsonRequest(body: unknown): { json: () => Promise<unknown> } {
  return {
    json: async () => body
  };
}

test("handleRequestLink issues a token, emails the magic link, and returns a generic response", async () => {
  process.env.APP_BASE_URL = "https://app.local";

  const tokenIssuer = new FakeTokenIssuer({
    rawToken: "raw-token",
    tokenHash: "token-hash",
    email: "amber@example.com",
    returnPath: "/title/iron-man",
    expiresAt: "2026-06-22T00:15:00.000Z"
  });
  const emailSender = new FakeEmailSender();

  const response = await handleRequestLink(
    createJsonRequest({ email: "Amber@Example.com", returnPath: "/title/iron-man" }) as never,
    { tokenIssuer, sendLoginLinkEmail: emailSender.send }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.jsonBody, { message: "Check your email for a sign-in link." });
  assert.equal(tokenIssuer.lastRequest?.email, "amber@example.com");
  assert.equal(tokenIssuer.lastRequest?.returnPath, "/title/iron-man");
  assert.equal(emailSender.lastRequest?.to, "amber@example.com");
  assert.equal(emailSender.lastRequest?.magicLink, "https://app.local/api/auth/consume-link?token=raw-token");
});

test("handleRequestLink rejects malformed emails without issuing a token", async () => {
  const tokenIssuer = new FakeTokenIssuer({
    rawToken: "raw-token",
    tokenHash: "token-hash",
    email: "amber@example.com",
    returnPath: "/",
    expiresAt: "2026-06-22T00:15:00.000Z"
  });
  const emailSender = new FakeEmailSender();

  const response = await handleRequestLink(createJsonRequest({ email: "not-an-email" }) as never, {
    tokenIssuer,
    sendLoginLinkEmail: emailSender.send
  });

  assert.equal(response.status, 400);
  assert.equal(tokenIssuer.lastRequest, null);
  assert.equal(emailSender.lastRequest, null);
});

test("handleRequestLink throttles repeated valid requests before issuing a token", async () => {
  process.env.APP_BASE_URL = "https://app.local";

  const tokenIssuer = new FakeTokenIssuer({
    rawToken: "raw-token",
    tokenHash: "token-hash",
    email: "amber@example.com",
    returnPath: "/",
    expiresAt: "2026-06-22T00:15:00.000Z"
  });
  const emailSender = new FakeEmailSender();

  const response = await handleRequestLink(
    createJsonRequest({ email: "amber@example.com" }) as never,
    {
      tokenIssuer,
      sendLoginLinkEmail: emailSender.send,
      rateLimiter: new FakeRateLimiter(false)
    }
  );

  assert.equal(response.status, 429);
  assert.equal(tokenIssuer.lastRequest, null);
  assert.equal(emailSender.lastRequest, null);
});

test("InMemoryRequestLinkRateLimiter limits each email and client IP inside the window", () => {
  const limiter = new InMemoryRequestLinkRateLimiter(1_000, 2);

  assert.equal(limiter.tryConsume({ email: "amber@example.com", clientIp: "203.0.113.10", nowMs: 1_000 }), true);
  assert.equal(limiter.tryConsume({ email: "amber@example.com", clientIp: "203.0.113.10", nowMs: 1_100 }), true);
  assert.equal(limiter.tryConsume({ email: "amber@example.com", clientIp: "203.0.113.10", nowMs: 1_200 }), false);
  assert.equal(limiter.tryConsume({ email: "amber@example.com", clientIp: "203.0.113.10", nowMs: 2_100 }), true);
});

test("handleConsumeLink consumes a valid token, signs in the user, and redirects back", async () => {
  process.env.SESSION_SECRET = "test-secret";

  const response = await handleConsumeLink(
    createRequest("https://app.local/api/auth/consume-link?token=raw-token") as never,
    {
      tokenStore: new FakeTokenStore({
        email: "amber@example.com",
        returnPath: "/title/iron-man"
      }),
      userStore: new FakeUserStore(user)
    }
  );
  const sessionCookie = response.cookies?.[0];
  const sessionRequest = createRequest(
    "https://app.local/api/me",
    `${sessionCookie?.name}=${encodeURIComponent(sessionCookie?.value ?? "")}`
  );

  assert.equal(response.status, 302);
  assert.deepEqual(response.headers, { Location: "/title/iron-man" });
  assert.deepEqual(getAuthenticatedUser(sessionRequest as never), { userId: "user_123" });
});

test("handleConsumeLink rejects missing, expired, or reused tokens", async () => {
  const missingTokenResponse = await handleConsumeLink(
    createRequest("https://app.local/api/auth/consume-link") as never,
    {
      tokenStore: new FakeTokenStore(null),
      userStore: new FakeUserStore(user)
    }
  );
  const invalidTokenResponse = await handleConsumeLink(
    createRequest("https://app.local/api/auth/consume-link?token=raw-token") as never,
    {
      tokenStore: new FakeTokenStore(null),
      userStore: new FakeUserStore(user)
    }
  );

  assert.equal(missingTokenResponse.status, 400);
  assert.equal(invalidTokenResponse.status, 400);
  assert.equal(invalidTokenResponse.cookies, undefined);
});

test("handleMe returns anonymous or signed-in user state", async () => {
  process.env.SESSION_SECRET = "test-secret";

  const signedInCookie = handleLogout().cookies?.[0];
  const anonymousResponse = await handleMe(createRequest("https://app.local/api/me") as never, {
    userStore: new FakeUserStore(user)
  });
  const sessionResponse = await handleConsumeLink(
    createRequest("https://app.local/api/auth/consume-link?token=raw-token") as never,
    {
      tokenStore: new FakeTokenStore({
        email: "amber@example.com",
        returnPath: "/"
      }),
      userStore: new FakeUserStore(user)
    }
  );
  const sessionCookie = sessionResponse.cookies?.[0] ?? signedInCookie;
  const signedInResponse = await handleMe(
    createRequest(
      "https://app.local/api/me",
      `${sessionCookie?.name}=${encodeURIComponent(sessionCookie?.value ?? "")}`
    ) as never,
    { userStore: new FakeUserStore(user) }
  );

  assert.deepEqual(anonymousResponse.jsonBody, { authenticated: false });
  assert.deepEqual(signedInResponse.jsonBody, {
    authenticated: true,
    user: {
      id: "user_123",
      email: "amber@example.com"
    }
  });
});

test("handleLogout expires the user session cookie", () => {
  const response = handleLogout();
  const cookie = response.cookies?.[0];

  assert.equal(response.status, 200);
  assert.equal(cookie?.name, "marvel_user_session");
  assert.equal(cookie?.maxAge, 0);
  assert.deepEqual(response.jsonBody, { authenticated: false });
});
