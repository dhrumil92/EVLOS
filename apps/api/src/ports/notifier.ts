export interface Email {
  recipient: string;
  subject: string;
  body: string;
}

// Hands one email to the email provider. Throws when the provider refuses it.
export interface Notifier {
  send(email: Email): Promise<void>;
}
