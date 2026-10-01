import "server-only";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
};

export type SendEmailResult = { id: string; provider: string };

export interface EmailProvider {
  readonly name: string;
  isConfigured(): boolean;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export class EmailError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}
