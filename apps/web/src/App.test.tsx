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

  it('keeps the menu bar in view while the page scrolls', async () => {
    render(<App reports={reports} source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    expect(screen.getByRole('banner').classList.contains('sticky')).toBe(true);
  });

  describe('on a phone', () => {
    const open = async (onLogOut?: () => void) => {
      render(<App reports={reports} source={fakeSource(view()).source} onLogOut={onLogOut} />);
      await screen.findByText(/No Punches yet/);
      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      return screen.getByRole('navigation', { name: 'Pages' });
    };

    it('has a three-line button, and the side panel is closed at first', async () => {
      render(<App reports={reports} source={fakeSource(view()).source} />);
      await screen.findByText(/No Punches yet/);

      const button = screen.getByRole('button', { name: 'Menu' });

      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
      expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
    });

    it('slides in a panel with the pages when the button is pressed', async () => {
      const pages = await open();

      expect(screen.getByRole('dialog', { name: 'Menu' }).contains(pages)).toBe(true);
      expect(
        within(pages)
          .getAllByRole('button')
          .map((item) => item.textContent)
          .filter((text) => text !== ''),
      ).toEqual(['Live view', 'Students', 'Leaves', 'Review and Finalize', 'Reports', 'Settings']);
    });

    it('puts Settings and Log out at the bottom, after the pages', async () => {
      const pages = await open(() => undefined);

      const buttons = within(pages)
        .getAllByRole('button')
        .map((item) => item.textContent);

      expect(buttons.slice(-2)).toEqual(['Settings', 'Log out']);
      expect(buttons.indexOf('Reports')).toBeLessThan(buttons.indexOf('Settings'));
      const bottom = within(pages).getByRole('button', { name: 'Settings' }).parentElement;
      expect(bottom?.classList.contains('mt-auto')).toBe(true);
    });

    it('marks the page the Rector is on', async () => {
      const pages = await open();

      expect(
        within(pages).getByRole('button', { name: 'Live view' }).getAttribute('aria-current'),
      ).toBe('page');
      expect(
        within(pages).getByRole('button', { name: 'Students' }).getAttribute('aria-current'),
      ).toBeNull();
    });

    it('opens the page pressed, and closes the panel', async () => {
      const pages = await open();

      fireEvent.click(within(pages).getByRole('button', { name: 'Leaves' }));

      expect(screen.getByRole('heading', { name: 'Leaves', level: 1 })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Menu' }).getAttribute('aria-expanded')).toBe(
        'false',
      );
    });

    it('opens Settings from the bottom of the panel', async () => {
      const pages = await open();

      fireEvent.click(within(pages).getByRole('button', { name: 'Settings' }));

      expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    });

    it('logs the Rector out from the panel, and closes it', async () => {
      let loggedOut = 0;
      const pages = await open(() => {
        loggedOut++;
      });

      fireEvent.click(within(pages).getByRole('button', { name: 'Log out' }));

      expect(loggedOut).toBe(1);
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    });

    it('closes with its cross, with the dimmed strip of the page, and with Escape', async () => {
      await open();
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
      fireEvent.keyDown(screen.getByRole('navigation', { name: 'Pages' }), { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull();
    });

    it('puts the cross in reach, and stops the page behind from scrolling while open', async () => {
      await open();

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
      expect(document.body.style.overflow).toBe('hidden');

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      expect(document.body.style.overflow).not.toBe('hidden');
    });
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
      .filter((button) => !button.closest('nav') && button.getAttribute('aria-label') !== 'Menu')
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
