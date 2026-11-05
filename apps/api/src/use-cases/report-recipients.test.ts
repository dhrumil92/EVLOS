import { describe, expect, it } from 'vitest';
import { fakeReportRecipientRepository } from './fake-report-recipient-repository.js';
import {
  addReportRecipient,
  listReportRecipients,
  removeReportRecipient,
} from './report-recipients.js';

const NOW = Date.UTC(2026, 10, 5, 6, 0);
const RECTOR = 'rector@example.com';

function setUp(start: string[] = []) {
  const { reportRecipients, audit } = fakeReportRecipientRepository(start);
  return { deps: { reportRecipients, clock: { now: () => NOW } }, audit };
}

describe('Report Recipients', () => {
  it('adds an address and records who added it', async () => {
    const { deps, audit } = setUp();

    const result = await addReportRecipient('office@example.com', RECTOR, deps);

    expect(result).toBe('added');
    expect(await listReportRecipients(deps)).toEqual(['office@example.com']);
    expect(audit).toEqual([
      {
        action: 'Add Report Recipient',
        detail: 'office@example.com',
        doneAt: NOW,
        doneBy: RECTOR,
      },
    ]);
  });

  it('keeps an address in lower case, without spaces around it', async () => {
    const { deps } = setUp();

    await addReportRecipient('  Office@Example.COM ', RECTOR, deps);

    expect(await listReportRecipients(deps)).toEqual(['office@example.com']);
  });

  it('refuses text that is not an email address, and adds nothing', async () => {
    const { deps, audit } = setUp();

    const result = await addReportRecipient('office at example', RECTOR, deps);

    expect(result).toBe('not-an-email-address');
    expect(await listReportRecipients(deps)).toEqual([]);
    expect(audit).toEqual([]);
  });

  it('refuses an address that is already a Report Recipient, in any case', async () => {
    const { deps } = setUp(['office@example.com']);

    const result = await addReportRecipient('OFFICE@example.com', RECTOR, deps);

    expect(result).toBe('already-a-report-recipient');
    expect(await listReportRecipients(deps)).toEqual(['office@example.com']);
  });

  it('removes an address and records who removed it', async () => {
    const { deps, audit } = setUp(['office@example.com', 'rector@example.com']);

    const result = await removeReportRecipient('Office@example.com', RECTOR, deps);

    expect(result).toBe('removed');
    expect(await listReportRecipients(deps)).toEqual(['rector@example.com']);
    expect(audit).toEqual([
      {
        action: 'Remove Report Recipient',
        detail: 'office@example.com',
        doneAt: NOW,
        doneBy: RECTOR,
      },
    ]);
  });

  it('says so when the address to remove is not a Report Recipient', async () => {
    const { deps, audit } = setUp(['office@example.com']);

    const result = await removeReportRecipient('other@example.com', RECTOR, deps);

    expect(result).toBe('not-a-report-recipient');
    expect(audit).toEqual([]);
  });

  it('may remove the last Report Recipient, leaving none', async () => {
    const { deps } = setUp(['office@example.com']);

    await removeReportRecipient('office@example.com', RECTOR, deps);

    expect(await listReportRecipients(deps)).toEqual([]);
  });
});
