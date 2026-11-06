// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GoingToHomeBook } from './GoingToHomeBook.js';
import type { LeaveState, ListedStudent, RowAnswer, StudentSource } from './student-source.js';

const TODAY = '2026-11-06';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute: number) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;

const student = (
  studentId: string,
  name: string,
  room: string,
  leaveState: LeaveState = 'In hostel',
): ListedStudent => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive: true,
  floor: Number(room[0]),
  leaveState,
  openLeave:
    leaveState === 'In hostel' ? null : { outAt: ist(5, 16, 10), expectedReturnAt: ist(9, 18, 0) },
});

const STUDENTS = [
  student('9001', 'Asha Rao', '212'),
  student('9002', 'Bina Rao', '213'),
  student('9003', 'Chitra Rao', '105', 'Away'),
];

function fakeSource(refuse: Record<string, string> = {}, fails = false) {
  const sent: unknown[] = [];
  const source = {
    recordLeaves: (rows: { studentId: string }[]): Promise<RowAnswer[]> => {
      sent.push(rows);
      if (fails) return Promise.reject(new Error('The server answered 500'));
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

function showBook(options: { refuse?: Record<string, string>; fails?: boolean } = {}) {
  const fake = fakeSource(options.refuse, options.fails);
  const calls = { saved: 0, openedReturns: [] as string[] };
  render(
    <GoingToHomeBook
      students={STUDENTS}
      source={fake.source}
      today={TODAY}
      onSaved={() => {
        calls.saved++;
      }}
      onOpenReturns={(studentId) => {
        calls.openedReturns.push(studentId);
      }}
    />,
  );
  return { ...fake, calls };
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);
const pick = (line: number, room: string, name: string, roomShown = room) => {
  type(`Room, line ${String(line)}`, room);
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}, room ${roomShown}`) }));
};
const fillTimes = (line: number, out: string, day: string, back: string) => {
  type(`Out Time, line ${String(line)}`, out);
  type(`Expected Return date, line ${String(line)}`, day);
  type(`Expected Return time, line ${String(line)}`, back);
};
const save = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name }));
};

afterEach(cleanup);

describe('the Going-to-Home Book', () => {
  it('suggests the Students in the rooms typed and puts the one picked on the line', () => {
    showBook();

    type('Room, line 1', '21');
    expect(screen.getByRole('button', { name: /^Bina Rao, room 213/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Asha Rao, room 212/ }));

    expect(screen.getByText('Asha Rao')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Bina Rao, room 213/ })).toBeNull();
    expect(input('Room, line 1').value).toBe('212');
  });

  it('starts a new line with the times of the line above', () => {
    showBook();
    pick(1, '212', 'Asha Rao');
    fillTimes(1, '16:30', '2026-11-08', '18:00');

    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));

    expect(input('Out Time, line 2').value).toBe('16:30');
    expect(input('Expected Return date, line 2').value).toBe('2026-11-08');
    expect(input('Expected Return time, line 2').value).toBe('18:00');
    expect(screen.getAllByText('copied from line 1')).toHaveLength(2);
  });

  it('adds a line when Enter is pressed in the last box', () => {
    showBook();

    fireEvent.keyDown(input('Expected Return time, line 1'), { key: 'Enter' });

    expect(input('Room, line 2')).toBeTruthy();
  });

  it('changing one line leaves the other lines as they were', () => {
    showBook();
    fillTimes(1, '16:30', '2026-11-08', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));

    type('Out Time, line 2', '17:05');

    expect(input('Out Time, line 1').value).toBe('16:30');
    expect(input('Out Time, line 2').value).toBe('17:05');
  });

  it('records each line with its own day and times', async () => {
    const { sent, calls } = showBook();
    pick(1, '212', 'Asha Rao');
    fillTimes(1, '16:30', '2026-11-08', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));
    pick(2, '213', 'Bina Rao');
    fireEvent.change(screen.getByLabelText('Out day, line 2'), { target: { value: 'Yesterday' } });
    type('Out Time, line 2', '19:10');

    save('Save 2 Leaves');

    expect(
      await screen.findByText('Saved 2 Leaves. Asha Rao and Bina Rao are now Away.'),
    ).toBeTruthy();
    expect(sent).toEqual([
      [
        {
          studentId: '9001',
          outDay: TODAY,
          outTime: '16:30',
          expectedReturnDay: '2026-11-08',
          expectedReturnTime: '18:00',
        },
        {
          studentId: '9002',
          outDay: '2026-11-05',
          outTime: '19:10',
          expectedReturnDay: '2026-11-08',
          expectedReturnTime: '18:00',
        },
      ],
    ]);
    expect(calls.saved).toBe(1);
    expect(input('Room, line 1').value).toBe('');
  });

  it('asks for the date when the Out day is picked, and allows no future day', () => {
    showBook();

    fireEvent.change(screen.getByLabelText('Out day, line 1'), {
      target: { value: 'Pick a date' },
    });

    expect(input('Out date, line 1').max).toBe(TODAY);
  });

  it('shows how to record the Return for a Student who is already Away', () => {
    const { calls } = showBook();
    pick(1, '105', 'Chitra Rao');

    expect(
      screen.getByText(
        'Chitra Rao is already Away since Thursday 5 November at 16:10. Record that Return first, then this Leave.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Record Return for Chitra Rao' }));
    expect(calls.openedReturns).toEqual(['9003']);
  });

  it('counts only the ready lines on the Save button and says what is left', () => {
    showBook();
    pick(1, '212', 'Asha Rao');
    fillTimes(1, '16:30', '2026-11-08', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));
    pick(2, '105', 'Chitra Rao');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));

    expect(screen.getByRole('button', { name: 'Save 1 Leave' })).toBeTruthy();
    expect(
      screen.getByText('1 line ready. 1 line needs a fix. 1 line is not finished.'),
    ).toBeTruthy();
  });

  it('keeps a refused line with its reason and clears the saved one', async () => {
    showBook({ refuse: { '9002': 'expected-return-before-out' } });
    pick(1, '212', 'Asha Rao');
    fillTimes(1, '16:30', '2026-11-08', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));
    pick(2, '213', 'Bina Rao');

    save('Save 2 Leaves');

    expect(await screen.findByText('Saved 1 Leave. Asha Rao is now Away.')).toBeTruthy();
    expect(screen.getByText('The Expected Return is earlier than the Out Time.')).toBeTruthy();
    expect(screen.getByText('Bina Rao')).toBeTruthy();
    expect(screen.queryByText('Asha Rao')).toBeNull();
  });

  it('removes a line', () => {
    showBook();
    fireEvent.click(screen.getByRole('button', { name: 'Add a line' }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }));

    expect(screen.queryByLabelText('Room, line 2')).toBeNull();
  });

  it('keeps every line when the server cannot be reached', async () => {
    showBook({ fails: true });
    pick(1, '212', 'Asha Rao');
    fillTimes(1, '16:30', '2026-11-08', '18:00');

    save('Save 1 Leave');

    expect(
      await screen.findByText('Nothing was saved. Check the server, then press Save again.'),
    ).toBeTruthy();
    expect(screen.getByText('Asha Rao')).toBeTruthy();
  });
});
