// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PoojaStatusName, Report } from './report-source.js';
import { StudentsInMonth } from './StudentsInMonth.js';

type Status = PoojaStatusName | null;

const reportOf = (rows: [string, string, ...Status[]][]): Report => ({
  title: 'October 2026',
  isFinalized: true,
  rows: rows.map(([room, name, ...statuses]) => ({ studentId: name, name, room, statuses })),
  reportDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day) => ({
    day,
    isFinalized: true,
  })),
});

const FOUR = reportOf([
  ['103', 'Chitra', 'Present', 'Present', 'Present', 'Present'],
  ['102', 'Bina', 'Absent', 'Present', 'Not Applicable', 'Present'],
  ['101', 'Asha', 'Absent', 'Absent', 'Present', 'Present'],
  ['204', 'Deepa', 'Present', 'Present', 'Present', 'Absent'],
]);

const names = () =>
  within(screen.getByRole('table', { name: 'Students in October 2026' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

afterEach(cleanup);

describe('the Students of a period', () => {
  it('lists every Student, the most Absent first, then by room', () => {
    render(<StudentsInMonth report={FOUR} />);

    expect(names()).toEqual(['Asha', 'Bina', 'Deepa', 'Chitra']);
  });

  it('lists a Student who was never Absent too', () => {
    render(<StudentsInMonth report={FOUR} />);

    expect(names()).toContain('Chitra');
  });

  it('has no buttons that choose between those Absent and every Student', () => {
    render(<StudentsInMonth report={FOUR} />);

    expect(screen.queryByRole('group', { name: 'Which Students' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Absent at least once/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Show all/ })).toBeNull();
  });

  it('says how many Students are shown', () => {
    render(<StudentsInMonth report={FOUR} />);

    expect(screen.getByText(/^4 Students, the most Absent first/)).toBeTruthy();
  });

  it('scrolls inside its card, so a long list does not push the page down', () => {
    render(<StudentsInMonth report={FOUR} />);

    const list = screen.getByLabelText('Student list, scrolls');

    expect(list.classList.contains('student-scroll')).toBe(true);
    expect(list.contains(screen.getByRole('table'))).toBe(true);
  });

  it('shows every row of a long list inside the scrolling card', () => {
    const many = reportOf(
      Array.from({ length: 40 }, (_, index) => [
        String(100 + index),
        `Student ${String(index).padStart(2, '0')}`,
        'Present',
        'Present',
        'Present',
        'Present',
      ]),
    );
    render(<StudentsInMonth report={many} />);

    expect(names()).toHaveLength(40);
  });

  it('gives the Present, Not Applicable and Absent Days of each Student', () => {
    render(<StudentsInMonth report={FOUR} />);

    const bina = screen
      .getAllByRole('row')
      .find((row) => within(row).queryByText('Bina')) as HTMLElement;

    expect(
      within(bina)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['102', 'Bina', '', '2', '1', '1']);
  });

  it('draws a small square for each Day, described in words for a screen reader', () => {
    render(<StudentsInMonth report={FOUR} />);

    const strip = screen.getByRole('img', {
      name: 'Bina: Present 2, Not Applicable 1, Absent 1',
    });

    expect(strip.children).toHaveLength(4);
  });

  it('names each colour of the squares', () => {
    render(<StudentsInMonth report={FOUR} />);

    const legend = screen.getByRole('list', { name: 'Colours' });

    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Present', 'Not Applicable', 'Absent']);
  });

  it('says so when the period has no Student', () => {
    render(<StudentsInMonth report={reportOf([])} />);

    expect(screen.getByText('No Student has a Pooja Status in this period.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('the Floor choice', () => {
  it('starts on all floors, so nothing is filtered', () => {
    render(<StudentsInMonth report={FOUR} />);

    expect(screen.getByLabelText<HTMLSelectElement>('Floor').value).toBe('');
    expect(names()).toHaveLength(4);
  });

  it('offers all floors, then only the floors that have a Student', () => {
    render(<StudentsInMonth report={FOUR} />);

    const options = within(screen.getByLabelText('Floor')).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'All floors',
      'Floor 1',
      'Floor 2',
    ]);
  });

  it('shows only the Students of the chosen floor, and says how many', () => {
    render(<StudentsInMonth report={FOUR} />);

    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '2' } });

    expect(names()).toEqual(['Deepa']);
    expect(screen.getByText(/^1 Student, the most Absent first/)).toBeTruthy();
  });

  it('goes back to every Student when all floors is chosen again', () => {
    render(<StudentsInMonth report={FOUR} />);
    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '2' } });

    fireEvent.change(screen.getByLabelText('Floor'), { target: { value: '' } });

    expect(names()).toHaveLength(4);
  });
});
