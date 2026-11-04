// A file sent with an email, such as the Daily Report as CSV.
export interface Attachment {
  filename: string;
  content: string;
}

export interface Email {
  recipient: string;
  subject: string;
  body: string;
  attachment: Attachment | null;
}

// Hands one email to the email provider. Throws when the provider refuses it.
export interface Notifier {
  send(email: Email): Promise<void>;
}
