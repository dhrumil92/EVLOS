import type { Punch } from '@evlos/core';
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

  punchesOn(): Promise<Punch[]> {
    return Promise.resolve(this.stored);
  }
}

const buildDeps = (punches: PunchRepository) => {
  const feed = { changes: 0 };
  return {
    feed,
    deps: {
      punches,
      clock: { now: () => RECEIVED_AT },
      liveFeed: {
        punchesChanged: () => {
          feed.changes += 1;
        },
      },
    },
  };
};

const uploaded = [{ studentId: '9001', punchedAt: PUNCHED_AT }];

describe('recordPunches', () => {
  it('stores a Punch with its Device Serial and the time it was received', async () => {
    const punches = new FakePunchRepository();

    await recordPunches('TEST-DEVICE', uploaded, buildDeps(punches).deps);

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
    const { deps } = buildDeps(new FakePunchRepository());
    await recordPunches('TEST-DEVICE', uploaded, deps);

    const newPunches = await recordPunches('TEST-DEVICE', uploaded, deps);

    expect(newPunches).toBe(0);
  });

  it('tells the live view once per upload, however many Punches it held', async () => {
    const { deps, feed } = buildDeps(new FakePunchRepository());
    const two = [...uploaded, { studentId: '9002', punchedAt: PUNCHED_AT }];

    await recordPunches('TEST-DEVICE', two, deps);

    expect(feed.changes).toBe(1);
  });

  it('does not tell the live view about a re-upload', async () => {
    const { deps, feed } = buildDeps(new FakePunchRepository());
    await recordPunches('TEST-DEVICE', uploaded, deps);

    await recordPunches('TEST-DEVICE', uploaded, deps);

    expect(feed.changes).toBe(1);
  });
});
