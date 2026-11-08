// Sends one sample email to an address you give, to see it as it will look:
//   npm run email:preview -- you@example.com [student|daily|monthly|reminder|reset] ["Student name"]
// The kind is student when left out. A sample uses the real design and wording, today's Day and
// made-up Students and numbers. It does not touch the database or the outbox, and it never
// writes to a real Student. The SMTP password is never printed.
import { dayOf, isEmailAddress } from '@evlos/core';
import { smtpNotifier, smtpSettingsFrom } from './adapters/email/smtp-notifier.js';
import { passwordResetHtml } from './email-templates/password-reset.js';
import { reportEmailHtml } from './email-templates/report-email.js';
import { reviewReminderHtml } from './email-templates/review-reminder.js';
import type { Email } from './ports/notifier.js';
import { dayInWords, monthInWords } from './use-cases/day-in-words.js';
import { notificationFor } from './use-cases/review.js';

const KINDS = ['student', 'daily', 'monthly', 'reminder', 'reset'] as const;
type Kind = (typeof KINDS)[number];

const isKind = (text: string): text is Kind => KINDS.some((kind) => kind === text);

const recipient = process.argv[2];
const kind = process.argv[3] ?? 'student';
if (recipient === undefined || !isEmailAddress(recipient) || !isKind(kind)) {
  console.error(
    'Use: npm run email:preview -- you@example.com [student|daily|monthly|reminder|reset] ["Student name"]',
  );
  process.exit(1);
}

const smtp = smtpSettingsFrom(process.env);
if (smtp === null) {
  console.error('SMTP_HOST is not set in .env, so there is nothing to send through.');
  process.exit(1);
}

const today = dayOf(Date.now());
const FILES = ['Daily Report.xlsx', 'Vidyalaya Presence.xlsx'];
const SENTENCE = 'The full Report is attached as an Excel file, with each Pooja Status in colour.';
const SAMPLE_NOTE = 'This is a sample of an EVLOS email. Open it in an email program to see it.';

function sampleOf(which: Kind): Omit<Email, 'recipient' | 'attachments'> {
  switch (which) {
    case 'student': {
      const name = process.argv[4] ?? 'Test Student';
      const student = {
        studentId: 'sample',
        name,
        room: '101',
        email: recipient ?? '',
        phone: null,
      };
      return notificationFor(today, student);
    }
    case 'daily':
      return {
        subject: `Sample Daily Report: ${dayInWords(today)}`,
        body: SAMPLE_NOTE,
        html: reportEmailHtml({
          title: 'Daily Report',
          about: dayInWords(today),
          intro: null,
          counts: [
            { name: 'Present', count: 112 },
            { name: 'Absent', count: 6 },
            { name: 'Not Applicable', count: 14 },
          ],
          emptyText: 'No Student was Active on this Day.',
          paragraphs: [SENTENCE],
          files: FILES,
        }),
      };
    case 'monthly':
      return {
        subject: `Sample Monthly Report: ${monthInWords(today.slice(0, 7))}`,
        body: SAMPLE_NOTE,
        html: reportEmailHtml({
          title: 'Monthly Report',
          about: monthInWords(today.slice(0, 7)),
          intro: 'Pooja Statuses in the month, one for each Student on each Day:',
          counts: [
            { name: 'Present', count: 3120 },
            { name: 'Absent', count: 85 },
            { name: 'Needs Review', count: 4 },
            { name: 'Not Applicable', count: 410 },
          ],
          emptyText: 'No Student was Active in the month.',
          paragraphs: ['Every Day of the month is Finalized.', SENTENCE],
          files: FILES,
        }),
      };
    case 'reminder':
      return {
        subject: `Sample Review Reminder: ${dayInWords(today)}`,
        body: SAMPLE_NOTE,
        html: reviewReminderHtml({
          day: today,
          students: [
            { room: '205', name: 'Test Student', studentId: '9002' },
            { room: '310', name: 'Other Student', studentId: '9003' },
          ],
        }),
      };
    case 'reset':
      return {
        subject: 'Sample EVLOS password reset',
        body: SAMPLE_NOTE,
        html: passwordResetHtml({ link: 'https://evlos.example.org/reset-password?token=sample' }),
      };
  }
}

const where = `${smtp.host}:${String(smtp.port)}`;
try {
  await smtpNotifier(smtp).send({ recipient, ...sampleOf(kind), attachments: [] });
  console.log(
    `Sent a sample ${kind} email through ${where} to ${recipient}. Check its inbox and spam.`,
  );
} catch (error) {
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'unknown';
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`Not sent through ${where} (${code}): ${reason}`);
  process.exit(1);
}
