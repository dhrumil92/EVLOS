// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ManyReturnsPanel } from './ManyStudentsPanels.js';
import type { LeaveState, ListedStudent, RowAnswer, StudentSource } from './student-source.js';

const TODAY = '2026-11-03';

const student = (studentId: string, name: string, leaveState: LeaveState = 'In hostel') => ({
  studentId,
  name,
  room: '101',
  email: `${studentId}@example.com`,
  phone: null,
  isActive: true,
  floor: 1,
  leaveState,
  openLeave: leaveState === 'In hostel' ? null : { outAt: 0, expectedReturnAt: 0 },
});

const STUDENTS: ListedStudent[] = [
  student('9001', 'Asha Rao'),
  student('9002', 'Bina Rao'),
  student('9003', 'Chitra Rao', 'Away'),
];

function fakeSource(refuse: Record<string, string> = {}) {
  const sent: unknown[][] = [];
  const answer = (rows: { studentId: string }[]): Promise<RowAnswer[]> =>
    Promise.resolve(
      rows.map(({ studentId }) => {
        const reason = refuse[studentId];
        return reason
          ? { studentId, outcome: 'refused' as const, reason }
          : { studentId, outcome: 'done' as const };
      }),
    );
  const source = {
    returnLeaves: (rows: { studentId: string }[]) => {
      sent.push(rows);
      return answer(rows);
    },
  } as unknown as StudentSource;
  return { source, sent };
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const add = (search: string, name: string) => {
  type('Find a Student by name, Student ID or room', search);
  fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }));
};

afterEach(cleanup);

describe('Return for many Students', () => {
  function showReturns() {
    const fake = fakeSource();
    render(
      <ManyReturnsPanel
        students={STUDENTS}
        source={fake.source}
        today={TODAY}
        onDone={() => undefined}
      />,
    );
    return fake;
  }

  it('starts the Return date at today and allows no future date', () => {
    showReturns();

    expect(input('Return date').value).toBe(TODAY);
    expect(input('Return date').max).toBe(TODAY);
  });

  it('records each Return Time and skips a Student who is not Away', async () => {
    const { sent } = showReturns();
    add('chitra', 'Chitra Rao');
    add('asha', 'Asha Rao');

    expect(screen.getByText('Not Away, will be skipped')).toBeTruthy();
    type('Return time for Chitra Rao', '19:30');
    fireEvent.click(screen.getByRole('button', { name: 'Record 1 Return' }));

    expect(await screen.findByText('Recorded 1 Return.')).toBeTruthy();
    expect(sent).toEqual([[{ studentId: '9003', returnDay: TODAY, returnTime: '19:30' }]]);
  });
});
