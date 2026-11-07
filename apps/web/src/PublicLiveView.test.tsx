// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicLiveSource, PublicLiveView } from './public-live-source.js';
import { PublicLiveViewPage } from './PublicLiveView.js';

const AT_07_42 = Date.parse('2026-11-08T07:42:00+05:30');

const view = (facts: Partial<PublicLiveView> = {}): PublicLiveView => ({
  day: '2026-11-08',
  present: 42,
  expected: 100,
  // 42 Students made their first Punch between 07:00 and 07:15.
  slots: Array.from({ length: 50 }, (_, index) => (index === 6 ? 42 : 0)),
  updatedAt: AT_07_42,
  ...facts,
});

// Answers in turn; an Error in the list is a failed ask.
function fakeSource(answers: (PublicLiveView | Error)[]) {
  const state = { asked: 0 };
  const source: PublicLiveSource = {
    load: () => {
      const next = answers[Math.min(state.asked, answers.length - 1)];
      state.asked++;
      return next instanceof Error || next === undefined
        ? Promise.reject(next ?? new Error('none'))
        : Promise.resolve(next);
    },
  };
  return { source, state };
}

function show(answers: (PublicLiveView | Error)[], refreshMs = 60_000) {
  const fake = fakeSource(answers);
  const result = render(
    <PublicLiveViewPage source={fake.source} refreshMs={refreshMs} now={() => AT_07_42} />,
  );
  return { ...fake, ...result };
}

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="robots"]').forEach((tag) => {
    tag.remove();
  });
});

describe('the Public Live View page', () => {
  it("shows today's date and the Pooja Window", async () => {
    show([view()]);

    expect(
      await screen.findByRole('heading', { name: 'Sunday 8 November', level: 1 }),
    ).toBeTruthy();
    expect(screen.getByText('Pooja Window 05:30 to 18:00.')).toBeTruthy();
  });

  it('shows how many of the Students expected at Pooja have done it', async () => {
    show([view()]);

    const count = await screen.findByRole('status', { name: 'Pooja so far' });

    expect(count.textContent).toBe('42 of 100 have done Pooja');
  });

  it('draws the same 15-minute bars as the Live view', async () => {
    show([view()]);

    const bars = await screen.findByRole('img', { name: /most between 07:00 and 07:15/ });

    expect(bars.querySelectorAll('span[title]')).toHaveLength(50);
  });

  it('says when the numbers were last worked out', async () => {
    show([view()]);

    expect(await screen.findByText('Updated at 07:42')).toBeTruthy();
  });

  it('asks again by itself, and shows the new numbers', async () => {
    const { state } = show([view(), view({ present: 43 })], 20);

    const count = await screen.findByRole('status', { name: 'Pooja so far' });

    await waitFor(() => {
      expect(count.textContent).toBe('43 of 100 have done Pooja');
    });
    expect(state.asked).toBeGreaterThanOrEqual(2);
  });

  it('keeps the last numbers when a later ask fails, and says it will try again', async () => {
    show([view(), new Error('down')], 20);

    expect(await screen.findByText(/Could not refresh\. Trying again/)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Pooja so far' }).textContent).toBe(
      '42 of 100 have done Pooja',
    );
  });

  it('says so when it cannot reach EVLOS at all', async () => {
    show([new Error('down')]);

    expect(await screen.findByText(/cannot reach EVLOS right now/)).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Pooja so far' })).toBeNull();
  });

  it('stops asking once the page is closed', async () => {
    const { state, unmount } = show([view()], 20);
    await screen.findByText('Updated at 07:42');

    unmount();
    const askedWhenClosed = state.asked;
    await new Promise((done) => setTimeout(done, 80));

    expect(state.asked).toBe(askedWhenClosed);
  });

  it('has no login, no menu and no button: it only shows', async () => {
    show([view()]);
    await screen.findByText('Updated at 07:42');

    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it('asks search engines not to list it', async () => {
    show([view()]);
    await screen.findByText('Updated at 07:42');

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex',
    );
  });
});
