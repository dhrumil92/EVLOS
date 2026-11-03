// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ManyLeavesPanel, ManyReturnsPanel } from './ManyStudentsPanels.js';
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
    recordLeaves: (rows: { studentId: string }[]) => {
      sent.push(rows);
      return answer(rows);
    },
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

function showLeaves(refuse?: Record<string, string>) {
  const fake = fakeSource(refuse);
  let done = 0;
  render(
    <ManyLeavesPanel
      students={STUDENTS}
      source={fake.source}
      today={TODAY}
      onDone={() => {
        done++;
      }}
    />,
  );
  return { ...fake, done: () => done };
}

afterEach(cleanup);

describe('Leave for many Students', () => {
  it('starts both dates at today and allows no future Out date', () => {
    showLeaves();

    expect(input('Out date').value).toBe(TODAY);
    expect(input('Out date').max).toBe(TODAY);
    expect(input('Expected Return date').value).toBe(TODAY);
  });

  it('finds a Student by name and asks only for his two times', () => {
    showLeaves();

    add('asha', 'Asha Rao');

    expect(input('Out time for Asha Rao')).toBeTruthy();
    expect(input('Expected Return time for Asha Rao')).toBeTruthy();
    expect(screen.queryByLabelText('Out date for Asha Rao')).toBeNull();
  });

  it('finds a Student by Student ID and leaves added Students out of the results', () => {
    showLeaves();
    add('9001', 'Asha Rao');

    type('Find a Student by name, Student ID or room', 'rao');

    expect(screen.queryByRole('button', { name: 'Add Asha Rao' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Bina Rao' })).toBeTruthy();
  });

  it('records each Student with his own times and the dates at the top', async () => {
    const { sent, done } = showLeaves();
    type('Expected Return date', '2026-11-05');
    add('asha', 'Asha Rao');
    add('bina', 'Bina Rao');
    type('Out time for Asha Rao', '08:00');
    type('Expected Return time for Asha Rao', '18:00');
    type('Out time for Bina Rao', '17:30');
    type('Expected Return time for Bina Rao', '20:00');

    fireEvent.click(screen.getByRole('button', { name: 'Record 2 Leaves' }));

    expect(await screen.findByText('Recorded 2 Leaves.')).toBeTruthy();
    expect(sent).toEqual([
      [
        {
          studentId: '9001',
          outDay: TODAY,
          outTime: '08:00',
          expectedReturnDay: '2026-11-05',
          expectedReturnTime: '18:00',
        },
        {
          studentId: '9002',
          outDay: TODAY,
          outTime: '17:30',
          expectedReturnDay: '2026-11-05',
          expectedReturnTime: '20:00',
        },
      ],
    ]);
    expect(done()).toBe(1);
  });

  it('lets one Student have his own dates', async () => {
    const { sent } = showLeaves();
    add('asha', 'Asha Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Change date for Asha Rao' }));
    type('Out date for Asha Rao', '2026-11-02');
    type('Out time for Asha Rao', '19:00');
    type('Expected Return time for Asha Rao', '20:00');
    fireEvent.click(screen.getByRole('button', { name: 'Record 1 Leave' }));

    await screen.findByText('Recorded 1 Leave.');
    expect(sent[0]).toEqual([
      {
        studentId: '9001',
        outDay: '2026-11-02',
        outTime: '19:00',
        expectedReturnDay: TODAY,
        expectedReturnTime: '20:00',
      },
    ]);
  });

  it('lists an Away Student as skipped and does not send him', async () => {
    const { sent } = showLeaves();
    add('asha', 'Asha Rao');
    add('chitra', 'Chitra Rao');

    expect(screen.getByText('Already Away, will be skipped')).toBeTruthy();
    expect(
      screen.getByText('1 Student will be Away. 1 is already Away and will be skipped.'),
    ).toBeTruthy();
    type('Out time for Asha Rao', '08:00');
    type('Expected Return time for Asha Rao', '18:00');
    fireEvent.click(screen.getByRole('button', { name: 'Record 1 Leave' }));

    await screen.findByText('Recorded 1 Leave.');
    expect((sent[0] as { studentId: string }[]).map((row) => row.studentId)).toEqual(['9001']);
  });

  it('keeps a refused row with its reason and clears the saved ones', async () => {
    showLeaves({ '9002': 'expected-return-before-out' });
    add('asha', 'Asha Rao');
    add('bina', 'Bina Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Record 2 Leaves' }));

    expect(await screen.findByText('Recorded 1 Leave. 1 row needs a fix.')).toBeTruthy();
    expect(screen.queryByLabelText('Out time for Asha Rao')).toBeNull();
    expect(input('Out time for Bina Rao')).toBeTruthy();
    expect(screen.getByText('The Expected Return is earlier than the Out Time.')).toBeTruthy();
  });

  it('removes a Student from the selection', () => {
    showLeaves();
    add('asha', 'Asha Rao');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Asha Rao' }));

    expect(screen.queryByLabelText('Out time for Asha Rao')).toBeNull();
  });
});

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
