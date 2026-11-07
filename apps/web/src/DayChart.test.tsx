// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DayChart } from './DayChart.js';
import type { PoojaStatusName, Report } from './report-source.js';

type Status = PoojaStatusName | null;

// Monday 12, Tuesday 13 and Wednesday 14 October 2026 for three Students.
const report = (rows: [string, ...Status[]][]): Report => ({
  title: 'October 2026',
  isFinalized: true,
  rows: rows.map(([name, ...statuses]) => ({ studentId: name, name, room: '101', statuses })),
  reportDays: ['2026-10-12', '2026-10-13', '2026-10-14'].map((day) => ({
    day,
    isFinalized: true,
  })),
});

const THREE = report([
  ['Asha', 'Present', 'Absent', 'Present'],
  ['Bina', 'Present', 'Not Applicable', 'Absent'],
  ['Chitra', 'Absent', 'Absent', 'Present'],
]);

// Some days of October 2026 for `present` Students Present and `absent` Students Absent on each.
function daysOf(days: number, present: number, absent: number): Report {
  const statuses = (status: PoojaStatusName): Status[] =>
    Array.from({ length: days }, () => status);
  return {
    title: 'A long period',
    isFinalized: true,
    rows: [
      ...Array.from({ length: present }, (_, index) => ({
        studentId: `p${String(index)}`,
        name: `Present ${String(index)}`,
        room: '101',
        statuses: statuses('Present'),
      })),
      ...Array.from({ length: absent }, (_, index) => ({
        studentId: `a${String(index)}`,
        name: `Absent ${String(index)}`,
        room: '102',
        statuses: statuses('Absent'),
      })),
    ],
    reportDays: Array.from({ length: days }, (_, index) => ({
      day: new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10),
      isFinalized: true,
    })),
  };
}

const axisLabels = () =>
  Array.from(document.querySelectorAll('.text-right.text-xs > span')).map(
    (span) => span.textContent,
  );

afterEach(cleanup);

describe('the chart of every Day', () => {
  it('has a button for each Day, saying the Day and its numbers in words', () => {
    render(<DayChart report={THREE} />);

    expect(
      screen.getByRole('button', {
        name: 'Monday 12 October: Present 2, Not Applicable 0, Absent 1',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Tuesday 13 October: Present 0, Not Applicable 1, Absent 2',
      }),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^\w+day \d+ October/ })).toHaveLength(3);
  });

  it('names each colour in a legend', () => {
    render(<DayChart report={THREE} />);

    const legend = screen.getByRole('list', { name: 'Colours' });

    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Present', 'Not Applicable', 'Absent']);
  });

  it('adds Needs Review to the legend and the numbers when a Day has one', () => {
    render(<DayChart report={report([['Asha', 'Needs Review', 'Present', 'Present']])} />);

    expect(
      within(screen.getByRole('list', { name: 'Colours' })).getByText('Needs Review'),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Monday 12 October: Present 0, Not Applicable 0, Absent 0, Needs Review 1',
      }),
    ).toBeTruthy();
  });

  it('shows who was Absent on a Day when the Day is pressed', () => {
    render(<DayChart report={THREE} />);

    fireEvent.click(screen.getByRole('button', { name: /^Tuesday 13 October/ }));

    const detail = screen.getByRole('region', { name: 'Tuesday 13 October' });
    expect(
      within(detail)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Asha101', 'Chitra101']);
    expect(
      screen.getByRole('button', { name: /^Tuesday 13 October/ }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('says so when nobody was Absent on the pressed Day', () => {
    render(<DayChart report={report([['Asha', 'Present', 'Present', 'Present']])} />);

    fireEvent.click(screen.getByRole('button', { name: /^Monday 12 October/ }));

    expect(screen.getByText('No Student was Absent.')).toBeTruthy();
  });

  it('closes the detail when the same Day is pressed again', () => {
    render(<DayChart report={THREE} />);
    const day = screen.getByRole('button', { name: /^Monday 12 October/ });

    fireEvent.click(day);
    fireEvent.click(day);

    expect(screen.queryByRole('region', { name: 'Monday 12 October' })).toBeNull();
  });

  it('can be shown as a table, with a row for each Day', () => {
    render(<DayChart report={THREE} />);

    fireEvent.click(screen.getByRole('button', { name: 'Show as a table' }));

    const rows = within(screen.getByRole('table', { name: 'Every Day' })).getAllByRole('row');
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      'Monday 12 October201',
      'Tuesday 13 October012',
      'Wednesday 14 October201',
    ]);
    expect(screen.queryByRole('button', { name: /^Monday 12 October/ })).toBeNull();
  });

  it('goes back to the chart from the table', () => {
    render(<DayChart report={THREE} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show as a table' }));

    fireEvent.click(screen.getByRole('button', { name: 'Show as a chart' }));

    expect(screen.getAllByRole('button', { name: /^\w+day \d+ October/ })).toHaveLength(3);
  });
});

describe('the side of the chart', () => {
  it('reaches the tallest bar, rounded up, and not the number of Students', () => {
    // 38 Absent and 5 Present Students: the tallest bar is 38, so the side stops at 40.
    render(<DayChart report={daysOf(3, 5, 38)} />);

    expect(axisLabels()).toEqual(expect.arrayContaining(['0', '10', '20', '30', '40']));
    expect(axisLabels()).not.toContain('60');
    expect(axisLabels()).not.toContain('50');
  });

  it('shrinks to fit a quiet period', () => {
    render(<DayChart report={daysOf(3, 2, 1)} />);

    expect(axisLabels()).toEqual(['0', '1', '2']);
  });
});

describe('the numbers on the chart', () => {
  it('put the total of each Day along the top', () => {
    render(<DayChart report={THREE} />);

    // Each of the three Days has 3 Students: 2 + 0 + 1, 0 + 1 + 2 and 2 + 0 + 1.
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getAllByText('3')).toHaveLength(3);
  });

  it('put the number of Students on top of each bar, with 16 Days or fewer', () => {
    render(<DayChart report={daysOf(10, 27, 41)} />);

    expect(screen.getAllByText('27')).toHaveLength(10);
    expect(screen.getAllByText('41')).toHaveLength(10);
    expect(screen.getAllByText('68')).toHaveLength(10);
  });

  it('leave the numbers off the bars of a long month, but keep the total of each Day', () => {
    render(<DayChart report={daysOf(30, 53, 41)} />);

    expect(screen.queryByText('53')).toBeNull();
    expect(screen.queryByText('41')).toBeNull();
    expect(screen.getAllByText('94')).toHaveLength(30);
  });

  it('give no number to a bar with nothing in it', () => {
    render(<DayChart report={daysOf(3, 0, 5)} />);

    expect(screen.queryByText('0', { selector: '.text-ink' })).toBeNull();
  });

  it('number every Day of a month under its bars', () => {
    // 1 November 2026 is a Sunday, so only a Monday rule would leave most Days unnumbered.
    const november: Report = {
      ...daysOf(7, 1, 1),
      reportDays: Array.from({ length: 7 }, (_, index) => ({
        day: `2026-11-${String(index + 1).padStart(2, '0')}`,
        isFinalized: true,
      })),
    };
    render(<DayChart report={november} />);

    const under = Array.from(document.querySelectorAll('.pt-1.text-xs > span')).map(
      (span) => span.textContent,
    );

    expect(under).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('number only some Days of a range longer than a month', () => {
    render(<DayChart report={daysOf(40, 1, 1)} />);

    const under = Array.from(document.querySelectorAll('.pt-1.text-xs > span')).map(
      (span) => span.textContent,
    );

    expect(under).toHaveLength(40);
    expect(under.filter((text) => text !== '')).not.toHaveLength(40);
    expect(under[0]).toBe('1');
  });

  it('puts no total on the Days of a range longer than a month', () => {
    render(<DayChart report={daysOf(40, 1, 1)} />);

    expect(screen.queryByText('Total')).toBeNull();
  });
});
