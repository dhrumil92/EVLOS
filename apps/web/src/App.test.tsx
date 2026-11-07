// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { LiveView, LiveViewSource } from './live-view-source.js';
import type { ReportSource } from './report-source.js';
import type { ReviewSource } from './review-source.js';
import type { SettingsSource } from './settings-source.js';
import type { ListedStudent, StudentSource } from './student-source.js';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const ist = (date: number, hour: number) => Date.UTC(2026, 10, date, hour) - IST_OFFSET_MS;

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
      reportDays: [],
    }),
};

// A Review of a Day that is not Finalized, for the tests that open Reports or Review and Finalize.
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

afterEach(cleanup);

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

  it('shows Settings just before Log out, apart from the page menu', async () => {
    render(<App source={fakeSource(view()).source} onLogOut={() => undefined} />);
    await screen.findByText(/No Punches yet/);

    const header = screen.getByRole('banner');
    const outsideMenu = within(header)
      .getAllByRole('button')
      .filter((button) => !button.closest('nav'))
      .map((button) => button.textContent);

    expect(outsideMenu).toEqual(['Settings', 'Log out']);
  });

  it('opens the Settings page with the Report Recipients', async () => {
    const settings: SettingsSource = {
      reportRecipients: () => Promise.resolve(['office@example.com']),
      addReportRecipient: () => Promise.resolve('done'),
      removeReportRecipient: () => Promise.resolve('done'),
      changePassword: () => Promise.resolve('done'),
    };
    render(<App settings={settings} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(await screen.findByText('office@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('opens the Reports page on this month, with its period choices', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Month report' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('region', { name: 'Last night' })).toBeNull();
  });

  it('opens the Review and Finalize page', async () => {
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

  it('Return on the Live view opens the Back-from-Home Book with that Student ticked', async () => {
    const asha: ListedStudent = {
      studentId: '9001',
      name: 'Asha Rao',
      room: '101',
      email: 'asha@example.com',
      phone: null,
      isActive: true,
      floor: 1,
      leaveState: 'Away',
      openLeave: { outAt: ist(1, 16), expectedReturnAt: ist(9, 18) },
    };
    const students = { list: () => Promise.resolve([asha]) } as unknown as StudentSource;
    render(<App reports={reports} students={students} source={fakeSource(view()).source} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Record Return for Asha Rao' }));

    expect(screen.getByRole('heading', { name: 'Leaves', level: 1 })).toBeTruthy();
    expect(await screen.findByRole('checkbox', { name: 'Asha Rao came back' })).toHaveProperty(
      'checked',
      true,
    );
  });
});
