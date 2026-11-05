// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceStatusSource } from './device-status-source.js';
import type { Review, ReviewSource } from './review-source.js';
import { ReviewPage } from './ReviewPage.js';

const TODAY = '2026-11-03';
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const AT_2305_IST = Date.UTC(2026, 10, 3, 23, 5) - IST_OFFSET_MS;
const AT_0700_IST = Date.UTC(2026, 10, 3, 7, 0) - IST_OFFSET_MS;
const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';

const student = (studentId: string, name: string, room: string) => ({ studentId, name, room });

const open: Review = {
  day: TODAY,
  canFinalize: true,
  finalization: null,
  needsReview: [student('9002', 'Bina Rao', '205'), student('9003', 'Chitra Rao', '310')],
  absent: [],
  notFinalizedDays: [TODAY],
};

const finalized: Review = {
  ...open,
  canFinalize: false,
  finalization: { finalizedBy: 'rector@example.com', finalizedAt: AT_2305_IST },
  needsReview: [],
  absent: [
    {
      ...student('9002', 'Bina Rao', '205'),
      isExcluded: false,
      notification: null,
      punchAfterFinalize: null,
    },
    {
      ...student('9003', 'Chitra Rao', '310'),
      isExcluded: false,
      notification: null,
      punchAfterFinalize: null,
    },
  ],
  notFinalizedDays: [],
};

function fakeSource(first: Review) {
  const state = {
    review: first,
    asked: [] as string[],
    finalized: [] as string[],
    sent: [] as unknown[],
  };
  const source: ReviewSource = {
    load: (day) => {
      state.asked.push(day);
      return Promise.resolve(state.review);
    },
    finalize: (day) => {
      state.finalized.push(day);
      state.review = finalized;
      return Promise.resolve({ outcome: 'finalized', absent: 2 });
    },
    send: (day, excluded) => {
      state.sent.push([day, excluded]);
      return Promise.resolve({ outcome: 'queued', queued: 2 - excluded.length });
    },
  };
  return { source, state };
}

// A Device last seen at 23:05, quiet or not.
const deviceSeen = (isQuiet: boolean): DeviceStatusSource => ({
  load: () => Promise.resolve({ lastSeenAt: AT_2305_IST, isQuiet }),
});

afterEach(cleanup);

describe('Review and Finalize, before Finalize', () => {
  it('lists the Needs Review Students and reminds to check the books first', async () => {
    render(<ReviewPage source={fakeSource(open).source} today={TODAY} />);

    const list = await screen.findByRole('table', { name: 'Needs Review' });
    expect(within(list).getByText('Bina Rao')).toBeTruthy();
    expect(within(list).getByText('Chitra Rao')).toBeTruthy();
    expect(screen.getByText(/check the Leave Notes and both books/)).toBeTruthy();
  });

  it('shows a summary and asks before it Finalizes', async () => {
    const { source, state } = fakeSource(open);
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    expect(screen.getByText('2 Students will be Absent. The Day will be locked.')).toBeTruthy();
    expect(state.finalized).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Finalize' }));

    expect(await screen.findByText(/Finalized at 23:05 by rector@example.com/)).toBeTruthy();
    expect(state.finalized).toEqual([TODAY]);
  });

  it("shows the Device's Last Seen before Finalize", async () => {
    render(
      <ReviewPage source={fakeSource(open).source} device={deviceSeen(false)} today={TODAY} />,
    );

    expect(await screen.findByText('Device last seen 3 Nov, 23:05.')).toBeTruthy();
  });

  it('warns in the Finalize question when the Device has gone quiet', async () => {
    render(<ReviewPage source={fakeSource(open).source} device={deviceSeen(true)} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));

    expect(
      screen.getByText(
        'The Device has not been in touch for 10 minutes or more, so Punches may still be on ' +
          'it. 2 Students will be Absent. The Day will be locked.',
      ),
    ).toBeTruthy();
  });

  it('says so when the server cannot finish Finalize, instead of showing nothing', async () => {
    const source: ReviewSource = {
      ...fakeSource(open).source,
      finalize: () => Promise.reject(new Error('The server answered 500')),
    };
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Finalize' }));

    expect(await screen.findByText(SERVER_FAILED)).toBeTruthy();
  });

  it('says when Finalize becomes available while the Pooja Window is open', async () => {
    render(
      <ReviewPage
        source={fakeSource({ ...open, canFinalize: false, needsReview: [] }).source}
        today={TODAY}
      />,
    );

    expect(await screen.findByText(/Finalize is available after 18:00/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finalize the Day' })).toBeNull();
  });

  it('allows no future Day and lists past Days not Finalized yet', async () => {
    const { source, state } = fakeSource({ ...open, notFinalizedDays: ['2026-11-01', TODAY] });
    render(<ReviewPage source={source} today={TODAY} />);

    const picker = await screen.findByLabelText<HTMLInputElement>('Day');
    expect(picker.max).toBe(TODAY);
    fireEvent.click(screen.getByRole('button', { name: 'Sunday 1 November' }));

    expect(state.asked.at(-1)).toBe('2026-11-01');
  });
});

describe('Review and Finalize, after Finalize', () => {
  it('Excludes a Student with his cross, and the cross can be undone', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Exclude Bina Rao' }));
    expect(screen.getByRole('button', { name: 'Send Notifications to 1 Student' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Include Bina Rao again' }));
    expect(screen.getByRole('button', { name: 'Send Notifications to 2 Students' })).toBeTruthy();
  });

  it('asks before it sends, then sends with the Excluded Students', async () => {
    const { source, state } = fakeSource(finalized);
    render(<ReviewPage source={source} today={TODAY} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Exclude Bina Rao' }));

    fireEvent.click(screen.getByRole('button', { name: 'Send Notifications to 1 Student' }));
    expect(state.sent).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send' }));

    expect(await screen.findByText(/1 Notification queued/)).toBeTruthy();
    expect(state.sent).toEqual([[TODAY, ['9002']]]);
  });

  it('says the queued Notifications go out within a few minutes', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Send Notifications to 2 Students' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send' }));

    expect(
      await screen.findByText('2 Notifications queued. Emails go out within a few minutes.'),
    ).toBeTruthy();
  });

  it('says so when the server cannot finish Send Notifications, instead of showing nothing', async () => {
    const source: ReviewSource = {
      ...fakeSource(finalized).source,
      send: () => Promise.reject(new Error('The server answered 500')),
    };
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Send Notifications to 2 Students' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send' }));

    expect(await screen.findByText(SERVER_FAILED)).toBeTruthy();
  });

  it('shows how far each Notification has got, or Excluded, and offers no cross for them', async () => {
    render(
      <ReviewPage
        source={
          fakeSource({
            ...finalized,
            absent: [
              {
                ...student('9002', 'Bina Rao', '205'),
                isExcluded: true,
                notification: null,
                punchAfterFinalize: null,
              },
              {
                ...student('9003', 'Chitra Rao', '310'),
                isExcluded: false,
                notification: 'queued',
                punchAfterFinalize: null,
              },
              {
                ...student('9004', 'Divya Rao', '402'),
                isExcluded: false,
                notification: 'sent',
                punchAfterFinalize: null,
              },
              {
                ...student('9005', 'Esha Rao', '503'),
                isExcluded: false,
                notification: 'failed',
                punchAfterFinalize: null,
              },
            ],
          }).source
        }
        today={TODAY}
      />,
    );

    expect(await screen.findByText('Excluded')).toBeTruthy();
    expect(screen.getByText('Notification queued')).toBeTruthy();
    expect(screen.getByText('Notification sent')).toBeTruthy();
    expect(screen.getByText('Notification not sent')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Exclude/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send Notifications to 0 Students' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('labels a Punch After Finalize and asks to check before sending', async () => {
    render(
      <ReviewPage
        source={
          fakeSource({
            ...finalized,
            absent: [
              {
                ...student('9002', 'Bina Rao', '205'),
                isExcluded: false,
                notification: null,
                punchAfterFinalize: AT_0700_IST,
              },
              {
                ...student('9003', 'Chitra Rao', '310'),
                isExcluded: false,
                notification: null,
                punchAfterFinalize: null,
              },
            ],
          }).source
        }
        today={TODAY}
      />,
    );

    const list = await screen.findByRole('list', { name: 'Email list' });
    expect(within(list).getByText('Punched at 07:00, arrived after Finalize')).toBeTruthy();
    expect(within(list).getAllByText(/arrived after Finalize/)).toHaveLength(1);
    expect(
      screen.getByText(
        '1 Student punched in the Pooja Window, but the Punch arrived after Finalize. ' +
          'Check before you Send Notifications, and Exclude a Student who was at Pooja.',
      ),
    ).toBeTruthy();
  });
});
