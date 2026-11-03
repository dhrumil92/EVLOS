import { dayOf, daysBetween, hourSlotOf, istInstant, startOfDay } from '@evlos/core';
import type { Clock, Day, Instant } from '@evlos/core';
import type { FinalizeRepository, PoojaResult } from '../ports/finalize-repository.js';
import { computedStatus, firstPunchOn, loadEvidence } from './day-evidence.js';
import type { Evidence, EvidenceDeps, PoojaStatusName } from './day-evidence.js';

export type { PoojaStatusName } from './day-evidence.js';

export type ReportRequest =
  | { view: 'Day'; day: string }
  | { view: 'Month'; month: string }
  | { view: 'Date range'; from: string; to: string };

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
  // True only when every Day of the Report is Finalized.
  isFinalized: boolean;
  rows: ReportRow[];
  // Students by the hour of their first Punch, from 05:30, for a Day Report.
  hours: number[] | null;
  // Totals for each Day, for a month Report.
  days: DayTotals[] | null;
}

export type GetReportDeps = EvidenceDeps & { finalized: FinalizeRepository; clock: Clock };

const MAX_DAYS = 366;
const HOUR_SLOTS = 13;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const isDay = (text: string) => istInstant(text, '00:00') !== null;

// The Days a request covers, stopped at today; null when the request makes no sense.
export function daysOf(request: ReportRequest, today: Day): Day[] | null {
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

// A Finalized Day is read from what Finalize saved and never worked out again, so later
// changes to Leaves or Students cannot change it (FR-1, FR-4, FR-8).
class DayStatuses {
  private readonly saved = new Map<string, PoojaResult>();

  constructor(
    private readonly finalizedDays: ReadonlySet<Day>,
    results: readonly (PoojaResult & { day: Day })[],
    private readonly clock: Clock,
  ) {
    for (const result of results) this.saved.set(`${result.day}|${result.studentId}`, result);
  }

  isFinalized(day: Day): boolean {
    return this.finalizedDays.has(day);
  }

  statusOn(day: Day, evidence: Evidence): PoojaStatusName | null {
    if (!this.isFinalized(day)) return computedStatus(day, evidence, this.clock);
    return this.saved.get(`${day}|${evidence.student.studentId}`)?.status ?? null;
  }

  firstPunchOn(day: Day, evidence: Evidence): Instant | null {
    if (!this.isFinalized(day)) return firstPunchOn(day, evidence.punches);
    return this.saved.get(`${day}|${evidence.student.studentId}`)?.firstPunchAt ?? null;
  }
}

function hoursOf(day: Day, everyone: Evidence[], statuses: DayStatuses): number[] {
  const hours = Array.from({ length: HOUR_SLOTS }, () => 0);
  for (const evidence of everyone) {
    if (statuses.statusOn(day, evidence) !== 'Present') continue;
    const first = statuses.firstPunchOn(day, evidence);
    const slot = first === null ? null : hourSlotOf(first);
    if (slot !== null) hours[slot] = (hours[slot] ?? 0) + 1;
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

// Pooja Status of every Active Student on every Day asked for (FR-7, FR-11).
export async function getReport(
  request: ReportRequest,
  deps: GetReportDeps,
): Promise<Report | null> {
  const days = daysOf(request, dayOf(deps.clock.now()));
  const [first, last] = [days?.[0], days?.at(-1)];
  if (days === null || first === undefined || last === undefined) return null;
  const [everyone, finalizations, results] = await Promise.all([
    loadEvidence(first, last, deps),
    deps.finalized.finalizationsBetween(first, last),
    deps.finalized.resultsBetween(first, last),
  ]);
  const statuses = new DayStatuses(
    new Set(finalizations.map((one) => one.day)),
    results,
    deps.clock,
  );

  const rows = everyone
    .map((evidence) => ({
      studentId: evidence.student.studentId,
      name: evidence.student.name,
      room: evidence.student.room,
      statuses: days.map((day) => statuses.statusOn(day, evidence)),
    }))
    .filter((row) => row.statuses.some((status) => status !== null));

  return {
    isFinalized: days.every((day) => statuses.isFinalized(day)),
    rows,
    hours: request.view === 'Day' ? hoursOf(first, everyone, statuses) : null,
    days: request.view === 'Month' ? totalsOf(rows, days) : null,
  };
}
