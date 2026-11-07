import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { deactivateStudent } from './deactivate-and-activate.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { getVidyalayaPresence } from './get-vidyalaya-presence.js';
import { recordLeave, returnLeave } from './leaves.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const RECTOR = 'rector@example.com';

// A clock that can be moved, because Students are added and Leaves are recorded on other Days.
function setUp(students: readonly (readonly [string, string, string])[], addedOn = 1) {
  const clock = { at: ist(addedOn, 10) };
  const { students: studentRepository } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  // No Punches here: Vidyalaya Presence is worked out from Leaves only.
  const deps = { students: studentRepository, leaves, clock: { now: () => clock.at } };
  return { clock, deps, students };
}

async function addAll(setup: ReturnType<typeof setUp>) {
  for (const [studentId, name, room] of setup.students) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      setup.deps,
    );
  }
}

const AWAY_FROM_2_NOV = {
  outDay: '2026-11-02',
  outTime: '18:00',
  expectedReturnDay: '2026-11-05',
  expectedReturnTime: '18:00',
};

const TWO = [
  ['9001', 'Asha Rao', '101'],
  ['9002', 'Bina Rao', '205'],
] as const;

describe('getVidyalayaPresence for a Day', () => {
  it('says In hostel for a Student with no Leave', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-03' }, setup.deps);

    expect(result?.days).toEqual(['2026-11-03']);
    expect(result?.rows.map((row) => [row.name, row.states])).toEqual([
      ['Asha Rao', ['In hostel']],
      ['Bina Rao', ['In hostel']],
    ]);
  });

  it('says Away on a Day after the Out Time, while he has not returned', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);
    await recordLeave('9002', AWAY_FROM_2_NOV, RECTOR, setup.deps);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-03' }, setup.deps);

    expect(result?.rows.map((row) => row.states)).toEqual([['In hostel'], ['Away']]);
  });

  it('says In hostel on the Day he returns', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);
    await recordLeave('9002', AWAY_FROM_2_NOV, RECTOR, setup.deps);
    await returnLeave('9002', { returnDay: '2026-11-03', returnTime: '09:00' }, RECTOR, setup.deps);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-03' }, setup.deps);

    expect(result?.rows.map((row) => row.states)).toEqual([['In hostel'], ['In hostel']]);
  });

  it('shows a Leave recorded late: nothing is locked', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(2, 23, 30);
    const before = await getVidyalayaPresence({ view: 'Day', day: '2026-11-02' }, setup.deps);

    // The Rector enters last night's leave note the next morning, with the Out Time of 22:30.
    setup.clock.at = ist(3, 9);
    await recordLeave('9001', { ...AWAY_FROM_2_NOV, outTime: '22:30' }, RECTOR, setup.deps);
    const after = await getVidyalayaPresence({ view: 'Day', day: '2026-11-02' }, setup.deps);

    expect(before?.rows.map((row) => row.states)).toEqual([['In hostel'], ['In hostel']]);
    expect(after?.rows.map((row) => row.states)).toEqual([['Away'], ['In hostel']]);
  });

  it('is refused for a Day after today, and for a Day that is not a date', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    expect(await getVidyalayaPresence({ view: 'Day', day: '2026-11-04' }, setup.deps)).toBeNull();
    expect(await getVidyalayaPresence({ view: 'Day', day: '2026-02-30' }, setup.deps)).toBeNull();
  });
});

describe('getVidyalayaPresence for a month', () => {
  it('has a state for each Day of the month up to today', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);
    await recordLeave('9002', AWAY_FROM_2_NOV, RECTOR, setup.deps);

    const result = await getVidyalayaPresence({ view: 'Month', month: '2026-11' }, setup.deps);

    expect(result?.days).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(result?.rows.map((row) => row.states)).toEqual([
      ['In hostel', 'In hostel', 'In hostel'],
      ['In hostel', 'Away', 'Away'],
    ]);
  });

  it('is In hostel again from the Day he returns', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);
    await recordLeave('9002', AWAY_FROM_2_NOV, RECTOR, setup.deps);
    await returnLeave('9002', { returnDay: '2026-11-03', returnTime: '19:00' }, RECTOR, setup.deps);

    const result = await getVidyalayaPresence({ view: 'Month', month: '2026-11' }, setup.deps);

    expect(result?.rows[1]?.states).toEqual(['In hostel', 'Away', 'In hostel']);
  });

  it('lists the Students by room in ascending order, whatever order they were added in', async () => {
    const setup = setUp([
      ['9003', 'Chitra Rao', '201'],
      ['9001', 'Asha Rao', '110'],
      ['9002', 'Bina Rao', '102'],
      ['9004', 'Deepa Rao', '101'],
    ]);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-03' }, setup.deps);

    expect(result?.rows.map((row) => row.room)).toEqual(['101', '102', '110', '201']);
  });

  it('puts Students in one room in order of name', async () => {
    const setup = setUp([
      ['9002', 'Bina Rao', '101'],
      ['9001', 'Asha Rao', '101'],
    ]);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-03' }, setup.deps);

    expect(result?.rows.map((row) => row.name)).toEqual(['Asha Rao', 'Bina Rao']);
  });

  it('leaves a Day empty before a Student was added', async () => {
    const setup = setUp([['9001', 'Asha Rao', '101']], 2);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    const result = await getVidyalayaPresence({ view: 'Month', month: '2026-11' }, setup.deps);

    expect(result?.rows[0]?.states).toEqual([null, 'In hostel', 'In hostel']);
  });

  it('leaves a Day empty from the Day a Student was Deactivated, and keeps the Days before', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 10);
    await deactivateStudent('9002', RECTOR, setup.deps);
    setup.clock.at = ist(3, 21);

    const result = await getVidyalayaPresence({ view: 'Month', month: '2026-11' }, setup.deps);

    expect(result?.rows.map((row) => row.states)).toEqual([
      ['In hostel', 'In hostel', 'In hostel'],
      ['In hostel', 'In hostel', null],
    ]);
  });

  it('leaves out a Student who was not Active on any Day asked for', async () => {
    const setup = setUp([['9001', 'Asha Rao', '101']], 5);
    await addAll(setup);
    setup.clock.at = ist(6, 21);

    const result = await getVidyalayaPresence({ view: 'Day', day: '2026-11-02' }, setup.deps);

    expect(result?.rows).toEqual([]);
  });

  it('is refused for a month that is not a month, or has not begun', async () => {
    const setup = setUp(TWO);
    await addAll(setup);
    setup.clock.at = ist(3, 21);

    expect(await getVidyalayaPresence({ view: 'Month', month: 'November' }, setup.deps)).toBeNull();
    expect(await getVidyalayaPresence({ view: 'Month', month: '2026-12' }, setup.deps)).toBeNull();
  });
});
