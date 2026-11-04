import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { migrateDatabase } from '../../db/migrate.js';
import { resetTestDatabase } from '../../db/reset-test-database.js';
import { outboxEmails } from '../../db/schema.js';
import { assertTestDatabase } from '../../db/test-database.js';
import { PostgresOutboxRepository } from './outbox-repository.js';

const testUrl = process.env.TEST_DATABASE_URL;
assertTestDatabase(testUrl);

const pool = new pg.Pool({ connectionString: testUrl });
const db = drizzle(pool);
const repository = new PostgresOutboxRepository(db);

const QUEUED_AT = Date.UTC(2026, 10, 4, 17, 30);
const NOW = Date.UTC(2026, 10, 4, 17, 31);
const LATER = Date.UTC(2026, 10, 4, 17, 36);

const queue = (studentId: string, sendAfter = QUEUED_AT) =>
  db.insert(outboxEmails).values({
    kind: 'Notification',
    recipient: `${studentId}@example.com`,
    subject: 'Pooja missed',
    body: 'You did not punch at Pooja.',
    dedupeKey: `Notification|2026-11-04|${studentId}`,
    sendAfter: new Date(sendAfter),
  });

const rows = async () =>
  (
    await pool.query<{ id: number; status: string; attempts: number; sentAt: Date | null }>(
      'select id, status, attempts, sent_at as "sentAt" from outbox_emails order by id',
    )
  ).rows;

describe('PostgresOutboxRepository', () => {
  beforeEach(async () => {
    await resetTestDatabase(testUrl);
    await migrateDatabase(testUrl);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('takes a queued email that is due and counts the attempt', async () => {
    await queue('9001');

    const taken = await repository.takeDue(NOW, 10);

    expect(taken).toEqual([
      {
        id: expect.any(Number) as number,
        attempts: 1,
        recipient: '9001@example.com',
        subject: 'Pooja missed',
        body: 'You did not punch at Pooja.',
        attachment: null,
      },
    ]);
    expect((await rows())[0]).toMatchObject({ status: 'sending', attempts: 1 });
  });

  it('never takes the same email twice', async () => {
    await queue('9001');
    await repository.takeDue(NOW, 10);

    const second = await repository.takeDue(LATER, 10);

    expect(second).toEqual([]);
  });

  it('never gives the same email to two runs at the same moment', async () => {
    for (const studentId of ['9001', '9002', '9003', '9004']) await queue(studentId);

    const [first, second] = await Promise.all([
      repository.takeDue(NOW, 10),
      repository.takeDue(NOW, 10),
    ]);

    const ids = [...first, ...second].map((one) => one.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });

  it('leaves an email that is not due yet', async () => {
    await queue('9001', LATER);

    expect(await repository.takeDue(NOW, 10)).toEqual([]);
  });

  it('takes the oldest emails first and no more than asked', async () => {
    for (const studentId of ['9001', '9002', '9003']) await queue(studentId);

    const taken = await repository.takeDue(NOW, 2);

    expect(taken.map((one) => one.recipient)).toEqual(['9001@example.com', '9002@example.com']);
  });

  it('marks a sent email sent, with the time it was sent', async () => {
    await queue('9001');
    const [taken] = await repository.takeDue(NOW, 10);

    await repository.markSent(taken?.id ?? 0, NOW);

    expect((await rows())[0]).toMatchObject({ status: 'sent', sentAt: new Date(NOW) });
  });

  it('queues a refused email again, to be taken only when it is due', async () => {
    await queue('9001');
    const [taken] = await repository.takeDue(NOW, 10);

    await repository.markNotSent(taken?.id ?? 0, { status: 'queued', sendAfter: LATER });

    expect(await repository.takeDue(NOW, 10)).toEqual([]);
    expect((await repository.takeDue(LATER, 10)).map((one) => one.attempts)).toEqual([2]);
  });

  it('queues an email once for each dedupe key, however often it is asked', async () => {
    const report = {
      kind: 'Daily Report' as const,
      recipient: 'rector@example.com',
      subject: 'Daily Report',
      body: 'Present: 1',
      attachment: null,
      dedupeKey: 'Daily Report|2026-11-04|rector@example.com',
      sendAfter: QUEUED_AT,
    };

    const first = await repository.queue([report]);
    const second = await repository.queue([report]);

    expect([first, second]).toEqual([1, 0]);
    expect(await rows()).toHaveLength(1);
  });

  it('gives back the attachment of a queued email when it is taken', async () => {
    await repository.queue([
      {
        kind: 'Daily Report',
        recipient: 'rector@example.com',
        subject: 'Daily Report',
        body: 'Present: 1',
        attachment: { filename: 'EVLOS Report 2026-11-04.csv', content: 'Student ID,Name' },
        dedupeKey: 'Daily Report|2026-11-04|rector@example.com',
        sendAfter: QUEUED_AT,
      },
    ]);

    const [taken] = await repository.takeDue(NOW, 10);

    expect(taken?.attachment).toEqual({
      filename: 'EVLOS Report 2026-11-04.csv',
      content: 'Student ID,Name',
    });
  });

  it('never takes an email that was given up', async () => {
    await queue('9001');
    const [taken] = await repository.takeDue(NOW, 10);

    await repository.markNotSent(taken?.id ?? 0, { status: 'failed' });

    expect(await repository.takeDue(LATER, 10)).toEqual([]);
    expect((await rows())[0]).toMatchObject({ status: 'failed', sentAt: null });
  });
});
