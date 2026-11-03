import type { Punch } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import type { PunchRepository } from '../ports/punch-repository.js';
import { addStudent } from './add-student.js';
import { deactivateStudent } from './deactivate-and-activate.js';
import { fakeFinalizeRepository } from './fake-finalize-repository.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { getReport } from './get-report.js';
import { recordLeave } from './leaves.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
// 21:00 IST on 3 November: the Pooja Window of 3 November has closed.
const NOW = ist(3, 21);
const RECTOR = 'rector@example.com';

function fakePunches(punches: Punch[]): PunchRepository {
  return {
    record: () => Promise.resolve(true),
    punchesOn: () => Promise.resolve([]),
    punchesBetween: () => Promise.resolve(punches),
  };
}

async function setUp(punches: Punch[] = [], addedOn = 1) {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  const { finalized } = fakeFinalizeRepository();
  const deps = {
    students,
    leaves,
    finalized,
    punches: fakePunches(punches),
    clock: { now: () => NOW },
  };
  for (const [studentId, name, room] of [
    ['9001', 'Asha Rao', '101'],
    ['9002', 'Bina Rao', '205'],
  ] as const) {
    await addStudent(
      { studentId, name, room, email: `${studentId}@example.com`, phone: '' },
      { ...deps, clock: { now: () => ist(addedOn, 10) } },
    );
  }
  return deps;
}

describe('getReport for a Day', () => {
  it('gives each Active Student his Pooja Status from Punches and Leaves', async () => {
    const deps = await setUp([{ studentId: '9001', punchedAt: ist(3, 7) }]);
    await recordLeave(
      '9002',
      {
        outDay: '2026-11-02',
        outTime: '18:00',
        expectedReturnDay: '2026-11-05',
        expectedReturnTime: '18:00',
      },
      RECTOR,
      deps,
    );

    const report = await getReport({ view: 'Day', day: '2026-11-03' }, deps);

    expect(report?.rows).toEqual([
      { studentId: '9001', name: 'Asha Rao', room: '101', statuses: ['Present'] },
      { studentId: '9002', name: 'Bina Rao', room: '205', statuses: ['Not Applicable'] },
    ]);
  });

  it('shows Needs Review, not Absent, for a past Day that is not Finalized', async () => {
    const deps = await setUp();

    const report = await getReport({ view: 'Day', day: '2026-11-02' }, deps);

    expect(report?.rows.map((row) => row.statuses)).toEqual([['Needs Review'], ['Needs Review']]);
    expect(report?.isFinalized).toBe(false);
  });

  it('leaves out a Student who was not Active on the Day', async () => {
    const deps = await setUp();
    await deactivateStudent('9002', RECTOR, deps);

    const report = await getReport({ view: 'Day', day: '2026-11-03' }, deps);

    expect(report?.rows.map((row) => row.studentId)).toEqual(['9001']);
  });

  it('counts Present Students by the hour of their first Punch from 05:30', async () => {
    const deps = await setUp([
      { studentId: '9001', punchedAt: ist(3, 6, 45) },
      { studentId: '9001', punchedAt: ist(3, 9) },
      { studentId: '9002', punchedAt: ist(3, 5, 31) },
    ]);

    const report = await getReport({ view: 'Day', day: '2026-11-03' }, deps);

    expect(report?.hours).toEqual([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(report?.days).toBeNull();
  });

  it('does not count a Punch from an unknown Student ID', async () => {
    const deps = await setUp([{ studentId: '9999', punchedAt: ist(3, 7) }]);

    const report = await getReport({ view: 'Day', day: '2026-11-03' }, deps);

    expect(report?.hours?.reduce((sum, count) => sum + count, 0)).toBe(0);
  });
});

describe('getReport for a month', () => {
  it('gives one Pooja Status per Day up to today, empty before he was added', async () => {
    const deps = await setUp([], 2);

    const report = await getReport({ view: 'Month', month: '2026-11' }, deps);

    expect(report?.rows[0]?.statuses).toEqual([null, 'Needs Review', 'Needs Review']);
  });

  it('totals Present, Absent and Not Applicable for each Day', async () => {
    const deps = await setUp([{ studentId: '9001', punchedAt: ist(2, 7) }]);

    const report = await getReport({ view: 'Month', month: '2026-11' }, deps);

    expect(report?.days?.[1]).toEqual({ day: 2, present: 1, absent: 0, notApplicable: 0 });
    expect(report?.hours).toBeNull();
  });
});

describe('getReport refuses', () => {
  it.each([
    ['a Day after today', { view: 'Day', day: '2026-11-04' }],
    ['a date that does not exist', { view: 'Day', day: '2026-02-30' }],
    ['a month after this one', { view: 'Month', month: '2026-12' }],
    [
      'a range that ends before it starts',
      { view: 'Date range', from: '2026-11-03', to: '2026-11-01' },
    ],
    ['a range of more than 366 Days', { view: 'Date range', from: '2025-01-01', to: '2026-11-03' }],
  ] as const)('%s', async (_what, request) => {
    const deps = await setUp();

    expect(await getReport(request, deps)).toBeNull();
  });

  it('stops a range at today', async () => {
    const deps = await setUp();

    const report = await getReport(
      { view: 'Date range', from: '2026-11-01', to: '2026-11-30' },
      deps,
    );

    expect(report?.rows[0]?.statuses).toHaveLength(3);
  });
});

describe('getReport for a Finalized Day', () => {
  const absent = (studentId: string) => ({
    studentId,
    status: 'Absent' as const,
    firstPunchAt: null,
  });

  it('reads the saved Pooja Statuses, so a later Leave cannot change them', async () => {
    const deps = await setUp();
    await deps.finalized.finalize('2026-11-02', [absent('9001'), absent('9002')], NOW, RECTOR);
    await recordLeave(
      '9001',
      {
        outDay: '2026-11-02',
        outTime: '05:00',
        expectedReturnDay: '2026-11-03',
        expectedReturnTime: '18:00',
      },
      RECTOR,
      deps,
    );

    const report = await getReport({ view: 'Day', day: '2026-11-02' }, deps);

    expect(report?.isFinalized).toBe(true);
    expect(report?.rows.map((row) => row.statuses)).toEqual([['Absent'], ['Absent']]);
  });

  it('leaves out a Student with no saved result, as he was not Active then', async () => {
    const deps = await setUp();
    await deps.finalized.finalize('2026-11-02', [absent('9001')], NOW, RECTOR);

    const report = await getReport({ view: 'Day', day: '2026-11-02' }, deps);

    expect(report?.rows.map((row) => row.studentId)).toEqual(['9001']);
  });

  it('places Present Students by their saved first Punch', async () => {
    const deps = await setUp();
    await deps.finalized.finalize(
      '2026-11-02',
      [{ studentId: '9001', status: 'Present', firstPunchAt: ist(2, 8, 15) }],
      NOW,
      RECTOR,
    );

    const report = await getReport({ view: 'Day', day: '2026-11-02' }, deps);

    expect(report?.hours?.[2]).toBe(1);
  });

  it('marks a month Finalized only when every Day in it is', async () => {
    const deps = await setUp();
    await deps.finalized.finalize('2026-11-02', [absent('9001')], NOW, RECTOR);

    const report = await getReport({ view: 'Month', month: '2026-11' }, deps);

    expect(report?.isFinalized).toBe(false);
    expect(report?.rows[0]?.statuses).toEqual(['Needs Review', 'Absent', 'Needs Review']);
  });
});
