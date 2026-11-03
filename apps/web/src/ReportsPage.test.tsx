// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Report, ReportRequest, ReportRow, ReportSource } from './report-source.js';
import { ReportsPage } from './ReportsPage.js';

const TODAY = '2026-11-03';

const rows: ReportRow[] = [
  { studentId: '9002', name: 'Bina Rao', room: 'B-101', statuses: ['Present'] },
  { studentId: '9001', name: 'Asha Rao', room: 'C-101', statuses: ['Absent'] },
  { studentId: '9003', name: 'Chitra Rao', room: 'A-101', statuses: ['Not Applicable'] },
];

const report = (facts: Partial<Report> = {}): Report => ({
  title: 'Monday 2 November 2026',
  isFinalized: true,
  rows,
  hours: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  days: null,
  ...facts,
});

function fakeSource(answer: (request: ReportRequest) => Report = () => report()) {
  const asked: ReportRequest[] = [];
  const source: ReportSource = {
    load: (request) => {
      asked.push(request);
      return Promise.resolve(answer(request));
    },
  };
  return { source, asked };
}

const studentNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

afterEach(cleanup);

describe('Reports page', () => {
  it('opens on the Report for today', async () => {
    const { source, asked } = fakeSource();

    render(<ReportsPage source={source} today={TODAY} />);

    await screen.findByText('Bina Rao');
    expect(asked[0]).toEqual({ view: 'Day', day: TODAY });
  });

  it('lists Students by room in ascending order first', async () => {
    render(<ReportsPage source={fakeSource().source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    expect(studentNames()).toEqual(['Chitra Rao', 'Bina Rao', 'Asha Rao']);
  });

  it('can sort Students by name', async () => {
    render(<ReportsPage source={fakeSource().source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'Name' } });

    expect(studentNames()).toEqual(['Asha Rao', 'Bina Rao', 'Chitra Rao']);
  });

  it.each([
    ['Present', 'Bina Rao'],
    ['Absent', 'Asha Rao'],
    ['Not Applicable', 'Chitra Rao'],
  ])('can show only the Students who are %s', async (status, name) => {
    render(<ReportsPage source={fakeSource().source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: status }));

    expect(studentNames()).toEqual([name]);
    expect(screen.getByText('Showing 1 of 3 Students')).toBeTruthy();
  });

  it('shows the graph in its own card, after the Student card', async () => {
    render(<ReportsPage source={fakeSource().source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    const cards = document.querySelectorAll('.report-card');

    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).getByText('Students')).toBeTruthy();
    expect(within(cards[1] as HTMLElement).getByText('Students by hour')).toBeTruthy();
  });

  it('shows the three bars of a month with their names', async () => {
    const days = [{ day: 1, present: 300, absent: 10, notApplicable: 50 }];
    const { source, asked } = fakeSource(() => report({ hours: null, days }));
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    const card = (await screen.findByText('Every Day of the month')).closest('section');
    expect(asked.at(-1)).toEqual({ view: 'Month', month: '2026-11' });
    expect(within(card as HTMLElement).getByText('Present')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Absent')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('Not Applicable')).toBeTruthy();
  });

  it('shows how many Days of each Pooja Status a Student had in a month', async () => {
    const monthRows: ReportRow[] = [
      { studentId: '9001', name: 'Asha Rao', room: 'A-1', statuses: ['Present', 'Absent'] },
    ];
    const { source } = fakeSource(() => report({ rows: monthRows, hours: null }));
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Asha Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Month' }));

    const row = (await screen.findByText('Days Present')).closest('table');
    expect(within(row as HTMLElement).getAllByText('1')).toHaveLength(2);
  });

  it('has no graph card for a date range', async () => {
    const { source } = fakeSource(() => report({ hours: null, days: null }));
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Date range' }));

    await screen.findByLabelText('From');
    expect(document.querySelectorAll('.report-card')).toHaveLength(1);
  });

  it('asks for the Report of a chosen Day and cannot choose a future Day', async () => {
    const { source, asked } = fakeSource();
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Bina Rao');
    const dayInput = screen.getByLabelText('Day');

    fireEvent.change(dayInput, { target: { value: '2026-10-30' } });

    expect(dayInput.getAttribute('max')).toBe(TODAY);
    expect(asked.at(-1)).toEqual({ view: 'Day', day: '2026-10-30' });
  });

  it('says Needs Review instead of Absent on a Day that is not Finalized', async () => {
    const review: ReportRow[] = [
      { studentId: '9001', name: 'Asha Rao', room: 'A-1', statuses: ['Needs Review'] },
    ];
    const { source } = fakeSource(() => report({ rows: review, isFinalized: false }));
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Asha Rao');

    expect(screen.getByRole('button', { name: 'Needs Review' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Absent' })).toBeNull();
    expect(screen.getByText(/Not Finalized/)).toBeTruthy();
  });

  it('leaves the cell empty on a Day the Student was not Active', async () => {
    const { source } = fakeSource(() =>
      report({
        rows: [{ studentId: '9001', name: 'Asha Rao', room: '101', statuses: [null] }],
      }),
    );

    render(<ReportsPage source={source} today={TODAY} />);

    const row = (await screen.findByText('Asha Rao')).closest('tr');
    expect(row && within(row).queryByText(/Present|Absent|Needs Review/)).toBeNull();
  });

  it('says what to do when no Students match', async () => {
    const { source } = fakeSource(() => report({ rows: rows.slice(0, 1) }));
    render(<ReportsPage source={source} today={TODAY} />);
    await screen.findByText('Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Absent' }));

    expect(screen.getByText(/Choose All to see every Student/)).toBeTruthy();
  });
});
