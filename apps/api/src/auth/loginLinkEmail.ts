const appName = "Marvel Watchlist";

export type LoginLinkEmail = {
  subject: string;
  text: string;
  html: string;
};

/**Builds the subject, text and html for a passwordless sign-in link email. */
export function buildLoginLinkEmail(magicLink: string): LoginLinkEmail {
  const subject = `Sign in to ${appName}`;

  const text = [
    `Use this link to sign in to ${appName}:`,
    "",
    magicLink,
    "",
    "This link expires soon. If you did not request it, you can ignore this email."
  ].join("\n");

  // Keep the HTML simple so the message stays readable in strict email clients.
  const html = [
    `<p>Use this link to sign in to ${appName}:</p>`,
    `<p><a href="${escapeHtml(magicLink)}">Sign in to ${appName}</a></p>`,
    "<p>This link expires soon. If you did not request it, you can ignore this email.</p>"
  ].join("");

  return { subject, text, html };
}

/**Escapes text for safe use inside HTML markup. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
