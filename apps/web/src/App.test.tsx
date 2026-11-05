// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { LiveView, LiveViewSource } from './live-view-source.js';
import type { ReportSource } from './report-source.js';
import type { ReviewSource } from './review-source.js';

const NOTE = 'Outside Pooja Window (05:30–18:00)';
const AT_0700_IST = Date.UTC(2026, 10, 2, 1, 30, 0);
const AT_2200_IST = Date.UTC(2026, 10, 2, 16, 30, 0);

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

const reports: ReportSource = {
  csvUrl: () => '/csv',
  xlsxUrl: () => '/xlsx',
  load: () =>
    Promise.resolve({
      title: 'Monday 2 November 2026',
      isFinalized: false,
      rows: [
        { studentId: '9001', name: 'Asha Rao', room: '101', statuses: ['Present'] },
        { studentId: '9002', name: 'Bina Rao', room: '205', statuses: ['Needs Review'] },
      ],
      hours: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      days: null,
    }),
};

// jsdom has no canvas, and the smoke animation is not what these tests check.
HTMLCanvasElement.prototype.getContext = () => null;

afterEach(cleanup);

describe('live view', () => {
  it('shows how many Students are Present so far', async () => {
    render(<App reports={reports} source={fakeSource(view({ studentsPresent: 214 })).source} />);

    expect(await screen.findByText('214')).toBeTruthy();
    expect(screen.getByText('Students Present so far')).toBeTruthy();
  });

  it('shows the Day in words', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);

    expect(await screen.findByText(/2 November 2026/)).toBeTruthy();
  });

  it('shows a Punch with its Student ID and IST time', async () => {
    const punches = [counted];

    render(<App reports={reports} source={fakeSource(view({ punches })).source} />);

    const row = (await screen.findByText('Student ID 9001')).closest('li');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('07:00:00')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Present')).toBeTruthy();
  });

  it('shows the Student name with the Student ID', async () => {
    render(<App reports={reports} source={fakeSource(view({ punches: [counted] })).source} />);

    const row = (await screen.findByText('Asha Rao')).closest('li');
    expect(within(row as HTMLElement).getByText('Student ID 9001')).toBeTruthy();
  });

  it.each([
    ['unknown-student', 'Not a Student'],
    ['not-active', 'Not Active'],
  ] as const)('labels a Punch that does not count because of %s', async (reason, label) => {
    const punch = { ...counted, name: null, isCounted: false, notCountedBecause: reason };

    render(<App reports={reports} source={fakeSource(view({ punches: [punch] })).source} />);

    const row = (await screen.findByText(label)).closest('li');
    expect(within(row as HTMLElement).queryByText('Present')).toBeNull();
  });

  it('shows the count out of the Active Students', async () => {
    render(<App reports={reports} source={fakeSource(view({ activeStudents: 42 })).source} />);

    expect(await screen.findByText('out of 42 Active Students')).toBeTruthy();
  });

  it('notes a Punch outside the Pooja Window instead of calling it Present', async () => {
    const punches = [
      {
        ...counted,
        punchedAt: AT_2200_IST,
        isCounted: false,
        notCountedBecause: 'outside-pooja-window' as const,
      },
    ];

    render(<App reports={reports} source={fakeSource(view({ punches })).source} />);

    const row = (await screen.findByText(NOTE)).closest('li');
    expect(within(row as HTMLElement).queryByText('Present')).toBeNull();
  });

  it('shows a new Punch without reloading the page', async () => {
    const { source, state } = fakeSource(view());
    render(<App reports={reports} source={source} />);
    await screen.findByText(/No Punches yet/);

    state.view = view({
      studentsPresent: 1,
      punches: [counted],
    });
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
    render(<App reports={reports} source={fakeSource(view()).source} />);

    expect(await screen.findByText(/No Punches yet today/)).toBeTruthy();
  });

  it('says how to fix it when the server cannot be reached', async () => {
    const { source, state } = fakeSource(view());
    state.failing = true;

    render(<App reports={reports} source={source} />);

    expect(await screen.findByText(/Start it with npm run dev/)).toBeTruthy();
  });

  it('stops listening when the page closes', async () => {
    const { source, state } = fakeSource(view());
    const { unmount } = render(<App reports={reports} source={source} />);
    await screen.findByText(/No Punches yet/);

    unmount();

    expect(state.listeners.size).toBe(0);
  });
});

describe('live view lists', () => {
  const punches = [counted];
  const pressed = (name: string) =>
    screen.getByRole('button', { name }).getAttribute('aria-pressed');

  it('opens on Latest Punches', async () => {
    render(<App reports={reports} source={fakeSource(view({ punches })).source} />);

    expect(await screen.findByText('Student ID 9001')).toBeTruthy();
    expect(pressed('Latest Punches')).toBe('true');
    expect(pressed('Every Student')).toBe('false');
  });

  it('switches to Every Student with sort and filter', async () => {
    render(<App reports={reports} source={fakeSource(view({ punches })).source} />);
    await screen.findByText('Student ID 9001');

    fireEvent.click(screen.getByRole('button', { name: 'Every Student' }));

    expect(await screen.findByText('Showing 2 of 2 Students')).toBeTruthy();
    expect(screen.getByLabelText('Sort by')).toBeTruthy();
    expect(screen.queryByText('Student ID 9001')).toBeNull();
  });

  it('goes back to Latest Punches', async () => {
    render(<App reports={reports} source={fakeSource(view({ punches })).source} />);
    await screen.findByText('Student ID 9001');
    fireEvent.click(screen.getByRole('button', { name: 'Every Student' }));
    await screen.findByText('Showing 2 of 2 Students');

    fireEvent.click(screen.getByRole('button', { name: 'Latest Punches' }));

    expect(await screen.findByText('Student ID 9001')).toBeTruthy();
  });

  it('keeps the live list on the live view page only', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));

    expect(screen.queryByRole('button', { name: 'Latest Punches' })).toBeNull();
  });
});

describe('menu', () => {
  it('lists the five pages with Live view current', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    const items = within(screen.getByRole('navigation')).getAllByRole('button');

    expect(items.map((item) => item.textContent)).toEqual([
      'Live view',
      'Students',
      'Leaves',
      'Review and Finalize',
      'Reports',
    ]);
    expect(items[0]?.getAttribute('aria-current')).toBe('page');
  });

  it('logs the Rector out from the menu', async () => {
    let loggedOut = 0;
    render(
      <App
        source={fakeSource(view()).source}
        onLogOut={() => {
          loggedOut++;
        }}
      />,
    );
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(loggedOut).toBe(1);
  });

  it('opens the Reports page with its two cards', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy();
    expect(await screen.findByText('Students by hour')).toBeTruthy();
    expect(screen.getByText('Showing 2 of 2 Students')).toBeTruthy();
  });

  it('opens the Review and Finalize page', async () => {
    const review: ReviewSource = {
      load: (day) =>
        Promise.resolve({
          day,
          canFinalize: false,
          finalization: null,
          needsReview: [],
          absent: [],
          notFinalizedDays: [],
        }),
      finalize: () => Promise.resolve({ reason: 'pooja-window-open' }),
      send: () => Promise.resolve({ reason: 'not-finalized' }),
    };
    render(<App reports={reports} review={review} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Review and Finalize' }));

    expect(screen.getByRole('heading', { name: 'Review and Finalize', level: 1 })).toBeTruthy();
    expect(await screen.findByText(/Finalize is available after 18:00/)).toBeTruthy();
    expect(screen.queryByText(/No Punches yet/)).toBeNull();
  });

  it('opens the Leaves page', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Leaves' }));

    expect(screen.getByRole('heading', { name: 'Leaves', level: 1 })).toBeTruthy();
  });
});
