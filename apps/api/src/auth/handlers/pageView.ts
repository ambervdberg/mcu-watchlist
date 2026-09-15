// Referer-based page view logging. No cookies, no browser SDK.
// One line per /api/me call, read back in App Insights traces.

const MAX_PATH_LENGTH = 200;
const UNKNOWN_PATH = "unknown";

/** Logs one page_view line, pathname only, for the App Insights traces table. */
export function logPageView(request: { headers: { get(name: string): string | null } }): void {
  console.log(`page_view ${extractPathname(request.headers.get("referer"))}`);
}

/** Pulls the pathname off a Referer header. No query, no hash, no tokens. */
function extractPathname(referer: string | null): string {
  if (!referer) {
    return UNKNOWN_PATH;
  }

  try {
    const pathname = new URL(referer).pathname;

    return pathname.slice(0, MAX_PATH_LENGTH);
  } catch {
    return UNKNOWN_PATH;
  }
}
