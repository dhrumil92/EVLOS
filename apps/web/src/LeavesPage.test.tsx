// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LeavesPage } from './LeavesPage.js';
import type { LeaveState, ListedStudent, StudentSource } from './student-source.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number) => Date.UTC(2026, 10, date, hour) - IST_OFFSET_MS;

const student = (
  studentId: string,
  name: string,
  leaveState: LeaveState,
  expectedReturnAt = ist(9, 18),
  isActive = true,
): ListedStudent => ({
  studentId,
  name,
  room: '101',
  email: `${studentId}@example.com`,
  phone: null,
  isActive,
  floor: 1,
  leaveState,
  openLeave: leaveState === 'In hostel' ? null : { outAt: ist(1, 8), expectedReturnAt },
});

const sourceOf = (students: ListedStudent[]) =>
  ({ list: () => Promise.resolve(students) }) as unknown as StudentSource;

afterEach(cleanup);

describe('Leaves page', () => {
  it('lists the Away Students, Due Back first, then by Expected Return', async () => {
    render(
      <LeavesPage
        today="2026-11-03"
        source={sourceOf([
          student('9001', 'Asha Rao', 'Away', ist(9, 18)),
          student('9002', 'Bina Rao', 'In hostel'),
          student('9003', 'Chitra Rao', 'Away', ist(6, 18)),
          student('9004', 'Deepa Rao', 'Due Back', ist(4, 18)),
        ])}
      />,
    );

    const list = await screen.findByRole('list', { name: 'Away Students' });
    const names = within(list)
      .getAllByRole('listitem')
      .map((item) => within(item).getByText(/Rao$/).textContent);
    expect(names).toEqual(['Deepa Rao', 'Chitra Rao', 'Asha Rao']);
    expect(screen.getByText('3 Students are Away. 1 is Due Back.')).toBeTruthy();
  });

  it('shows when each Away Student is expected back', async () => {
    render(
      <LeavesPage
        today="2026-11-03"
        source={sourceOf([student('9001', 'Asha Rao', 'Away', ist(9, 18))])}
      />,
    );

    expect(await screen.findByText('Expected back Monday 9 November at 18:00')).toBeTruthy();
  });

  it('leaves out a Deactivated Student', async () => {
    render(
      <LeavesPage
        today="2026-11-03"
        source={sourceOf([student('9001', 'Asha Rao', 'Away', ist(9, 18), false)])}
      />,
    );

    expect(await screen.findByText('No Student is Away.')).toBeTruthy();
  });

  it('opens on the Going-to-Home Book', async () => {
    render(<LeavesPage today="2026-11-03" source={sourceOf([])} />);
    await screen.findByText('No Student is Away.');

    expect(
      screen.getByRole('tab', { name: /^Going-to-Home Book/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('region', { name: 'Lines from the Going-to-Home Book' })).toBeTruthy();
  });

  it('switches to the Back-from-Home Book', async () => {
    render(<LeavesPage today="2026-11-03" source={sourceOf([])} />);
    await screen.findByText('No Student is Away.');

    fireEvent.click(screen.getByRole('tab', { name: /^Back-from-Home Book/ }));

    expect(
      screen.getByRole('tab', { name: /^Back-from-Home Book/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('region', { name: 'Students who are Away' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Lines from the Going-to-Home Book' })).toBeNull();
  });

  it('opens the Back-from-Home Book with that Student ticked, from a line for a Student who is already Away', async () => {
    render(
      <LeavesPage
        today="2026-11-03"
        source={sourceOf([student('9001', 'Asha Rao', 'Away', ist(9, 18))])}
      />,
    );
    await screen.findByRole('list', { name: 'Away Students' });

    fireEvent.change(screen.getByLabelText('Room, line 1'), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: /^Asha Rao, room 101/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Record Return for Asha Rao' }));

    expect(
      screen.getByRole('tab', { name: /^Back-from-Home Book/ }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Asha Rao came back' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('opens the Back-from-Home Book from the Away now list', async () => {
    render(
      <LeavesPage
        today="2026-11-03"
        source={sourceOf([student('9001', 'Asha Rao', 'Away', ist(9, 18))])}
      />,
    );
    await screen.findByRole('list', { name: 'Away Students' });

    fireEvent.click(screen.getByRole('button', { name: 'Open the Back-from-Home Book' }));

    expect(screen.getByRole('region', { name: 'Students who are Away' })).toBeTruthy();
  });
});
