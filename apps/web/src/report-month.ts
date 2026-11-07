import type { PoojaStatusName, Report, ReportRequest } from './report-source.js';
import { byRoom } from './student-order.js';

// The month Report on the Reports page: the periods, four numbers, a bar for each Day and a
// strip for each Student. Everything is worked out from one Report.
export type PeriodKey = 'day' | 'month' | 'dates';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'month', label: 'Month' },
  { key: 'dates', label: 'Pick dates' },
];

// What the Rector has chosen in the date fields. Each period uses its own.
export interface Picks {
  day: string;
  month: string;
  from: string;
  to: string;
}

// At first: today, this month, and this month from the 1st to today. The Rector can change them.
export function startPicks(today: string): Picks {
  const thisMonth = today.slice(0, 7);
  return { day: today, month: thisMonth, from: `${thisMonth}-01`, to: today };
}

export function requestFor(key: PeriodKey, picks: Picks): ReportRequest {
  if (key === 'day') return { view: 'Day', day: picks.day };
  if (key === 'month') return { view: 'Month', month: picks.month };
  return { view: 'Date range', from: picks.from, to: picks.to };
}

// One field changed. To is never before From: a To before it becomes the From itself.
export function withPick(picks: Picks, name: keyof Picks, value: string): Picks {
  const next = { ...picks, [name]: value };
  return next.to < next.from ? { ...next, to: next.from } : next;
}

export interface DayCount {
  day: string;
  present: number;
  absent: number;
  notApplicable: number;
  needsReview: number;
}

const countOn = (report: Report, index: number, status: PoojaStatusName) =>
  report.rows.filter((row) => row.statuses[index] === status).length;

export function dayTotals(report: Report): DayCount[] {
  return report.reportDays.map((one, index) => ({
    day: one.day,
    present: countOn(report, index, 'Present'),
    absent: countOn(report, index, 'Absent'),
    notApplicable: countOn(report, index, 'Not Applicable'),
    needsReview: countOn(report, index, 'Needs Review'),
  }));
}

export function finalizedLine(report: Report): string {
  const days = report.reportDays.length;
  if (days === 1) return report.isFinalized ? 'Finalized' : 'Not Finalized';
  const open = report.reportDays.filter((one) => !one.isFinalized).length;
  return open === 0
    ? `${String(days)} Days, all Finalized`
    : `${String(days)} Days, ${String(open)} not Finalized`;
}

export interface MonthStudent {
  studentId: string;
  name: string;
  room: string;
  present: number;
  absent: number;
  notApplicable: number;
  cells: (PoojaStatusName | null)[];
}

// The floor is the first digit of the room, as in 605: floor 6.
const floorOf = (room: string) => Number(room.charAt(0));

// The floors that have a Student in the Report, lowest first.
export function floorsOf(report: Report): number[] {
  const floors = report.rows
    .map((row) => floorOf(row.room))
    .filter((floor) => !Number.isNaN(floor));
  return [...new Set(floors)].sort((a, b) => a - b);
}

// Every Student of the Report, or those on one floor: most Absent first, then by room.
export function studentsInMonth(report: Report, floor: number | null): MonthStudent[] {
  const count = (statuses: (PoojaStatusName | null)[], status: PoojaStatusName) =>
    statuses.filter((one) => one === status).length;
  return report.rows
    .filter((row) => floor === null || floorOf(row.room) === floor)
    .map((row) => ({
      studentId: row.studentId,
      name: row.name,
      room: row.room,
      present: count(row.statuses, 'Present'),
      absent: count(row.statuses, 'Absent'),
      notApplicable: count(row.statuses, 'Not Applicable'),
      cells: row.statuses,
    }))
    .sort((a, b) => b.absent - a.absent || byRoom(a, b));
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

// The side of the chart: round ticks that reach the number of Students, never a maximum of zero.
export function axisOf(students: number): { ticks: number[]; max: number } {
  const step = STEPS.find((one) => one * 4 >= students) ?? 100;
  const ticks = [0];
  while ((ticks.at(-1) ?? 0) < students || ticks.length < 2) {
    ticks.push((ticks.at(-1) ?? 0) + step);
  }
  return { ticks, max: ticks.at(-1) ?? 1 };
}
