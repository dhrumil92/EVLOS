// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PoojaStatusName, ReportRequest, ReportSource } from './report-source.js';
import { StudentMonth } from './StudentMonth.js';

type Statuses = (PoojaStatusName | null)[];

function fakeReports(rows: Record<string, Statuses>, failing = false) {
  const asked: ReportRequest[] = [];
  const source: ReportSource = {
    load: (request) => {
      asked.push(request);
      if (failing) return Promise.reject(new Error('down'));
      return Promise.resolve({
        title: 'A month',
        isFinalized: false,
        reportDays: [],
        rows: Object.entries(rows).map(([studentId, statuses]) => ({
          studentId,
          name: `Student ${studentId}`,
          room: '101',
          statuses,
        })),
      });
    },
    csvUrl: () => '',
    xlsxUrl: () => '',
  };
  return { source, asked };
}

const NOVEMBER: Statuses = ['Present', 'Present', 'Absent', 'Not Applicable', 'Needs Review'];

function show(source: ReportSource, studentId = '9001', reloadWhen: unknown = 1) {
  return (
    <StudentMonth
      studentId={studentId}
      reports={source}
      today="2026-11-07"
      reloadWhen={reloadWhen}
    />
  );
}

afterEach(cleanup);

describe('the month in the Student panel', () => {
  it('asks for the month that holds today and names it', async () => {
    const { source, asked } = fakeReports({ '9001': NOVEMBER });

    render(show(source));

    expect(await screen.findByText('November 2026')).toBeTruthy();
    expect(asked).toEqual([{ view: 'Month', month: '2026-11' }]);
  });

  it('shows a box for each Day, labelled with its Pooja Status in words', async () => {
    const { source } = fakeReports({ '9001': NOVEMBER });

    render(show(source));

    expect(await screen.findByLabelText('1 November: Present')).toBeTruthy();
    expect(screen.getByLabelText('3 November: Absent')).toBeTruthy();
    expect(screen.getByLabelText('4 November: Not Applicable')).toBeTruthy();
    expect(screen.getByLabelText('5 November: Needs Review')).toBeTruthy();
  });

  it('shows only this Student, not the other Students in the Report', async () => {
    const { source } = fakeReports({ '9001': ['Present'], '9002': ['Absent'] });

    render(show(source));

    expect(await screen.findByLabelText('1 November: Present')).toBeTruthy();
    expect(screen.queryByLabelText('1 November: Absent')).toBeNull();
  });

  it('says what a Day with no Pooja Status means: not yet, or not Active', async () => {
    const { source } = fakeReports({ '9001': [null, 'Present'] });

    render(show(source));

    expect(await screen.findByLabelText('1 November: not Active')).toBeTruthy();
    expect(screen.getByLabelText('20 November: not yet')).toBeTruthy();
  });

  it('marks today', async () => {
    const { source } = fakeReports({ '9001': [...NOVEMBER, 'Present', 'Pending'] });

    render(show(source));

    expect(await screen.findByLabelText('7 November (today): Pending')).toBeTruthy();
  });

  it('counts the month in words', async () => {
    const { source } = fakeReports({ '9001': NOVEMBER });

    render(show(source));

    expect(
      await screen.findByText('2 Present, 1 Absent, 1 Not Applicable, 1 Needs Review'),
    ).toBeTruthy();
  });

  it('explains the colours with their words', async () => {
    const { source } = fakeReports({ '9001': NOVEMBER });

    render(show(source));

    await screen.findByText('November 2026');
    for (const word of ['Present', 'Absent', 'Not Applicable', 'Needs Review']) {
      expect(screen.getAllByText(word).length).toBeGreaterThan(0);
    }
  });

  it('says so when the Report has nothing for this Student', async () => {
    const { source } = fakeReports({ '9002': NOVEMBER });

    render(show(source));

    expect(await screen.findByText('No Pooja Status for this month.')).toBeTruthy();
  });

  it('says how to fix it when the month cannot be loaded', async () => {
    const { source } = fakeReports({}, true);

    render(show(source));

    expect(await screen.findByText(/month could not be loaded/i)).toBeTruthy();
  });

  it('opens the month before with the earlier-month arrow', async () => {
    const { source, asked } = fakeReports({ '9001': NOVEMBER });
    render(show(source));
    await screen.findByText('November 2026');

    fireEvent.click(screen.getByRole('button', { name: 'Earlier month' }));

    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(asked.at(-1)).toEqual({ view: 'Month', month: '2026-10' });
  });

  it('goes forward again, but never past the month that holds today', async () => {
    const { source } = fakeReports({ '9001': NOVEMBER });
    render(show(source));
    await screen.findByText('November 2026');
    const later = screen.getByRole<HTMLButtonElement>('button', { name: 'Later month' });
    expect(later.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Earlier month' }));
    await screen.findByText('October 2026');
    expect(later.disabled).toBe(false);
    fireEvent.click(later);

    expect(await screen.findByText('November 2026')).toBeTruthy();
  });

  it('loads the month again when the Student changes, so a saved Leave shows', async () => {
    const { source, asked } = fakeReports({ '9001': NOVEMBER });
    const { rerender } = render(show(source));
    await screen.findByText('November 2026');

    rerender(show(source, '9001', 2));

    await waitFor(() => {
      expect(asked).toHaveLength(2);
    });
  });
});
