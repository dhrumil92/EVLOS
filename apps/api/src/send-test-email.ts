// Sends one test email through the SMTP settings in .env, to check them before the schedule
// relies on them: npm run email:test -- you@example.com
// It does not touch the database or the outbox. The SMTP password is never printed.
import { isEmailAddress } from '@evlos/core';
import { smtpNotifier, smtpSettingsFrom } from './adapters/email/smtp-notifier.js';

const recipient = process.argv[2];
if (recipient === undefined || !isEmailAddress(recipient)) {
  console.error('Use: npm run email:test -- you@example.com (with the SMTP settings in .env)');
  process.exit(1);
}

const smtp = smtpSettingsFrom(process.env);
if (smtp === null) {
  console.error('SMTP_HOST is not set in .env, so there is nothing to test.');
  process.exit(1);
}

const where = `${smtp.host}:${String(smtp.port)}`;
try {
  await smtpNotifier(smtp).send({
    recipient,
    subject: 'EVLOS test email',
    body:
      `This is a test email from EVLOS, sent through ${where} as ${smtp.from}.\n\n` +
      'If it arrived, the email settings work.',
    attachment: null,
  });
  console.log(`Sent through ${where}. Check the inbox of ${recipient}, and its spam folder.`);
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Not sent through ${where} (${code}): ${reason}`);
  process.exit(1);
}
