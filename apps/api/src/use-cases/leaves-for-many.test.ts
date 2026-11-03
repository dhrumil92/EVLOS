import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { recordLeaves, returnLeaves } from './leaves-for-many.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 3, 21, 0) - IST_OFFSET_MS;
const RECTOR = 'rector@example.com';
const leaveRow = (studentId: string, outTime = '08:00', expectedReturnTime = '18:00') => ({
  studentId,
  outDay: '2026-11-03',
  outTime,
  expectedReturnDay: '2026-11-05',
  expectedReturnTime,
});
const returnRow = (studentId: string, returnTime = '19:00') => ({
  studentId,
  returnDay: '2026-11-03',
  returnTime,
});

async function setUp() {
  const { students } = fakeStudentRepository();
  const leavesFake = fakeLeaveRepository();
  const deps = { students, leaves: leavesFake.leaves, clock: { now: () => NOW } };
  for (const studentId of ['9001', '9002', '9003']) {
    await addStudent(
      { studentId, name: 'Test', room: '101', email: 'a@example.com', phone: '' },
      { ...deps, clock: { now: () => NOW - 3 * 24 * 60 * 60 * 1000 } },
    );
  }
  return { ...leavesFake, deps };
}

describe('recordLeaves', () => {
  it('records a Leave for each row, each with its own times', async () => {
    const { deps, stored } = await setUp();

    const results = await recordLeaves(
      [leaveRow('9001', '08:00'), leaveRow('9002', '17:30')],
      RECTOR,
      deps,
    );

    expect(results).toEqual([
      { studentId: '9001', outcome: 'done' },
      { studentId: '9002', outcome: 'done' },
    ]);
    expect(stored.map((leave) => leave.outAt)).toEqual([
      Date.UTC(2026, 10, 3, 8, 0) - IST_OFFSET_MS,
      Date.UTC(2026, 10, 3, 17, 30) - IST_OFFSET_MS,
    ]);
  });

  it('blocks only the row that is refused and saves the others', async () => {
    const { deps, stored } = await setUp();

    const results = await recordLeaves(
      [leaveRow('9001'), leaveRow('9002', '08:00', 'xx'), leaveRow('9003')],
      RECTOR,
      deps,
    );

    expect(results[1]).toEqual({ studentId: '9002', outcome: 'refused', reason: 'invalid-time' });
    expect(stored.map((leave) => leave.studentId)).toEqual(['9001', '9003']);
  });

  it('skips a Student who is already Away', async () => {
    const { deps } = await setUp();
    await recordLeaves([leaveRow('9001')], RECTOR, deps);

    const [result] = await recordLeaves([leaveRow('9001')], RECTOR, deps);

    expect(result).toEqual({ studentId: '9001', outcome: 'refused', reason: 'already-away' });
  });

  it('writes one audit entry per Leave', async () => {
    const { deps, audit } = await setUp();

    await recordLeaves([leaveRow('9001'), leaveRow('9002')], RECTOR, deps);

    expect(audit.map((entry) => [entry.action, entry.studentId])).toEqual([
      ['Leave', '9001'],
      ['Leave', '9002'],
    ]);
  });
});

describe('returnLeaves', () => {
  it('records each Return Time and skips a Student who is not Away', async () => {
    const { deps, stored } = await setUp();
    await recordLeaves([leaveRow('9001'), leaveRow('9002')], RECTOR, deps);

    const results = await returnLeaves(
      [returnRow('9001', '19:00'), returnRow('9002', '20:15'), returnRow('9003')],
      RECTOR,
      deps,
    );

    expect(results).toEqual([
      { studentId: '9001', outcome: 'done' },
      { studentId: '9002', outcome: 'done' },
      { studentId: '9003', outcome: 'refused', reason: 'no-open-leave' },
    ]);
    expect(stored.map((leave) => leave.returnedAt)).toEqual([
      Date.UTC(2026, 10, 3, 19, 0) - IST_OFFSET_MS,
      Date.UTC(2026, 10, 3, 20, 15) - IST_OFFSET_MS,
    ]);
  });
});
