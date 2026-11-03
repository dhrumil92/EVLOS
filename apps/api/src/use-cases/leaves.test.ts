import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { deactivateStudent } from './deactivate-and-activate.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { cancelLeave, editLeave, recordLeave, returnLeave } from './leaves.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
// An instant in November 2026 at the given IST clock time.
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;

const NOW = ist(3, 21, 0);
const RECTOR = 'rector@example.com';
const LEAVE_FORM = {
  outDay: '2026-11-03',
  outTime: '08:15',
  expectedReturnDay: '2026-11-05',
  expectedReturnTime: '18:00',
};
const RETURN_FORM = { returnDay: '2026-11-03', returnTime: '19:30' };

async function setUp() {
  const studentsFake = fakeStudentRepository();
  const leavesFake = fakeLeaveRepository();
  const deps = {
    students: studentsFake.students,
    leaves: leavesFake.leaves,
    clock: { now: () => NOW },
  };
  await addStudent(
    { studentId: '9001', name: 'Test', room: '101', email: 'a@example.com', phone: '' },
    { ...deps, clock: { now: () => ist(1, 10) } },
  );
  return { ...leavesFake, deps };
}

describe('recordLeave', () => {
  it('opens a Leave with the IST times typed', async () => {
    const { deps, stored, audit } = await setUp();

    const result = await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'done' });
    expect(stored[0]).toMatchObject({
      outAt: ist(3, 8, 15),
      expectedReturnAt: ist(5, 18, 0),
      returnedAt: null,
    });
    expect(audit[0]).toMatchObject({ action: 'Leave', doneBy: RECTOR, at: NOW });
  });

  it('refuses a time that is not a real date and time', async () => {
    const { deps, stored } = await setUp();

    const result = await recordLeave('9001', { ...LEAVE_FORM, outTime: '25:00' }, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'invalid-time' });
    expect(stored).toEqual([]);
  });

  it('refuses with the core reason, such as an Out Time later than now', async () => {
    const { deps } = await setUp();

    const result = await recordLeave('9001', { ...LEAVE_FORM, outTime: '21:01' }, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'out-time-in-future' });
  });

  it('refuses a second Leave while one is open', async () => {
    const { deps } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'already-away' });
  });

  it('refuses an unknown Student ID', async () => {
    const { deps } = await setUp();

    const result = await recordLeave('9999', LEAVE_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'unknown-student' });
  });

  it('refuses a Leave for a Deactivated Student', async () => {
    const { deps } = await setUp();
    await deactivateStudent('9001', RECTOR, deps);

    const result = await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'not-active' });
  });
});

describe('editLeave', () => {
  it('changes the Expected Return of the open Leave', async () => {
    const { deps, stored, audit } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await editLeave(
      '9001',
      { ...LEAVE_FORM, expectedReturnDay: '2026-11-08' },
      RECTOR,
      deps,
    );

    expect(result).toEqual({ outcome: 'done' });
    expect(stored[0]?.expectedReturnAt).toBe(ist(8, 18, 0));
    expect(audit.map((entry) => entry.action)).toEqual(['Leave', 'Edit Leave']);
  });

  it('does not count the Leave being edited as another open Leave', async () => {
    const { deps } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await editLeave('9001', { ...LEAVE_FORM, outTime: '07:00' }, RECTOR, deps);

    expect(result).toEqual({ outcome: 'done' });
  });

  it('refuses an Expected Return earlier than the Out Time', async () => {
    const { deps } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await editLeave(
      '9001',
      { ...LEAVE_FORM, expectedReturnDay: '2026-11-02' },
      RECTOR,
      deps,
    );

    expect(result).toEqual({ outcome: 'refused', reason: 'expected-return-before-out' });
  });

  it('refuses when he has no open Leave', async () => {
    const { deps } = await setUp();

    const result = await editLeave('9001', LEAVE_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'no-open-leave' });
  });
});

describe('cancelLeave', () => {
  it('cancels the open Leave, so he is in hostel again', async () => {
    const { deps, audit } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await cancelLeave('9001', RECTOR, deps);

    expect(result).toEqual({ outcome: 'done' });
    expect(await deps.leaves.openLeaves()).toEqual([]);
    expect(audit.map((entry) => entry.action)).toEqual(['Leave', 'Cancel Leave']);
  });

  it('refuses when he has no open Leave', async () => {
    const { deps } = await setUp();

    expect(await cancelLeave('9001', RECTOR, deps)).toEqual({
      outcome: 'refused',
      reason: 'no-open-leave',
    });
  });
});

describe('returnLeave', () => {
  it('closes the open Leave with the Return Time typed', async () => {
    const { deps, stored, audit } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await returnLeave('9001', RETURN_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'done' });
    expect(stored[0]).toMatchObject({
      expectedReturnAt: ist(5, 18, 0),
      returnedAt: ist(3, 19, 30),
    });
    expect(audit.map((entry) => entry.action)).toEqual(['Leave', 'Return']);
  });

  it('refuses a Return Time earlier than the Out Time', async () => {
    const { deps } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await returnLeave('9001', { ...RETURN_FORM, returnTime: '08:00' }, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'return-before-out' });
  });

  it('refuses a Return Time that is not a real time', async () => {
    const { deps } = await setUp();
    await recordLeave('9001', LEAVE_FORM, RECTOR, deps);

    const result = await returnLeave('9001', { ...RETURN_FORM, returnTime: '' }, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'invalid-time' });
  });

  it('refuses when he has no open Leave', async () => {
    const { deps } = await setUp();

    const result = await returnLeave('9001', RETURN_FORM, RECTOR, deps);

    expect(result).toEqual({ outcome: 'refused', reason: 'no-open-leave' });
  });
});
