import "server-only";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./provider";
import { EmailError } from "./provider";

/**
 * Resend (https://resend.com) — one of the providers the abstraction supports.
 * Add SendGrid / SMTP by implementing the same `EmailProvider` interface.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private apiKey: string | null;
  private from: string;

  constructor(apiKey: string | null, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.apiKey) throw new EmailError("Email sending is not configured.", 503);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
        reply_to: input.replyTo,
        attachments: input.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
        })),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("[email:resend] send failed", response.status, text.slice(0, 400));
      throw new EmailError("The invoice email could not be sent. Please try again.", 502);
    }

    const data = (await response.json()) as { id: string };
    return { id: data.id, provider: this.name };
  }
}
