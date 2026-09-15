import assert from "node:assert/strict";
import test from "node:test";
import { logPageView } from "./pageView.js";

class TestHeaders {
  constructor(private readonly values: Record<string, string>) {}

  /**Returns a header value using the same lowercase lookup Azure request headers expose. */
  get(name: string): string | null {
    return this.values[name.toLowerCase()] ?? null;
  }
}

/**Creates the smallest request shape logPageView reads from. */
function createRequest(referer?: string): { headers: TestHeaders } {
  return {
    headers: new TestHeaders(referer === undefined ? {} : { referer })
  };
}

/**Captures console.log calls made inside fn, without printing them. */
function captureLogs(fn: () => void): string[] {
  const calls: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    calls.push(args.join(" "));
  };

  try {
    fn();
  } finally {
    console.log = original;
  }

  return calls;
}

test("logPageView logs the referer pathname", () => {
  const logs = captureLogs(() => logPageView(createRequest("https://mcu.watch/title/iron-man")));

  assert.deepEqual(logs, ["page_view /title/iron-man"]);
});

test("logPageView strips query string and hash", () => {
  const logs = captureLogs(() =>
    logPageView(createRequest("https://mcu.watch/title/iron-man?ref=email#trailer"))
  );

  assert.deepEqual(logs, ["page_view /title/iron-man"]);
});

test("logPageView logs unknown when the referer header is missing", () => {
  const logs = captureLogs(() => logPageView(createRequest()));

  assert.deepEqual(logs, ["page_view unknown"]);
});

test("logPageView logs unknown when the referer header is not a valid URL", () => {
  const logs = captureLogs(() => logPageView(createRequest("not-a-url")));

  assert.deepEqual(logs, ["page_view unknown"]);
});

test("logPageView caps a long path at 200 characters", () => {
  const longSegment = "a".repeat(500);
  const logs = captureLogs(() => logPageView(createRequest(`https://mcu.watch/${longSegment}`)));

  assert.equal(logs.length, 1);
  const loggedPath = logs[0]!.slice("page_view ".length);
  assert.equal(loggedPath.length, 200);
});
