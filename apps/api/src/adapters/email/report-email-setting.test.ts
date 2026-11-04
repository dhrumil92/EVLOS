import { describe, expect, it } from 'vitest';
import { reportEmailAddressesFrom } from './report-email-setting.js';

describe('reportEmailAddressesFrom', () => {
  it('reads one address', () => {
    expect(reportEmailAddressesFrom({ REPORT_EMAIL: 'rector@example.com' })).toEqual([
      'rector@example.com',
    ]);
  });

  it('reads several addresses split by commas, ignoring spaces and empty entries', () => {
    const addresses = reportEmailAddressesFrom({
      REPORT_EMAIL: ' rector@example.com, ,office@example.com ,',
    });

    expect(addresses).toEqual(['rector@example.com', 'office@example.com']);
  });

  it('gives each address once, even when it is written twice', () => {
    expect(
      reportEmailAddressesFrom({ REPORT_EMAIL: 'rector@example.com,rector@example.com' }),
    ).toEqual(['rector@example.com']);
  });

  it('is empty when REPORT_EMAIL is not set', () => {
    expect(reportEmailAddressesFrom({})).toEqual([]);
  });

  it('refuses an entry that is not an email address, saying which entry', () => {
    expect(() => reportEmailAddressesFrom({ REPORT_EMAIL: 'rector@example.com, office' })).toThrow(
      'REPORT_EMAIL entry 2 is not an email address',
    );
  });
});
