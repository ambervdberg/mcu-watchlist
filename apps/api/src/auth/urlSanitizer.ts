/** URL path sanitization helpers for magic-link redirects. */

/**
 * Keeps magic-link redirects inside this app.
 *
 * Accepts only paths that start with a single "/" (rejects protocol-relative "//host/path"),
 * contain no backslashes (which can confuse downstream URL parsers), and resolve to the
 * same origin when parsed — preventing open-redirect attacks via encoded trickery.
 */
export function sanitizeReturnPath(returnPath: string | undefined): string {
  if (
    !returnPath ||
    !returnPath.startsWith("/") ||
    returnPath.startsWith("//")
  ) {
    return "/";
  }

  // Backslashes can confuse downstream URL parsing, so reject them outright.
  if (returnPath.includes("\\")) {
    return "/";
  }

  try {
    const parsed = new URL(returnPath, "https://app.local");

    return parsed.origin === "https://app.local"
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/";
  } catch {
    return "/";
  }
}
