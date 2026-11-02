// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import type { LiveView, LiveViewSource } from './live-view-source.js';

const NOTE = 'Outside Pooja Window (05:30–18:00)';
const AT_0700_IST = Date.UTC(2026, 10, 2, 1, 30, 0);
const AT_2200_IST = Date.UTC(2026, 10, 2, 16, 30, 0);

const view = (facts: Partial<LiveView> = {}): LiveView => ({
  day: '2026-11-02',
  studentsPresent: 0,
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

// jsdom has no canvas, and the smoke animation is not what these tests check.
HTMLCanvasElement.prototype.getContext = () => null;

afterEach(cleanup);

describe('live view', () => {
  it('shows how many Students are Present so far', async () => {
    render(<App source={fakeSource(view({ studentsPresent: 214 })).source} />);

    expect(await screen.findByText('214')).toBeTruthy();
    expect(screen.getByText('Students Present so far')).toBeTruthy();
  });

  it('shows the Day in words', async () => {
    render(<App source={fakeSource(view()).source} />);

    expect(await screen.findByText(/2 November 2026/)).toBeTruthy();
  });

  it('shows a Punch with its Student ID and IST time', async () => {
    const punches = [{ studentId: '9001', punchedAt: AT_0700_IST, isCounted: true }];

    render(<App source={fakeSource(view({ punches })).source} />);

    const row = (await screen.findByText('Student ID 9001')).closest('li');
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText('07:00:00')).toBeTruthy();
    expect(within(row as HTMLElement).getByText('Present')).toBeTruthy();
  });

  it('notes a Punch outside the Pooja Window instead of calling it Present', async () => {
    const punches = [{ studentId: '9001', punchedAt: AT_2200_IST, isCounted: false }];

    render(<App source={fakeSource(view({ punches })).source} />);

    const row = (await screen.findByText(NOTE)).closest('li');
    expect(within(row as HTMLElement).queryByText('Present')).toBeNull();
  });

  it('shows a new Punch without reloading the page', async () => {
    const { source, state } = fakeSource(view());
    render(<App source={source} />);
    await screen.findByText(/No Punches yet/);

    state.view = view({
      studentsPresent: 1,
      punches: [{ studentId: '9001', punchedAt: AT_0700_IST, isCounted: true }],
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
    render(<App source={fakeSource(view()).source} />);

    expect(await screen.findByText(/No Punches yet today/)).toBeTruthy();
  });

  it('says how to fix it when the server cannot be reached', async () => {
    const { source, state } = fakeSource(view());
    state.failing = true;

    render(<App source={source} />);

    expect(await screen.findByText(/Start it with npm run dev/)).toBeTruthy();
  });

  it('stops listening when the page closes', async () => {
    const { source, state } = fakeSource(view());
    const { unmount } = render(<App source={source} />);
    await screen.findByText(/No Punches yet/);

    unmount();

    expect(state.listeners.size).toBe(0);
  });
});

describe('menu', () => {
  it('lists the five pages with Live view current', async () => {
    render(<App source={fakeSource(view()).source} />);
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

  it('says when a page that is not built yet will arrive', async () => {
    render(<App source={fakeSource(view()).source} />);
    await screen.findByText(/No Punches yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Students' }));

    expect(screen.getByText(/comes in Phase 4/)).toBeTruthy();
    expect(screen.queryByText(/No Punches yet/)).toBeNull();
  });
});
