import { createTransport } from 'nodemailer';
import { INLINE_IMAGES } from '../../email-templates/email-images.js';
import type { Email, Notifier } from '../../ports/notifier.js';

export interface SmtpSettings {
  host: string;
  port: number;
  // TLS from the first byte (port 465); otherwise the connection is upgraded with STARTTLS.
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string } | undefined;
  from: string;
}

// A file with the email. With a cid it is a picture shown inside the HTML, not a download.
export interface MailFile {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
}

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailFile[];
}

// The one thing EVLOS needs from a mail library. Rejects when the provider refuses the email.
export interface MailTransport {
  sendMail(message: MailMessage): Promise<unknown>;
}

const SUBMISSION_PORT = '587';
const IMPLICIT_TLS_PORT = 465;

function portFrom(text: string): number {
  const port = Number(text);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a port number, such as 587. Check .env.');
  }
  return port;
}

function loginFrom(env: Record<string, string | undefined>): SmtpSettings['auth'] {
  const user = env.SMTP_USER ?? '';
  return user === '' ? undefined : { user, pass: env.SMTP_PASSWORD ?? '' };
}

// The email settings from the environment, or null when SMTP_HOST is not set. Then emails
// stay queued in the outbox until it is.
export function smtpSettingsFrom(env: Record<string, string | undefined>): SmtpSettings | null {
  const host = env.SMTP_HOST ?? '';
  if (host === '') return null;
  const from = env.EMAIL_FROM ?? '';
  if (from === '') throw new Error('EMAIL_FROM must be set when SMTP_HOST is. Check .env.');
  const port = portFrom(env.SMTP_PORT ?? SUBMISSION_PORT);
  const auth = loginFrom(env);
  // With a login, refuse to talk to a server that cannot encrypt, so the password and the
  // Students' emails never travel in clear. Mailpit on this machine needs no login.
  return {
    host,
    port,
    secure: port === IMPLICIT_TLS_PORT,
    requireTLS: auth !== undefined,
    auth,
    from,
  };
}

// The files of an email: the ones that came with it, then, for an email with HTML, the logo
// and the wordmark that the HTML shows.
function filesOf(email: Email): MailFile[] {
  const pictures = email.html === undefined ? [] : INLINE_IMAGES;
  return [...email.attachments, ...pictures];
}

export function mailNotifier(transport: MailTransport, from: string): Notifier {
  return {
    async send(email) {
      const message: MailMessage = {
        from,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        ...(email.html === undefined ? {} : { html: email.html }),
      };
      const files = filesOf(email);
      await transport.sendMail(files.length === 0 ? message : { ...message, attachments: files });
    },
  };
}

// The Notifier for real use, through an SMTP server (Mailpit locally, a provider later).
export function smtpNotifier(settings: SmtpSettings): Notifier {
  const { from, ...connection } = settings;
  return mailNotifier(createTransport(connection), from);
}
