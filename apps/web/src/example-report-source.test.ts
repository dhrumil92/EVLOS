import { describe, expect, it } from 'vitest';
import { exampleReportSource } from './example-report-source.js';

const source = exampleReportSource('2026-11-03');

describe('example Reports', () => {
  it('lists 360 Students with different Student IDs, marked as example data', async () => {
    const report = await source.load({ view: 'Day', day: '2026-11-02' });

    expect(report.isExample).toBe(true);
    expect(report.rows).toHaveLength(360);
    expect(new Set(report.rows.map((row) => row.studentId)).size).toBe(360);
  });

  it('has hour bars that add up to the Students Present', async () => {
    const report = await source.load({ view: 'Day', day: '2026-11-02' });

    const present = report.rows.filter((row) => row.statuses[0] === 'Present').length;

    expect(report.hours?.reduce((sum, hour) => sum + hour, 0)).toBe(present);
  });

  it('shows Absent on a past Day, which is treated as Finalized', async () => {
    const report = await source.load({ view: 'Day', day: '2026-11-02' });

    expect(report.isFinalized).toBe(true);
    expect(report.rows.some((row) => row.statuses[0] === 'Absent')).toBe(true);
    expect(report.rows.some((row) => row.statuses[0] === 'Needs Review')).toBe(false);
  });

  it('shows Needs Review and never Absent on a Day that is not Finalized', async () => {
    const report = await source.load({ view: 'Day', day: '2026-11-03' });

    expect(report.isFinalized).toBe(false);
    expect(report.rows.some((row) => row.statuses[0] === 'Needs Review')).toBe(true);
    expect(report.rows.some((row) => row.statuses[0] === 'Absent')).toBe(false);
  });

  it('gives a month Report one set of totals for each Day, adding up to 360', async () => {
    const report = await source.load({ view: 'Month', month: '2026-10' });

    expect(report.days).toHaveLength(31);
    const first = report.days?.[0];
    expect((first?.present ?? 0) + (first?.absent ?? 0) + (first?.notApplicable ?? 0)).toBe(360);
    expect(report.hours).toBeNull();
  });

  it('stops a month Report at today', async () => {
    const report = await source.load({ view: 'Month', month: '2026-11' });

    expect(report.days?.map((day) => day.day)).toEqual([1, 2, 3]);
  });
});
