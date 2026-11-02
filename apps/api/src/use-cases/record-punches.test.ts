import { describe, expect, it } from 'vitest';
import type { PunchRepository, ReceivedPunch } from '../ports/punch-repository.js';
import { recordPunches } from './record-punches.js';

const RECEIVED_AT = Date.UTC(2026, 10, 10, 2, 0, 0);
const PUNCHED_AT = Date.UTC(2026, 10, 10, 1, 30, 0);

class FakePunchRepository implements PunchRepository {
  readonly stored: ReceivedPunch[] = [];

  record(punch: ReceivedPunch): Promise<boolean> {
    const isNew = !this.stored.some(
      (known) => known.studentId === punch.studentId && known.punchedAt === punch.punchedAt,
    );
    if (isNew) {
      this.stored.push(punch);
    }
    return Promise.resolve(isNew);
  }
}

const deps = (punches: PunchRepository) => ({ punches, clock: { now: () => RECEIVED_AT } });

describe('recordPunches', () => {
  it('stores a Punch with its Device Serial and the time it was received', async () => {
    const punches = new FakePunchRepository();

    await recordPunches(
      'TEST-DEVICE',
      [{ studentId: '9001', punchedAt: PUNCHED_AT }],
      deps(punches),
    );

    expect(punches.stored).toEqual([
      {
        deviceSerial: 'TEST-DEVICE',
        studentId: '9001',
        punchedAt: PUNCHED_AT,
        receivedAt: RECEIVED_AT,
      },
    ]);
  });

  it('counts only the Punches that were new', async () => {
    const punches = new FakePunchRepository();
    const uploaded = [{ studentId: '9001', punchedAt: PUNCHED_AT }];
    await recordPunches('TEST-DEVICE', uploaded, deps(punches));

    const newPunches = await recordPunches('TEST-DEVICE', uploaded, deps(punches));

    expect(newPunches).toBe(0);
  });
});
