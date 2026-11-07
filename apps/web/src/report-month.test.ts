import { describe, expect, it } from 'vitest';
import {
  axisOf,
  dayTotals,
  finalizedLine,
  floorsOf,
  PERIODS,
  requestFor,
  startPicks,
  studentsInMonth,
  withPick,
} from './report-month.js';
import type { PoojaStatusName, Report } from './report-source.js';

type Status = PoojaStatusName | null;

// One Student for each argument: [room, name, ...a Pooja Status for each Day].
function reportOf(students: [string, string, ...Status[]][], finalized: boolean[] = []): Report {
  const days = Math.max(...students.map((one) => one.length - 2), finalized.length);
  return {
    title: 'A month',
    isFinalized: finalized.every(Boolean),
    rows: students.map(([room, name, ...statuses]) => ({
      studentId: name,
      name,
      room,
      statuses,
    })),
    reportDays: Array.from({ length: days }, (_, index) => ({
      day: `2026-10-${String(index + 1).padStart(2, '0')}`,
      isFinalized: finalized[index] ?? true,
    })),
  };
}

describe('the periods the Rector can choose', () => {
  it('are Day, Month and Pick dates', () => {
    expect(PERIODS.map((one) => one.label)).toEqual(['Day', 'Month', 'Pick dates']);
  });

  it('start on today, this month, and this month from the 1st to today', () => {
    expect(startPicks('2026-11-07')).toEqual({
      day: '2026-11-07',
      month: '2026-11',
      from: '2026-11-01',
      to: '2026-11-07',
    });
  });

  it('ask the server for a Day, Month or Date range Report', () => {
    const picks = { day: '2026-11-05', month: '2026-10', from: '2026-10-05', to: '2026-10-20' };

    expect(requestFor('day', picks)).toEqual({ view: 'Day', day: '2026-11-05' });
    expect(requestFor('month', picks)).toEqual({ view: 'Month', month: '2026-10' });
    expect(requestFor('dates', picks)).toEqual({
      view: 'Date range',
      from: '2026-10-05',
      to: '2026-10-20',
    });
  });
});

describe('changing a date field', () => {
  const picks = { day: '2026-11-07', month: '2026-11', from: '2026-11-01', to: '2026-11-07' };

  it('changes only that field', () => {
    expect(withPick(picks, 'day', '2026-11-03')).toEqual({ ...picks, day: '2026-11-03' });
    expect(withPick(picks, 'to', '2026-11-05')).toEqual({ ...picks, to: '2026-11-05' });
  });

  it('never leaves To before From: a To before it becomes the From itself', () => {
    expect(withPick(picks, 'to', '2026-10-01').to).toBe('2026-11-01');
  });

  it('moves To along when From is changed to a later date than To', () => {
    expect(withPick(picks, 'from', '2026-11-09')).toMatchObject({
      from: '2026-11-09',
      to: '2026-11-09',
    });
  });

  it('allows From and To to be the same Day', () => {
    expect(withPick(picks, 'to', '2026-11-01')).toMatchObject({
      from: '2026-11-01',
      to: '2026-11-01',
    });
  });
});

describe('the totals for each Day', () => {
  it('count the Students with each Pooja Status on that Day', () => {
    const report = reportOf([
      ['101', 'Asha', 'Present', 'Absent'],
      ['102', 'Bina', 'Present', 'Not Applicable'],
      ['103', 'Chitra', 'Absent', 'Needs Review'],
    ]);

    expect(dayTotals(report)).toEqual([
      { day: '2026-10-01', present: 2, absent: 1, notApplicable: 0, needsReview: 0 },
      { day: '2026-10-02', present: 0, absent: 1, notApplicable: 1, needsReview: 1 },
    ]);
  });

  it('do not count a Day the Student was not Active', () => {
    const report = reportOf([
      ['101', 'Asha', null, 'Present'],
      ['102', 'Bina', 'Absent', 'Present'],
    ]);

    expect(dayTotals(report)[0]).toMatchObject({ present: 0, absent: 1 });
  });
});

describe('the line about Finalize', () => {
  it('says every Day is Finalized when it is', () => {
    expect(finalizedLine(reportOf([], [true, true, true]))).toBe('3 Days, all Finalized');
  });

  it('says how many Days are not Finalized', () => {
    expect(finalizedLine(reportOf([], [true, false, false, true]))).toBe('4 Days, 2 not Finalized');
  });

  it('says only Finalized or Not Finalized for one Day', () => {
    expect(finalizedLine(reportOf([], [true]))).toBe('Finalized');
    expect(finalizedLine(reportOf([], [false]))).toBe('Not Finalized');
  });
});

describe('the floors of a Report', () => {
  it('are the first digits of the rooms, lowest first, each once', () => {
    const report = reportOf([
      ['305', 'Asha', 'Present'],
      ['101', 'Bina', 'Present'],
      ['110', 'Chitra', 'Present'],
      ['204', 'Deepa', 'Present'],
    ]);

    expect(floorsOf(report)).toEqual([1, 2, 3]);
  });

  it('leave out a room that does not start with a digit', () => {
    expect(floorsOf(reportOf([['A-1', 'Asha', 'Present']]))).toEqual([]);
  });
});

describe('the Students of a Report', () => {
  const report = reportOf([
    ['103', 'Chitra', 'Present', 'Present', 'Present'],
    ['102', 'Bina', 'Absent', 'Present', 'Not Applicable'],
    ['101', 'Asha', 'Absent', 'Absent', 'Present'],
    ['204', 'Deepa', 'Absent', 'Present', 'Present'],
  ]);

  it('are every Student, the most Absent first, then by room', () => {
    expect(studentsInMonth(report, null).map((one) => one.name)).toEqual([
      'Asha',
      'Bina',
      'Deepa',
      'Chitra',
    ]);
  });

  it('include a Student who was never Absent', () => {
    expect(studentsInMonth(report, null).map((one) => one.name)).toContain('Chitra');
  });

  it('can be only those on one floor', () => {
    expect(studentsInMonth(report, 1).map((one) => one.name)).toEqual(['Asha', 'Bina', 'Chitra']);
    expect(studentsInMonth(report, 2).map((one) => one.name)).toEqual(['Deepa']);
  });

  it('count the Days of each Pooja Status', () => {
    const bina = studentsInMonth(report, null).find((one) => one.name === 'Bina');

    expect(bina).toMatchObject({ present: 1, absent: 1, notApplicable: 1 });
  });

  it('keep the Pooja Status of each Day for the strip of squares', () => {
    const asha = studentsInMonth(report, null)[0];

    expect(asha?.cells).toEqual(['Absent', 'Absent', 'Present']);
  });
});

describe('the side of the chart', () => {
  it('reaches the tallest bar, rounded up to a round number', () => {
    expect(axisOf(38)).toEqual({ ticks: [0, 10, 20, 30, 40], max: 40 });
    expect(axisOf(11)).toEqual({ ticks: [0, 5, 10, 15], max: 15 });
  });

  it('has round steps and stops at a number that holds the tallest bar', () => {
    expect(axisOf(60)).toEqual({ ticks: [0, 20, 40, 60], max: 60 });
    expect(axisOf(47)).toEqual({ ticks: [0, 20, 40, 60], max: 60 });
    expect(axisOf(5)).toEqual({ ticks: [0, 2, 4, 6], max: 6 });
  });

  it('never has a maximum of zero, so there is nothing to divide by zero', () => {
    expect(axisOf(0).max).toBeGreaterThan(0);
  });
});
