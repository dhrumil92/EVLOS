import {
  dayOf,
  daysBetween,
  hourSlotOf,
  isActiveOn,
  istInstant,
  PoojaStatus,
  poojaStatusOf,
  startOfDay,
} from '@evlos/core';
import type { ActivePeriod, Clock, Day, Instant, Leave, Punch } from '@evlos/core';
import type { LeaveRepository } from '../ports/leave-repository.js';
import type { PunchRepository } from '../ports/punch-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';

export type ReportRequest =
  | { view: 'Day'; day: string }
  | { view: 'Month'; month: string }
  | { view: 'Date range'; from: string; to: string };

export type PoojaStatusName = 'Present' | 'Absent' | 'Not Applicable' | 'Pending' | 'Needs Review';

export interface ReportRow {
  studentId: string;
  name: string;
  room: string;
  // One per Day of the Report; null on a Day the Student was not Active.
  statuses: (PoojaStatusName | null)[];
}

export interface DayTotals {
  day: number;
  present: number;
  absent: number;
  notApplicable: number;
}

export interface Report {
  isFinalized: boolean;
  rows: ReportRow[];
  // Students by the hour of their first Punch, from 05:30, for a Day Report.
  hours: number[] | null;
  // Totals for each Day, for a month Report.
  days: DayTotals[] | null;
}

export interface GetReportDeps {
  students: StudentRepository;
  leaves: LeaveRepository;
  punches: PunchRepository;
  clock: Clock;
}

const NAMES: Record<PoojaStatus, PoojaStatusName> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  NOT_APPLICABLE: 'Not Applicable',
  PENDING: 'Pending',
  NEEDS_REVIEW: 'Needs Review',
};
const MAX_DAYS = 366;
const HOUR_SLOTS = 13;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isDay = (text: string) => istInstant(text, '00:00') !== null;

// The Days a request covers, stopped at today; null when the request makes no sense.
function daysOf(request: ReportRequest, today: Day): Day[] | null {
  const span = spanOf(request);
  // A request that starts after today gets no Days, so it is refused below.
  if (span === null || !isDay(span.first)) return null;
  const days = daysBetween(span.first, span.last < today ? span.last : today);
  return days.length === 0 || days.length > MAX_DAYS ? null : days;
}

function spanOf(request: ReportRequest): { first: Day; last: Day } | null {
  if (request.view === 'Day') return { first: request.day, last: request.day };
  if (request.view === 'Date range') {
    return isDay(request.to) ? { first: request.from, last: request.to } : null;
  }
  if (!/^\d{4}-\d{2}$/.test(request.month)) return null;
  // Every month ends by the 31st; Days of the next month are dropped below.
  const first = `${request.month}-01`;
  const days = daysBetween(first, dayOf(startOfDay(first) + 30 * MS_PER_DAY));
  return { first, last: days.filter((day) => day.startsWith(request.month)).at(-1) ?? first };
}

function byStudent<T extends { studentId: string }>(items: readonly T[]) {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.studentId, [...(map.get(item.studentId) ?? []), item]);
  return map;
}

function hoursOf(rows: ReportRow[], punches: Map<string, Punch[]>): number[] {
  const hours = Array.from({ length: HOUR_SLOTS }, () => 0);
  for (const row of rows.filter((one) => one.statuses[0] === 'Present')) {
    const slots = (punches.get(row.studentId) ?? []).map((p) => hourSlotOf(p.punchedAt));
    const first = Math.min(...slots.filter((slot) => slot !== null));
    hours[first] = (hours[first] ?? 0) + 1;
  }
  return hours;
}

function totalsOf(rows: ReportRow[], days: Day[]): DayTotals[] {
  return days.map((day, index) => {
    const count = (name: PoojaStatusName) =>
      rows.filter((row) => row.statuses[index] === name).length;
    return {
      day: Number(day.slice(8)),
      present: count('Present'),
      absent: count('Absent'),
      notApplicable: count('Not Applicable'),
    };
  });
}

interface Evidence {
  periods: ActivePeriod[];
  punches: Instant[];
  leaves: Leave[];
}

// Null on a Day he was not Active: such a Day is not evaluated.
function statusOn(day: Day, evidence: Evidence, clock: Clock): PoojaStatusName | null {
  if (!isActiveOn(evidence.periods, day)) return null;
  const studentDay = {
    day,
    punches: evidence.punches,
    leaves: evidence.leaves,
    isFinalized: false,
  };
  return NAMES[poojaStatusOf(studentDay, clock)];
}

// Pooja Status of every Active Student on every Day asked for, from Punches and Leaves (FR-7).
// Finalize comes later, so no Day is Finalized yet: a past Day with no Punch is Needs Review.
export async function getReport(
  request: ReportRequest,
  deps: GetReportDeps,
): Promise<Report | null> {
  const days = daysOf(request, dayOf(deps.clock.now()));
  const [first, last] = [days?.[0], days?.at(-1)];
  if (days === null || first === undefined || last === undefined) return null;
  const [students, periods, punches, leaves] = await Promise.all([
    deps.students.list(),
    deps.students.activePeriods(),
    deps.punches.punchesBetween(first, last),
    deps.leaves.leavesBetween(startOfDay(first), startOfDay(last) + MS_PER_DAY),
  ]);
  const [periodsOf, punchesOf, leavesOf] = [
    byStudent(periods),
    byStudent(punches),
    byStudent(leaves),
  ];

  const rows = students
    .map((student) => {
      const { studentId, name, room } = student;
      const evidence = {
        periods: periodsOf.get(studentId) ?? [],
        punches: (punchesOf.get(studentId) ?? []).map((punch) => punch.punchedAt),
        leaves: leavesOf.get(studentId) ?? [],
      };
      return {
        studentId,
        name,
        room,
        statuses: days.map((day) => statusOn(day, evidence, deps.clock)),
      };
    })
    .filter((row) => row.statuses.some((status) => status !== null));

  return {
    isFinalized: false,
    rows,
    hours: request.view === 'Day' ? hoursOf(rows, punchesOf) : null,
    days: request.view === 'Month' ? totalsOf(rows, days) : null,
  };
}
