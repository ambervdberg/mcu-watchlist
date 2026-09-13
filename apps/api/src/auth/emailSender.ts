import { Resend } from "resend";
import { buildLoginLinkEmail } from "./loginLinkEmail.js";

type SendEmailRequest = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type SendLoginLinkEmailRequest = {
  to: string;
  magicLink: string;
};

type EmailSenderConfig = {
  apiKey: string;
  from: string;
};

/**Sends application emails without exposing provider-specific code to auth handlers. */
export class EmailSender {
  private readonly resend: Resend;

  constructor(private readonly config: EmailSenderConfig = readEmailSenderConfig()) {
    this.resend = new Resend(config.apiKey);
  }

  /**Sends the one-time sign-in link used by passwordless authentication. */
  async sendLoginLinkEmail(request: SendLoginLinkEmailRequest): Promise<void> {
    const { subject, text, html } = buildLoginLinkEmail(request.magicLink);

    await this.sendEmail({
      to: request.to,
      subject,
      text,
      html
    });
  }

  /**Sends a raw transactional email through Resend. Logs only a pass/fail count, never the recipient, so Resend usage is visible in Application Insights without storing personal data. */
  private async sendEmail(request: SendEmailRequest): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.config.from,
      to: request.to,
      subject: request.subject,
      text: request.text,
      html: request.html
    });

    if (error) {
      console.log("resend:email_failed", error.message);
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }

    console.log("resend:email_sent");
  }
}

/**Sends a login-link email using the configured provider. */
export async function sendLoginLinkEmail(request: SendLoginLinkEmailRequest): Promise<void> {
  return new EmailSender().sendLoginLinkEmail(request);
}

function readEmailSenderConfig(): EmailSenderConfig {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!from) {
    throw new Error("EMAIL_FROM is not configured.");
  }

  return { apiKey, from };
}
