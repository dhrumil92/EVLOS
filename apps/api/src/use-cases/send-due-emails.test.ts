import type { AfterFailedSend, Instant } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { Email, Notifier } from '../ports/notifier.js';
import type { OutboxRepository, TakenEmail } from '../ports/outbox-repository.js';
import { sendDueEmails } from './send-due-emails.js';

const NOW = Date.UTC(2026, 10, 4, 17, 31);
const FIVE_MINUTES = 5 * 60 * 1000;

const email = (id: number, attempts = 1): TakenEmail => ({
  id,
  attempts,
  recipient: `${String(id)}@example.com`,
  subject: 'Pooja missed',
  body: 'You did not punch at Pooja.',
});

// An outbox holding the given due emails, which records what the use case did with them.
function fakeOutbox(due: TakenEmail[]) {
  const sent: { id: number; at: Instant }[] = [];
  const notSent: { id: number; next: AfterFailedSend }[] = [];
  const outbox: OutboxRepository = {
    takeDue: () => Promise.resolve(due.splice(0)),
    markSent: (id, at) => {
      sent.push({ id, at });
      return Promise.resolve();
    },
    markNotSent: (id, next) => {
      notSent.push({ id, next });
      return Promise.resolve();
    },
  };
  return { outbox, sent, notSent };
}

// An email provider that accepts every email, except those to the refused recipients.
function fakeNotifier(refused: Record<string, string> = {}) {
  const delivered: Email[] = [];
  const notifier: Notifier = {
    send: (one) => {
      const code = refused[one.recipient];
      if (code !== undefined) return Promise.reject(Object.assign(new Error('refused'), { code }));
      delivered.push(one);
      return Promise.resolve();
    },
  };
  return { notifier, delivered };
}

const clock = { now: () => NOW };

describe('sendDueEmails', () => {
  it('hands each due email to the email provider and marks it sent', async () => {
    const { outbox, sent } = fakeOutbox([email(1), email(2)]);
    const { notifier, delivered } = fakeNotifier();

    const summary = await sendDueEmails({ outbox, notifier, clock });

    expect(delivered.map((one) => one.recipient)).toEqual(['1@example.com', '2@example.com']);
    expect(sent).toEqual([
      { id: 1, at: NOW },
      { id: 2, at: NOW },
    ]);
    expect(summary).toEqual({ sent: 2, notSent: 0, problems: [] });
  });

  it('hands the provider the subject and body as queued', async () => {
    const { outbox } = fakeOutbox([email(1)]);
    const { notifier, delivered } = fakeNotifier();

    await sendDueEmails({ outbox, notifier, clock });

    expect(delivered).toEqual([
      {
        recipient: '1@example.com',
        subject: 'Pooja missed',
        body: 'You did not punch at Pooja.',
      },
    ]);
  });

  it('queues a refused email again for five minutes later', async () => {
    const { outbox, sent, notSent } = fakeOutbox([email(1, 1)]);
    const { notifier } = fakeNotifier({ '1@example.com': 'ECONNECTION' });

    await sendDueEmails({ outbox, notifier, clock });

    expect(sent).toEqual([]);
    expect(notSent).toEqual([{ id: 1, next: { status: 'queued', sendAfter: NOW + FIVE_MINUTES } }]);
  });

  it('gives up an email refused on its third attempt', async () => {
    const { outbox, notSent } = fakeOutbox([email(1, 3)]);
    const { notifier } = fakeNotifier({ '1@example.com': 'ECONNECTION' });

    await sendDueEmails({ outbox, notifier, clock });

    expect(notSent).toEqual([{ id: 1, next: { status: 'failed' } }]);
  });

  it('still sends the other emails after one is refused', async () => {
    const { outbox, sent } = fakeOutbox([email(1), email(2)]);
    const { notifier } = fakeNotifier({ '1@example.com': 'EENVELOPE' });

    const summary = await sendDueEmails({ outbox, notifier, clock });

    expect(sent.map((one) => one.id)).toEqual([2]);
    expect(summary).toEqual({ sent: 1, notSent: 1, problems: ['EENVELOPE'] });
  });

  it('reports why an email was not sent by error code only, never by recipient', async () => {
    const { outbox } = fakeOutbox([email(1)]);
    const notifier: Notifier = { send: () => Promise.reject(new Error('1@example.com refused')) };

    const summary = await sendDueEmails({ outbox, notifier, clock });

    expect(summary.problems).toEqual(['unknown']);
  });

  it('sends nothing when no email is due', async () => {
    const { outbox } = fakeOutbox([]);
    const { notifier, delivered } = fakeNotifier();

    const summary = await sendDueEmails({ outbox, notifier, clock });

    expect(delivered).toEqual([]);
    expect(summary).toEqual({ sent: 0, notSent: 0, problems: [] });
  });
});
