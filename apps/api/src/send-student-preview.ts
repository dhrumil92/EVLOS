// Sends one sample of the Student's Notification ("Pooja missed") to an address you give, to see
// the email as a Student will: npm run email:preview -- you@example.com ["Student name"]
// It uses the real wording and design, today's Day and a made-up Student. It does not touch the
// database or the outbox, and it never writes to a real Student. The SMTP password is never printed.
import { dayOf, isEmailAddress } from '@evlos/core';
import { smtpNotifier, smtpSettingsFrom } from './adapters/email/smtp-notifier.js';
import { notificationFor } from './use-cases/review.js';

const recipient = process.argv[2];
if (recipient === undefined || !isEmailAddress(recipient)) {
  console.error('Use: npm run email:preview -- you@example.com ["Student name"]');
  process.exit(1);
}

const smtp = smtpSettingsFrom(process.env);
if (smtp === null) {
  console.error('SMTP_HOST is not set in .env, so there is nothing to send through.');
  process.exit(1);
}

const student = {
  studentId: 'sample',
  name: process.argv[3] ?? 'Test Student',
  room: '101',
  email: recipient,
  phone: null,
};
const { subject, body, html } = notificationFor(dayOf(Date.now()), student);

const where = `${smtp.host}:${String(smtp.port)}`;
try {
  await smtpNotifier(smtp).send({
    recipient,
    subject,
    body,
    ...(html === undefined ? {} : { html }),
    attachments: [],
  });
  console.log(
    `Sent a sample Notification through ${where} to ${recipient}. Check its inbox and spam.`,
  );
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Not sent through ${where} (${code}): ${reason}`);
  process.exit(1);
}
