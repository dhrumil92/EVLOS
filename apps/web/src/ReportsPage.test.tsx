// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ReportsPage } from './ReportsPage.js';
import type { PoojaStatusName, Report, ReportRequest, ReportSource } from './report-source.js';

const TODAY = '2026-11-07';
type Status = PoojaStatusName | null;

const ROWS: [string, string, ...Status[]][] = [
  ['101', 'Asha Rao', 'Present', 'Absent', 'Present'],
  ['102', 'Bina Rao', 'Present', 'Not Applicable', 'Absent'],
  ['103', 'Chitra Rao', 'Absent', 'Absent', 'Present'],
  ['204', 'Deepa Rao', 'Present', 'Present', 'Present'],
];

const titleOf = (request: ReportRequest) =>
  request.view === 'Day'
    ? `Day ${request.day}`
    : request.view === 'Month'
      ? `Month ${request.month}`
      : `${request.from} to ${request.to}`;

const reportFor = (request: ReportRequest, finalized = true): Report => {
  const days = request.view === 'Day' ? [request.day] : ['2026-10-12', '2026-10-13', '2026-10-14'];
  return {
    title: titleOf(request),
    isFinalized: finalized,
    rows: ROWS.map(([room, name, ...statuses]) => ({
      studentId: name,
      name,
      room,
      // A Day Report has one Pooja Status for each Student: the first of the month's.
      statuses: request.view === 'Day' ? [statuses[0] ?? null] : statuses,
    })),
    reportDays: days.map((day) => ({ day, isFinalized: finalized })),
  };
};

function show(options: { failing?: boolean; finalized?: boolean } = {}) {
  const asked: ReportRequest[] = [];
  const source: ReportSource = {
    load: (request) => {
      asked.push(request);
      return options.failing
        ? Promise.reject(new Error('down'))
        : Promise.resolve(reportFor(request, options.finalized ?? true));
    },
    csvUrl: (request, status) => `/csv/${request.view}/${status}`,
    xlsxUrl: (request, status) => `/xlsx/${request.view}/${status}`,
  };
  render(<ReportsPage source={source} today={TODAY} />);
  return { asked };
}

const chip = (name: string) => screen.getByRole('button', { name });
const countOf = (name: string) =>
  screen.getByText(name, { selector: 'dt' }).nextElementSibling?.textContent;

afterEach(cleanup);

describe('Reports page', () => {
  it('has the title and nothing explaining the buttons', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.getByRole('heading', { name: 'Reports', level: 1 })).toBeTruthy();
    expect(screen.queryByText(/ready below/)).toBeNull();
  });

  it('opens on this month, without a press', async () => {
    const { asked } = show();

    expect(await screen.findByRole('heading', { name: 'Month 2026-11' })).toBeTruthy();
    expect(asked).toEqual([{ view: 'Month', month: '2026-11' }]);
    expect(chip('Month').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText<HTMLInputElement>('Month').value).toBe('2026-11');
  });

  it('offers Day, Month and Pick dates, and no other period', async () => {
    show();
    await screen.findByText('Month 2026-11');

    const chips = within(screen.getByRole('group', { name: 'Period' })).getAllByRole('button');

    expect(chips.map((one) => one.textContent)).toEqual(['Day', 'Month', 'Pick dates']);
  });

  it('has no last night card and no downloads of it', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.queryByRole('region', { name: 'Last night' })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('has no month numbers such as Worst Day', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.queryByText('Worst Day')).toBeNull();
    expect(screen.queryByText('Present on a usual Day')).toBeNull();
    expect(screen.queryByText('Students Absent at least once')).toBeNull();
  });

  it('says whether every Day of the month is Finalized', async () => {
    show();

    expect(await screen.findByText('3 Days, all Finalized')).toBeTruthy();
  });

  it('draws three bars for each Day of the month', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.getAllByRole('button', { name: /^\w+day \d+ October: Present/ })).toHaveLength(3);
  });

  it('lists every Student of the month, the most Absent first', async () => {
    show();
    await screen.findByText('Month 2026-11');

    const table = screen.getByRole('table', { name: 'Students in Month 2026-11' });
    const names = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

    expect(names).toEqual(['Chitra Rao', 'Asha Rao', 'Bina Rao', 'Deepa Rao']);
  });

  it('says how to fix it when the Report cannot load', async () => {
    show({ failing: true });

    expect(await screen.findByText(/This Report could not load/)).toBeTruthy();
  });
});

describe('the Month choice', () => {
  it('cannot go past this month', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.getByLabelText<HTMLInputElement>('Month').max).toBe('2026-11');
  });

  it('loads the month the Rector changes it to', async () => {
    const { asked } = show();
    await screen.findByText('Month 2026-11');

    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } });

    expect(await screen.findByRole('heading', { name: 'Month 2026-10' })).toBeTruthy();
    expect(asked).toContainEqual({ view: 'Month', month: '2026-10' });
  });

  it('shows no Present, Not Applicable and Absent counts for a month', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(screen.queryByText('Present', { selector: 'dt' })).toBeNull();
  });
});

describe('the Day choice', () => {
  const chooseDay = async () => {
    const result = show();
    await screen.findByText('Month 2026-11');
    fireEvent.click(chip('Day'));
    return result;
  };

  it('starts on today, filled in, and loads that Day', async () => {
    const { asked } = await chooseDay();

    expect(await screen.findByRole('heading', { name: `Day ${TODAY}` })).toBeTruthy();
    expect(asked).toContainEqual({ view: 'Day', day: TODAY });
    expect(screen.getByLabelText<HTMLInputElement>('Day').value).toBe(TODAY);
  });

  it('can be changed to another Day, but not to a Day after today', async () => {
    const { asked } = await chooseDay();
    await screen.findByText(`Day ${TODAY}`);

    expect(screen.getByLabelText<HTMLInputElement>('Day').max).toBe(TODAY);
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-11-03' } });

    expect(await screen.findByRole('heading', { name: 'Day 2026-11-03' })).toBeTruthy();
    expect(asked).toContainEqual({ view: 'Day', day: '2026-11-03' });
  });

  it('shows how many Students were Present, Not Applicable and Absent that Day', async () => {
    await chooseDay();
    await screen.findByText(`Day ${TODAY}`);

    // On the first Day: Asha, Bina and Deepa Present, Chitra Absent.
    expect(countOf('Present')).toBe('3');
    expect(countOf('Not Applicable')).toBe('0');
    expect(countOf('Absent')).toBe('1');
  });

  it('says only Finalized, not a count of Days', async () => {
    await chooseDay();

    expect(await screen.findByText('Finalized')).toBeTruthy();
  });

  it('says Not Finalized, and counts Needs Review only if there is any', async () => {
    show({ finalized: false });
    await screen.findByText('Month 2026-11');

    fireEvent.click(chip('Day'));

    expect(await screen.findByText('Not Finalized')).toBeTruthy();
    expect(screen.queryByText('Needs Review', { selector: 'dt' })).toBeNull();
  });

  it('draws no chart for one Day', async () => {
    await chooseDay();
    await screen.findByText(`Day ${TODAY}`);

    expect(screen.queryByText('Every Day')).toBeNull();
  });

  it('puts the counts on the same row as the title and the downloads', async () => {
    await chooseDay();
    const title = await screen.findByRole('heading', { name: `Day ${TODAY}` });

    const row = title.parentElement?.parentElement as HTMLElement;

    expect(within(row).getByText('Present', { selector: 'dt' })).toBeTruthy();
    expect(within(row).getByLabelText('Rows')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'Download the day as Excel' })).toBeTruthy();
  });
});

describe('Pick dates', () => {
  const pickDates = async () => {
    const result = show();
    await screen.findByText('Month 2026-11');
    fireEvent.click(chip('Pick dates'));
    return result;
  };

  it('starts on the 1st of this month to today, filled in', async () => {
    const { asked } = await pickDates();

    expect(await screen.findByRole('heading', { name: '2026-11-01 to 2026-11-07' })).toBeTruthy();
    expect(asked).toContainEqual({ view: 'Date range', from: '2026-11-01', to: TODAY });
    expect(screen.getByLabelText<HTMLInputElement>('From').value).toBe('2026-11-01');
    expect(screen.getByLabelText<HTMLInputElement>('To').value).toBe(TODAY);
  });

  it('does not let To be a date before From', async () => {
    await pickDates();
    await screen.findByText('2026-11-01 to 2026-11-07');

    expect(screen.getByLabelText<HTMLInputElement>('To').min).toBe('2026-11-01');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } });

    expect(screen.getByLabelText<HTMLInputElement>('To').value).toBe('2026-11-01');
  });

  it('moves the least To along when From is changed', async () => {
    await pickDates();
    await screen.findByText('2026-11-01 to 2026-11-07');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-03' } });

    expect(screen.getByLabelText<HTMLInputElement>('To').min).toBe('2026-11-03');
  });

  it('cannot go past today', async () => {
    await pickDates();
    await screen.findByText('2026-11-01 to 2026-11-07');

    expect(screen.getByLabelText<HTMLInputElement>('To').max).toBe(TODAY);
  });

  it('loads the range when From is changed', async () => {
    const { asked } = await pickDates();
    await screen.findByText('2026-11-01 to 2026-11-07');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-03' } });

    await waitFor(() => {
      expect(asked).toContainEqual({ view: 'Date range', from: '2026-11-03', to: TODAY });
    });
  });

  it('can be a single Day, with From and To the same', async () => {
    const { asked } = await pickDates();
    await screen.findByText('2026-11-01 to 2026-11-07');

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-01' } });

    await waitFor(() => {
      expect(asked).toContainEqual({ view: 'Date range', from: '2026-11-01', to: '2026-11-01' });
    });
  });
});

describe('the downloads', () => {
  it('are one Excel and one CSV for the period shown', async () => {
    show();
    await screen.findByText('Month 2026-11');

    expect(
      screen.getByRole('link', { name: 'Download the month as Excel' }).getAttribute('href'),
    ).toBe('/xlsx/Month/All');
    expect(
      screen.getByRole('link', { name: 'Download the month as CSV' }).getAttribute('href'),
    ).toBe('/csv/Month/All');
  });

  it('follow the period chosen, so a single Day can be downloaded', async () => {
    show();
    await screen.findByText('Month 2026-11');

    fireEvent.click(chip('Day'));

    expect(
      (await screen.findByRole('link', { name: 'Download the day as Excel' })).getAttribute('href'),
    ).toBe('/xlsx/Day/All');
  });

  it('hold only the Students chosen in Rows', async () => {
    show();
    await screen.findByText('Month 2026-11');

    fireEvent.change(screen.getByLabelText('Rows'), { target: { value: 'Absent' } });

    expect(
      screen.getByRole('link', { name: 'Download the month as Excel' }).getAttribute('href'),
    ).toBe('/xlsx/Month/Absent');
    expect(
      screen.getByRole('link', { name: 'Download the month as CSV' }).getAttribute('href'),
    ).toBe('/csv/Month/Absent');
  });

  it('offer Every Student, Absent only, Not Applicable only and Present only in Rows', async () => {
    show();
    await screen.findByText('Month 2026-11');

    const options = within(screen.getByLabelText('Rows')).getAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'Every Student',
      'Absent only',
      'Not Applicable only',
      'Present only',
    ]);
  });
});
