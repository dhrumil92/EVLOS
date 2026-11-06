// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LeaveStatus } from './LeaveStatus.js';
import type { LeaveAnswer, ListedStudent, StudentSource } from './student-source.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const TODAY = '2026-11-03';

const inHostel: ListedStudent = {
  studentId: '9001',
  name: 'Asha Rao',
  room: '101',
  email: 'asha@example.com',
  phone: null,
  isActive: true,
  floor: 1,
  leaveState: 'In hostel',
  openLeave: null,
};
const away: ListedStudent = {
  ...inHostel,
  leaveState: 'Away',
  openLeave: { outAt: ist(3, 8, 15), expectedReturnAt: ist(5, 18, 0) },
};

function fakeSource(answer: LeaveAnswer = 'done') {
  const calls: unknown[][] = [];
  const reply = (...args: unknown[]) => {
    calls.push(args);
    return Promise.resolve(answer);
  };
  const source = {
    recordLeave: reply,
    editLeave: reply,
    cancelLeave: reply,
    returnLeave: reply,
  } as unknown as StudentSource;
  return { source, calls };
}

function show(student: ListedStudent, answer?: LeaveAnswer) {
  const fake = fakeSource(answer);
  let changed = 0;
  render(
    <LeaveStatus
      student={student}
      source={fake.source}
      today={TODAY}
      onChanged={() => {
        changed++;
      }}
    />,
  );
  return { ...fake, changes: () => changed };
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};
const input = (label: string) => screen.getByLabelText<HTMLInputElement>(label);

afterEach(cleanup);

describe('Leave status for a Student in hostel', () => {
  it('says he is in hostel', () => {
    show(inHostel);

    expect(screen.getByText('In hostel')).toBeTruthy();
  });

  it('starts both dates at today and allows no future Out date', () => {
    show(inHostel);

    expect(input('Out date').value).toBe(TODAY);
    expect(input('Out date').max).toBe(TODAY);
    expect(input('Expected Return date').value).toBe(TODAY);
    expect(input('Expected Return date').max).toBe('');
  });

  it('records a Leave with the dates and times typed', async () => {
    const { calls, changes } = show(inHostel);

    type('Out time', '08:15');
    type('Expected Return date', '2026-11-05');
    type('Expected Return time', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Record Leave' }));

    expect(await screen.findByText('Leave recorded. He is now Away.')).toBeTruthy();
    expect(calls).toEqual([
      [
        '9001',
        {
          outDay: TODAY,
          outTime: '08:15',
          expectedReturnDay: '2026-11-05',
          expectedReturnTime: '18:00',
        },
      ],
    ]);
    expect(changes()).toBe(1);
  });

  it('explains a refusal in plain words', async () => {
    show(inHostel, 'out-time-in-future');

    type('Out time', '23:00');
    type('Expected Return time', '23:30');
    fireEvent.click(screen.getByRole('button', { name: 'Record Leave' }));

    expect(await screen.findByText(/The Out Time is later than now/)).toBeTruthy();
  });
});

describe('Leave status for an Away Student', () => {
  it('shows his Out Time and Expected Return in IST', () => {
    show(away);

    expect(screen.getByText('Away')).toBeTruthy();
    expect(screen.getByText('Out Tuesday 3 November at 08:15')).toBeTruthy();
    expect(screen.getByText('Expected back Thursday 5 November at 18:00')).toBeTruthy();
  });

  it('records his Return on today with the time typed, and allows no future date', async () => {
    const { calls, changes } = show(away);
    expect(input('Return date').max).toBe(TODAY);

    type('Return time', '19:30');
    fireEvent.click(screen.getByRole('button', { name: 'Record Return' }));

    expect(await screen.findByText('Return recorded. He is in hostel.')).toBeTruthy();
    expect(calls).toEqual([['9001', { returnDay: TODAY, returnTime: '19:30' }]]);
    expect(changes()).toBe(1);
  });

  it('edits the Leave, starting from its saved times', async () => {
    const { calls } = show(away);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Leave' }));
    expect(input('Out time').value).toBe('08:15');
    type('Expected Return date', '2026-11-08');
    fireEvent.click(screen.getByRole('button', { name: 'Save Leave' }));

    expect(await screen.findByText('Leave saved.')).toBeTruthy();
    expect(calls).toEqual([
      [
        '9001',
        {
          outDay: TODAY,
          outTime: '08:15',
          expectedReturnDay: '2026-11-08',
          expectedReturnTime: '18:00',
        },
      ],
    ]);
  });

  it('asks before it cancels the Leave', async () => {
    const { calls } = show(away);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Leave' }));
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel Leave' }));

    expect(await screen.findByText('Leave cancelled. He is in hostel.')).toBeTruthy();
    expect(calls).toEqual([['9001']]);
  });

  it('marks a Due Back Student as Due Back', () => {
    show({ ...away, leaveState: 'Due Back' });

    expect(screen.getByText('Due Back')).toBeTruthy();
  });

  it('offers only Edit Leave and Cancel Leave when the Return is recorded elsewhere', () => {
    render(
      <LeaveStatus
        student={away}
        source={fakeSource().source}
        today={TODAY}
        onChanged={() => undefined}
        offerReturn={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Record Return' })).toBeNull();
    expect(screen.queryByLabelText('Return time')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Leave' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel Leave' })).toBeTruthy();
  });
});
