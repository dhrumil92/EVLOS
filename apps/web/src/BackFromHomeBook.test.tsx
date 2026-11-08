// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BackFromHomeBook } from './BackFromHomeBook.js';
import type { LeaveState, ListedStudent, RowAnswer, StudentSource } from './student-source.js';

const TODAY = '2026-11-06';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;

const student = (
  studentId: string,
  name: string,
  room: string,
  leaveState: LeaveState,
  expectedReturnAt = ist(9, 18),
  isActive = true,
): ListedStudent => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive,
  floor: Number(room[0]),
  leaveState,
  openLeave: leaveState === 'In hostel' ? null : { outAt: ist(4, 16), expectedReturnAt },
});

const STUDENTS = [
  student('9001', 'Asha Rao', '212', 'Away', ist(9, 18)),
  student('9002', 'Bina Rao', '110', 'Due Back', ist(6, 20)),
  student('9003', 'Chitra Rao', '105', 'In hostel'),
  student('9004', 'Deepa Rao', '118', 'Away', ist(8, 18), false),
];

function fakeSource(refuse: Record<string, string> = {}) {
  const sent: unknown[] = [];
  const source = {
    returnLeaves: (rows: { studentId: string }[]): Promise<RowAnswer[]> => {
      sent.push(rows);
      return Promise.resolve(
        rows.map(({ studentId }) => {
          const reason = refuse[studentId];
          return reason
            ? { studentId, outcome: 'refused' as const, reason }
            : { studentId, outcome: 'done' as const };
        }),
      );
    },
  } as unknown as StudentSource;
  return { source, sent };
}

function showBook(
  options: { students?: ListedStudent[]; refuse?: Record<string, string>; ticked?: string[] } = {},
) {
  const fake = fakeSource(options.refuse);
  const calls = { saved: 0 };
  render(
    <BackFromHomeBook
      students={options.students ?? STUDENTS}
      source={fake.source}
      today={TODAY}
      now={() => ist(6, 17, 15)}
      startTicked={options.ticked ?? []}
      onSaved={() => {
        calls.saved++;
      }}
    />,
  );
  return { ...fake, calls };
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const tick = (name: string) => {
  fireEvent.click(screen.getByRole('checkbox', { name: `${name} came back` }));
};
const TOP_TIME = 'Return Time for ticked Students';

afterEach(cleanup);

describe('the Back-from-Home Book', () => {
  it('lists only the Active Students who are Away, Due Back first', () => {
    showBook();

    const names = screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'));
    expect(names).toEqual(['Bina Rao came back', 'Asha Rao came back']);
  });

  it('says so when no Student is Away', () => {
    showBook({ students: [STUDENTS[2] as ListedStudent] });

    expect(screen.getByText('No Student is Away, so there is no Return to record.')).toBeTruthy();
  });

  it('Find narrows the list by room or name', () => {
    showBook();

    type('Find by room or name', '21');

    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('aria-label'))).toEqual([
      'Asha Rao came back',
    ]);
  });

  it('a ticked line takes the Return Time from the top, and follows it while unchanged', () => {
    showBook();
    type(TOP_TIME, '17:15');

    tick('Asha Rao');
    expect(input('Return Time for Asha Rao').value).toBe('17:15');
    expect(screen.getByText('from the top')).toBeTruthy();

    type(TOP_TIME, '18:00');
    expect(input('Return Time for Asha Rao').value).toBe('18:00');
  });

  it('changing one line leaves the other lines with the time from the top', () => {
    showBook();
    type(TOP_TIME, '17:15');
    tick('Asha Rao');
    tick('Bina Rao');

    type('Return Time for Asha Rao', '16:40');
    type(TOP_TIME, '18:00');

    expect(input('Return Time for Asha Rao').value).toBe('16:40');
    expect(screen.getByText('changed on this line')).toBeTruthy();
    expect(input('Return Time for Bina Rao').value).toBe('18:00');
  });

  it('Use now sets the Return Time at the top to now', () => {
    showBook();

    fireEvent.click(screen.getByRole('button', { name: 'Use now' }));

    expect(input(TOP_TIME).value).toBe('17:15');
  });

  it('counts only the ticked lines that have a Return Time', () => {
    showBook();
    tick('Asha Rao');
    expect(screen.getByRole('button', { name: 'Record 0 Returns' })).toBeTruthy();

    type(TOP_TIME, '17:15');

    expect(screen.getByRole('button', { name: 'Record 1 Return' })).toBeTruthy();
    expect(screen.getByText('1 ticked, 1 ready.')).toBeTruthy();
  });

  it('records each ticked Student with their own day and Return Time', async () => {
    const { sent, calls } = showBook();
    type(TOP_TIME, '17:15');
    tick('Bina Rao');
    tick('Asha Rao');
    fireEvent.change(screen.getByLabelText('Return day for Bina Rao'), {
      target: { value: 'Yesterday' },
    });
    type('Return Time for Bina Rao', '21:40');

    fireEvent.click(screen.getByRole('button', { name: 'Record 2 Returns' }));

    expect(
      await screen.findByText('Recorded 2 Returns. Bina Rao and Asha Rao are in hostel.'),
    ).toBeTruthy();
    expect(sent).toEqual([
      [
        { studentId: '9002', returnDay: '2026-11-05', returnTime: '21:40' },
        { studentId: '9001', returnDay: TODAY, returnTime: '17:15' },
      ],
    ]);
    expect(calls.saved).toBe(1);
    expect(screen.queryByRole('checkbox', { name: 'Asha Rao came back' })).toBeNull();
  });

  it('keeps a refused line ticked with its reason, and clears the saved one', async () => {
    showBook({ refuse: { '9002': 'return-before-out' } });
    type(TOP_TIME, '17:15');
    tick('Bina Rao');
    tick('Asha Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Record 2 Returns' }));

    expect(await screen.findByText('Recorded 1 Return. Asha Rao is in hostel.')).toBeTruthy();
    expect(screen.getByText('The Return Time is earlier than his Out Time.')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Bina Rao came back' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.queryByRole('checkbox', { name: 'Asha Rao came back' })).toBeNull();
  });

  it('starts with the Students ticked who were sent here from another page', () => {
    showBook({ ticked: ['9001', '9002'] });

    expect(screen.getByRole('checkbox', { name: 'Asha Rao came back' })).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByRole('checkbox', { name: 'Bina Rao came back' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('More opens Edit Leave and Cancel Leave for that Leave', () => {
    showBook();

    fireEvent.click(screen.getByRole('button', { name: 'More for Asha Rao' }));

    expect(screen.getByRole('button', { name: 'Edit Leave' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel Leave' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Record Return' })).toBeNull();
  });
});
