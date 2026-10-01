import "server-only";
import type { EmailProvider, SendEmailInput, SendEmailResult } from "./provider";


/**
 * Development provider: prints the message to the server log instead of
 * sending it. Clearly labelled so nobody mistakes it for a real send.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  isConfigured() {
    return true;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const id = `console_${Date.now()}`;
    console.info(
      [
        "",
        "──────── EMAIL (console provider — NOT actually sent) ────────",
        `id:      ${id}`,
        `to:      ${input.to}`,
        `subject: ${input.subject}`,
        `pdf:     ${input.attachments?.[0]?.filename ?? "none"}`,
        "",
        input.text,
        "────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { id, provider: this.name };
  }
}
