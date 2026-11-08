// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DeviceStatusSource } from './device-status-source.js';
import type { ReportSource } from './report-source.js';
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

// A Day Report: 3 Present, 1 Not Applicable, 2 Needs Review.
const DAY_STATUSES = [
  'Present',
  'Present',
  'Present',
  'Not Applicable',
  'Needs Review',
  'Needs Review',
] as const;
const dayReport: ReportSource = {
  load: () =>
    Promise.resolve({
      title: 'Tuesday 3 November 2026',
      isFinalized: false,
      rows: DAY_STATUSES.map((status, index) => ({
        studentId: String(9001 + index),
        name: `Student ${String(index)}`,
        room: '101',
        statuses: [status],
      })),
      reportDays: [],
    }),
  csvUrl: () => '',
  xlsxUrl: () => '',
};

// A Device last seen at 23:05, quiet or not.
const deviceSeen = (isQuiet: boolean): DeviceStatusSource => ({
  load: () => Promise.resolve({ lastSeenAt: AT_2305_IST, isQuiet }),
});

afterEach(cleanup);

describe('Review and Finalize, before Finalize', () => {
  it('lists the Needs Review Students and reminds to check both books first', async () => {
    render(<ReviewPage source={fakeSource(open).source} today={TODAY} />);

    const list = await screen.findByRole('table', { name: 'Needs Review' });
    expect(within(list).getByText('Bina Rao')).toBeTruthy();
    expect(within(list).getByText('Chitra Rao')).toBeTruthy();
    expect(screen.getByText('2 Students Need Review')).toBeTruthy();
    expect(screen.getByText(/Check the Leave Notes and both books/)).toBeTruthy();
  });

  it('shows the four steps, with Review as the current one', async () => {
    render(<ReviewPage source={fakeSource(open).source} today={TODAY} />);

    const steps = await screen.findByRole('list', { name: 'Steps for this Day' });
    const items = within(steps).getAllByRole('listitem');
    const current = items.filter((step) => step.getAttribute('aria-current') === 'step');
    expect(items).toHaveLength(4);
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('Review');
  });

  it('counts Present, Not Applicable and Needs Review for the Day', async () => {
    render(<ReviewPage source={fakeSource(open).source} reports={dayReport} today={TODAY} />);

    const counts = await screen.findByRole('region', { name: 'Pooja Status for this Day' });
    await within(counts).findByText('3');
    const count = (label: string) => within(counts).getByText(label).nextSibling?.textContent;
    expect(count('Present')).toBe('3');
    expect(count('Not Applicable (on Leave)')).toBe('1');
    expect(count('Needs Review')).toBe('2');
    expect(count('Active Students')).toBe('6');
  });

  it('the Finalize confirmation names the Students who become Absent, and Finalizes on Yes', async () => {
    const { source, state } = fakeSource(open);
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    const dialog = screen.getByRole('dialog', { name: 'Finalize Tuesday 3 November?' });
    expect(within(dialog).getByText('These 2 Students become Absent:')).toBeTruthy();
    expect(within(dialog).getByText('Bina Rao')).toBeTruthy();
    expect(within(dialog).getByText('Chitra Rao')).toBeTruthy();
    expect(state.finalized).toEqual([]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Finalize the Day' }));

    expect(await screen.findByText(/Finalized at 23:05 by rector@example.com/)).toBeTruthy();
    expect(state.finalized).toEqual([TODAY]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("shows the Device's Last Seen before Finalize", async () => {
    render(
      <ReviewPage source={fakeSource(open).source} device={deviceSeen(false)} today={TODAY} />,
    );

    expect(await screen.findByText('Device last seen 3 Nov, 23:05.')).toBeTruthy();
  });

  it('a quiet Device warns in the confirmation and makes going back the main choice', async () => {
    const { source, state } = fakeSource(open);
    render(<ReviewPage source={source} device={deviceSeen(true)} today={TODAY} />);
    await screen.findByText(/Device last seen/);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        'The Device has not been in touch for 10 minutes or more, so Punches may still be on it.',
      ),
    ).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Finalize anyway' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Go back and check the Device' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(state.finalized).toEqual([]);
  });

  it('Escape closes the confirmation without Finalizing', async () => {
    const { source, state } = fakeSource(open);
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(state.finalized).toEqual([]);
  });

  it('says so when the server cannot finish Finalize, instead of showing nothing', async () => {
    const source: ReviewSource = {
      ...fakeSource(open).source,
      finalize: () => Promise.reject(new Error('The server answered 500')),
    };
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Finalize the Day' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Finalize the Day' }));

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

  it('the previous-Day arrow opens the day before, and the next-Day arrow stops at today', async () => {
    const { source, state } = fakeSource(open);
    render(<ReviewPage source={source} today={TODAY} />);
    await screen.findByRole('table', { name: 'Needs Review' });
    expect(screen.getByRole('button', { name: 'Next Day' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: 'Previous Day' }));
    expect(state.asked.at(-1)).toBe('2026-11-02');

    fireEvent.click(screen.getByRole('button', { name: 'Next Day' }));
    expect(state.asked.at(-1)).toBe(TODAY);
  });

  it('Record a missed Leave opens the Leaves page', async () => {
    let opened = 0;
    render(
      <ReviewPage
        source={fakeSource(open).source}
        today={TODAY}
        onOpenLeaves={() => {
          opened++;
        }}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Record a missed Leave for Bina Rao' }),
    );

    expect(opened).toBe(1);
  });
});

describe('Review and Finalize, after Finalize', () => {
  it('shows Review and Finalize as done, and Exclude as the current step', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);

    const steps = await screen.findByRole('list', { name: 'Steps for this Day' });
    const current = within(steps)
      .getAllByRole('listitem')
      .find((step) => step.getAttribute('aria-current') === 'step');
    expect(current?.textContent).toContain('Exclude if needed');
  });

  it('Excludes a Student, and Include again undoes it', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Exclude Bina Rao' }));
    expect(screen.getByRole('button', { name: 'Send Notifications to 1 Student' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Include Bina Rao again' }));
    expect(screen.getByRole('button', { name: 'Send Notifications to 2 Students' })).toBeTruthy();
  });

  it('the Email column says who will get the email and who is Excluded', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);
    const list = await screen.findByRole('table', { name: 'Email list' });

    fireEvent.click(within(list).getByRole('button', { name: 'Exclude Bina Rao' }));

    const row = (name: string) => within(list).getByText(name).closest('tr') as HTMLElement;
    expect(within(row('Bina Rao')).getByText('Excluded')).toBeTruthy();
    expect(within(row('Chitra Rao')).getByText('Will get the email')).toBeTruthy();
  });

  it('the bottom bar counts who will get the email and who is Excluded', async () => {
    render(<ReviewPage source={fakeSource(finalized).source} today={TODAY} />);
    expect(await screen.findByText('2 Students will get the email.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Exclude Bina Rao' }));

    expect(screen.getByText('1 Student will get the email. 1 is Excluded.')).toBeTruthy();
  });

  it('Go back leaves the Notifications unsent', async () => {
    const { source, state } = fakeSource(finalized);
    render(<ReviewPage source={source} today={TODAY} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Send Notifications to 2 Students' }),
    );
    expect(screen.getByText('Send 2 emails now?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(state.sent).toEqual([]);
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

  it('shows how far each Notification has got, or Excluded, and offers no Exclude for them', async () => {
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

  const punchedLate: Review = {
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
  };

  it('labels a Punch After Finalize in the list and in a banner above it', async () => {
    render(<ReviewPage source={fakeSource(punchedLate).source} today={TODAY} />);

    const list = await screen.findByRole('table', { name: 'Email list' });
    expect(within(list).getByText('Punched at 07:00, arrived after Finalize')).toBeTruthy();
    expect(within(list).getAllByText(/arrived after Finalize/)).toHaveLength(1);
    const banner = screen.getByRole('region', { name: 'Punch After Finalize' });
    expect(
      within(banner).getByText(
        'Bina Rao punched at 07:00 in the Pooja Window, but the Punch reached EVLOS after you Finalized. The Student stays Absent in Reports.',
      ),
    ).toBeTruthy();
  });

  it('the Punch After Finalize banner Excludes that Student in one click', async () => {
    render(<ReviewPage source={fakeSource(punchedLate).source} today={TODAY} />);
    const banner = await screen.findByRole('region', { name: 'Punch After Finalize' });

    fireEvent.click(
      within(banner).getByRole('button', {
        name: 'Exclude Bina Rao, whose Punch arrived after Finalize',
      }),
    );

    expect(within(banner).getByText('Excluded. No email will go out.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send Notifications to 1 Student' })).toBeTruthy();
  });
});
