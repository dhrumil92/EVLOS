// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceStatusSource } from './device-status-source.js';
import type { LiveView, LiveViewSource } from './live-view-source.js';
import { LiveViewPage } from './LiveView.js';
import type { PoojaStatusName, ReportSource } from './report-source.js';
import type { LeaveState, ListedStudent, StudentSource } from './student-source.js';

const NOTE = 'Outside Pooja Window (05:30–18:00)';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const at = (date: number, hour: number, minute = 0) =>
  Date.UTC(2026, 10, date, hour, minute) - IST_OFFSET_MS;
const AT_0700_IST = at(2, 7);

const counted = {
  studentId: '9001',
  name: 'Asha Rao',
  punchedAt: AT_0700_IST,
  isCounted: true,
  notCountedBecause: null,
};

const view = (facts: Partial<LiveView> = {}): LiveView => ({
  day: '2026-11-02',
  studentsPresent: 0,
  activeStudents: 2,
  punches: [],
  ...facts,
});

function fakeSource(first: LiveView) {
  const state = { view: first, listeners: new Set<() => void>(), failing: false };
  const source: LiveViewSource = {
    load: () => (state.failing ? Promise.reject(new Error('down')) : Promise.resolve(state.view)),
    onChange: (listener) => {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
  };
  return { source, state };
}

const dayReport = (rows: [string, string, string, PoojaStatusName][]): ReportSource => ({
  csvUrl: () => '',
  xlsxUrl: () => '',
  load: () =>
    Promise.resolve({
      title: 'Monday 2 November 2026',
      isFinalized: false,
      rows: rows.map(([studentId, name, room, status]) => ({
        studentId,
        name,
        room,
        statuses: [status],
      })),
      reportDays: [],
    }),
});
const NO_REPORT = dayReport([]);

const listed = (
  studentId: string,
  name: string,
  room: string,
  leaveState: LeaveState,
  expectedReturnAt = at(9, 18),
): ListedStudent => ({
  studentId,
  name,
  room,
  email: `${studentId}@example.com`,
  phone: null,
  isActive: true,
  floor: 1,
  leaveState,
  openLeave: leaveState === 'In hostel' ? null : { outAt: at(1, 16), expectedReturnAt },
});
const studentsOf = (students: ListedStudent[]) =>
  ({ list: () => Promise.resolve(students) }) as unknown as StudentSource;
const NO_STUDENTS = studentsOf([]);

function show(
  live: LiveViewSource,
  options: {
    reports?: ReportSource;
    students?: StudentSource;
    device?: DeviceStatusSource;
    now?: number;
  } = {},
) {
  const opened: [string, readonly string[]][] = [];
  const result = render(
    <LiveViewPage
      source={live}
      reports={options.reports ?? NO_REPORT}
      students={options.students ?? NO_STUDENTS}
      device={options.device ?? { load: () => new Promise(() => undefined) }}
      now={() => options.now ?? at(2, 23)}
      onOpenLeaves={(book, students) => {
        opened.push([book, students]);
      }}
    />,
  );
  return { ...result, opened };
}

afterEach(cleanup);

describe('the Live view', () => {
  it('shows how many Students are Present out of the Active Students', async () => {
    show(fakeSource(view({ studentsPresent: 42, activeStudents: 60 })).source);

    expect(await screen.findByText('42')).toBeTruthy();
    expect(screen.getByText('of 60 Present')).toBeTruthy();
  });

  it('shows the Day in words', async () => {
    show(fakeSource(view()).source);

    expect(
      await screen.findByRole('heading', { name: 'Monday 2 November', level: 1 }),
    ).toBeTruthy();
  });

  it("shows the Device's Last Seen", async () => {
    show(fakeSource(view()).source, {
      device: { load: () => Promise.resolve({ lastSeenAt: AT_0700_IST, isQuiet: false }) },
    });

    expect(await screen.findByText('Device last seen 2 Nov, 07:00.')).toBeTruthy();
  });

  it('shows a Punch with the Student name, Student ID and IST time', async () => {
    show(fakeSource(view({ punches: [counted] })).source);

    const row = (await screen.findByText('Student ID 9001')).closest('li') as HTMLElement;
    expect(within(row).getByText('Asha Rao')).toBeTruthy();
    expect(within(row).getByText('07:00')).toBeTruthy();
    expect(within(row).getByText('Present')).toBeTruthy();
  });

  it.each([
    ['unknown-student', 'Not a Student'],
    ['not-active', 'Not Active'],
    ['outside-pooja-window', NOTE],
  ] as const)('labels a Punch that does not count because of %s', async (reason, label) => {
    const punch = { ...counted, isCounted: false, notCountedBecause: reason };

    show(fakeSource(view({ punches: [punch] })).source);

    const row = (await screen.findByText(label)).closest('li') as HTMLElement;
    expect(within(row).queryByText('Present')).toBeNull();
  });

  it('shows a new Punch without reloading the page', async () => {
    const { source, state } = fakeSource(view());
    show(source);
    await screen.findByText(/No Punches yet/);

    state.view = view({ studentsPresent: 1, punches: [counted] });
    await act(async () => {
      state.listeners.forEach((listener) => {
        listener();
      });
      await Promise.resolve();
    });

    expect(await screen.findByText('Student ID 9001')).toBeTruthy();
    expect(screen.queryByText(/No Punches yet/)).toBeNull();
  });

  it('says what to expect when there are no Punches yet', async () => {
    show(fakeSource(view()).source);

    expect(await screen.findByText(/No Punches yet today/)).toBeTruthy();
  });

  it('says how to fix it when the server cannot be reached', async () => {
    const { source, state } = fakeSource(view());
    state.failing = true;

    show(source);

    expect(await screen.findByText(/Start it with npm run dev/)).toBeTruthy();
  });

  it('stops listening when the page closes', async () => {
    const { source, state } = fakeSource(view());
    const { unmount } = show(source);
    await screen.findByText(/No Punches yet/);

    unmount();

    expect(state.listeners.size).toBe(0);
  });
});

describe('the Pooja Window band', () => {
  it('shows when the Students punched, and where Now is', async () => {
    const punches = [
      { ...counted, punchedAt: at(2, 6, 35) },
      { ...counted, studentId: '9002', punchedAt: at(2, 6, 40) },
      { ...counted, studentId: '9003', punchedAt: at(2, 7, 5) },
    ];
    show(fakeSource(view({ punches })).source, { now: at(2, 7, 14) });

    expect(
      await screen.findByRole('img', {
        name: 'When the Students punched: most between 06:30 and 06:45. Now is 07:14.',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Now 07:14')).toBeTruthy();
  });

  it('shows no Now after the Pooja Window has closed', async () => {
    show(fakeSource(view({ punches: [counted] })).source, { now: at(2, 19) });
    await screen.findByText('Student ID 9001');

    expect(screen.queryByText(/^Now /)).toBeNull();
  });
});

describe('Pending and Away', () => {
  it('lists the Pending Students with their rooms, and counts them', async () => {
    show(fakeSource(view()).source, {
      reports: dayReport([
        ['9001', 'Asha Rao', '101', 'Present'],
        ['9002', 'Bina Rao', '205', 'Pending'],
        ['9003', 'Chitra Rao', '110', 'Pending'],
      ]),
    });

    const list = await screen.findByRole('list', { name: 'Pending Students' });
    expect(within(list).getByText('Bina Rao')).toBeTruthy();
    expect(within(list).getByText('Room 110')).toBeTruthy();
    expect(within(list).queryByText('Asha Rao')).toBeNull();
    const counts = screen.getByRole('list', { name: "Today's counts" });
    expect(within(counts).getByText('Pending').nextSibling?.textContent).toBe('2');
  });

  it('lists the Away Students, Due Back first, each with a Return button', async () => {
    const { opened } = show(fakeSource(view()).source, {
      students: studentsOf([
        listed('9001', 'Asha Rao', '212', 'Away', at(9, 18)),
        listed('9002', 'Bina Rao', '110', 'Due Back', at(2, 20)),
        listed('9003', 'Chitra Rao', '105', 'In hostel'),
      ]),
    });

    const list = await screen.findByRole('list', { name: 'Away Students' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => within(item).getByText(/Rao$/).textContent),
    ).toEqual(['Bina Rao', 'Asha Rao']);
    fireEvent.click(within(list).getByRole('button', { name: 'Record Return for Asha Rao' }));
    expect(opened).toEqual([['Back-from-Home Book', ['9001']]]);
  });

  it('Record Leave and Record Return open the right book', async () => {
    const { opened } = show(fakeSource(view()).source);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Record Leave' }));
    fireEvent.click(screen.getByRole('button', { name: 'Record Return' }));

    expect(opened).toEqual([
      ['Going-to-Home Book', []],
      ['Back-from-Home Book', []],
    ]);
  });
});
