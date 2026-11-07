import type { PoojaStatusName } from './report-source.js';

// The month of one Student as a calendar: the Pooja Status of each Day, from the Month
// Report. The Report stops at today, so a Day it does not reach has no Pooja Status.
export interface DayBox {
  day: number;
  status: PoojaStatusName | null;
  isToday: boolean;
  // A Day after today: it has no Pooja Status yet, which is not the same as "not Active".
  isFuture: boolean;
}

export interface MonthGrid {
  // Empty places before the 1st, with the week starting on Monday.
  blanks: number;
  boxes: DayBox[];
}

const partsOf = (month: string) => {
  const [year = 0, number = 0] = month.split('-').map(Number);
  return { year, number };
};

export function monthGrid(
  month: string,
  statuses: readonly (PoojaStatusName | null)[],
  today: string,
): MonthGrid {
  const { year, number } = partsOf(month);
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const boxes = Array.from({ length: days }, (_, index): DayBox => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    return {
      day: index + 1,
      status: statuses[index] ?? null,
      isToday: date === today,
      isFuture: date > today,
    };
  });
  return { blanks: (firstWeekday + 6) % 7, boxes };
}

const COUNTED: PoojaStatusName[] = [
  'Present',
  'Absent',
  'Not Applicable',
  'Needs Review',
  'Pending',
];

// "18 Present, 1 Absent, 3 Not Applicable": only the Pooja Statuses that occur.
export function monthCounts(statuses: readonly (PoojaStatusName | null)[]): string {
  const parts = COUNTED.map((name) => ({
    name,
    count: statuses.filter((status) => status === name).length,
  }))
    .filter((part) => part.count > 0)
    .map((part) => `${String(part.count)} ${part.name}`);
  return parts.length === 0 ? 'No Pooja Status for this month.' : parts.join(', ');
}

const step = (month: string, by: number) => {
  const { year, number } = partsOf(month);
  const moved = new Date(Date.UTC(year, number - 1 + by, 1));
  return `${String(moved.getUTCFullYear())}-${String(moved.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const monthBefore = (month: string) => step(month, -1);
export const monthAfter = (month: string) => step(month, 1);

const words = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export const monthInWords = (month: string) => {
  const { year, number } = partsOf(month);
  return words.format(new Date(Date.UTC(year, number - 1, 1)));
};
