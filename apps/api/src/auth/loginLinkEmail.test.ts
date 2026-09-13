import assert from "node:assert/strict";
import test from "node:test";
import { buildLoginLinkEmail } from "./loginLinkEmail.js";

test("buildLoginLinkEmail sets the expected subject", () => {
  const email = buildLoginLinkEmail("https://mcu.watch/auth?token=abc");

  assert.equal(email.subject, "Sign in to Marvel Watchlist");
});

test("buildLoginLinkEmail text contains the raw link", () => {
  const link = "https://mcu.watch/auth?token=abc&next=/title/iron-man";

  const email = buildLoginLinkEmail(link);

  assert.ok(email.text.includes(link));
});

test("buildLoginLinkEmail html contains the escaped link with no unescaped ampersand", () => {
  const link = "https://mcu.watch/auth?token=abc&next=/title/iron-man";

  const email = buildLoginLinkEmail(link);

  assert.ok(email.html.includes("https://mcu.watch/auth?token=abc&amp;next=/title/iron-man"));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|#39;)/.test(email.html));
});
