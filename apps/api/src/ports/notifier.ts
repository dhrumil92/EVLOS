// A file sent with an email, such as the Daily Report as Excel or CSV. The content is the
// file's bytes, so a binary Excel file and a text CSV are handled the same way.
export interface Attachment {
  filename: string;
  content: Buffer;
}

export interface Email {
  recipient: string;
  subject: string;
  body: string;
  // The same email with layout and colour. Sent beside the plain text, which stays for the
  // programs and phones that show only text. Absent for an email with no layout.
  html?: string;
  // In the order they are shown; empty when there is none.
  attachments: Attachment[];
}

// Hands one email to the email provider. Throws when the provider refuses it.
export interface Notifier {
  send(email: Email): Promise<void>;
}
