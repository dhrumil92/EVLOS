import { describe, expect, it } from 'vitest';
import { mailNotifier, smtpSettingsFrom } from './smtp-notifier.js';
import type { MailMessage } from './smtp-notifier.js';

const FROM = 'EVLOS <evlos@example.com>';
const EMAIL = { recipient: '9001@example.com', subject: 'Pooja missed', body: 'Body' };

describe('smtpSettingsFrom', () => {
  it('is off when SMTP_HOST is not set, so emails stay queued', () => {
    expect(smtpSettingsFrom({ EMAIL_FROM: FROM })).toBeNull();
  });

  it('reads Mailpit on this machine, with no login', () => {
    const settings = smtpSettingsFrom({
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      EMAIL_FROM: FROM,
    });

    expect(settings).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
      requireTLS: false,
      auth: undefined,
      from: FROM,
    });
  });

  it('uses port 587 when SMTP_PORT is not set', () => {
    expect(smtpSettingsFrom({ SMTP_HOST: 'smtp.example.com', EMAIL_FROM: FROM })?.port).toBe(587);
  });

  it('requires TLS whenever it logs in, so the password never travels in clear', () => {
    const settings = smtpSettingsFrom({
      SMTP_HOST: 'smtp.example.com',
      SMTP_USER: 'evlos',
      SMTP_PASSWORD: 'secret',
      EMAIL_FROM: FROM,
    });

    expect(settings).toMatchObject({
      requireTLS: true,
      auth: { user: 'evlos', pass: 'secret' },
    });
  });

  it('connects with TLS from the start on port 465', () => {
    const settings = smtpSettingsFrom({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      EMAIL_FROM: FROM,
    });

    expect(settings?.secure).toBe(true);
  });

  it('refuses to start without EMAIL_FROM', () => {
    expect(() => smtpSettingsFrom({ SMTP_HOST: 'localhost' })).toThrow('EMAIL_FROM');
  });

  it('refuses a port that is not a number', () => {
    expect(() =>
      smtpSettingsFrom({ SMTP_HOST: 'localhost', SMTP_PORT: 'abc', EMAIL_FROM: FROM }),
    ).toThrow('SMTP_PORT');
  });
});

describe('mailNotifier', () => {
  it('sends the email from the EVLOS sender to the recipient, as plain text', async () => {
    const handed: MailMessage[] = [];
    const notifier = mailNotifier(
      {
        sendMail: (message) => {
          handed.push(message);
          return Promise.resolve();
        },
      },
      FROM,
    );

    await notifier.send({ ...EMAIL, attachments: [] });

    expect(handed).toEqual([
      { from: FROM, to: '9001@example.com', subject: 'Pooja missed', text: 'Body' },
    ]);
  });

  it('attaches every file the email has, in order', async () => {
    const handed: MailMessage[] = [];
    const notifier = mailNotifier(
      {
        sendMail: (message) => {
          handed.push(message);
          return Promise.resolve();
        },
      },
      FROM,
    );

    const attachments = [
      { filename: 'Report.xlsx', content: Buffer.from([0x50, 0x4b, 0x03, 0x04]) },
      { filename: 'Report.csv', content: Buffer.from('a,b') },
    ];

    await notifier.send({ ...EMAIL, attachments });

    expect(handed[0]?.attachments).toEqual(attachments);
  });

  it('fails when the email provider refuses the email', async () => {
    const notifier = mailNotifier(
      { sendMail: () => Promise.reject(new Error('Mailbox unavailable')) },
      FROM,
    );

    await expect(notifier.send({ ...EMAIL, attachments: [] })).rejects.toThrow(
      'Mailbox unavailable',
    );
  });
});
