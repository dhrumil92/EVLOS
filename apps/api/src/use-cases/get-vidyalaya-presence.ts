import { dayOf, isActiveOn, isAwayOnDay, startOfDay } from '@evlos/core';
import type { Clock, Day } from '@evlos/core';
import type { LeaveRepository } from '../ports/leave-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';
import { daysOf } from './get-report.js';

// Vidyalaya Presence (FR-16): for a Day or a month, whether each Student was In hostel or Away,
// worked out from Leaves only, never from Punches. Unlike a Pooja Status it is never locked: it
// is worked out again from the Leaves as they are now, so a Leave recorded later shows up.
export type PresenceRequest = { view: 'Day'; day: string } | { view: 'Month'; month: string };

export type HostelState = 'In hostel' | 'Away';

export interface PresenceRow {
  name: string;
  room: string;
  // One per Day of the request; null on a Day the Student was not Active.
  states: (HostelState | null)[];
}

export interface VidyalayaPresence {
  // Every Day asked for, stopped at today, in order. Each row's states follow the same order.
  days: Day[];
  // Listed by room in ascending order, then by name.
  rows: PresenceRow[];
}

export interface PresenceDeps {
  students: StudentRepository;
  leaves: LeaveRepository;
  clock: Clock;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// numeric: true puts room 110 after 102 and before 201, and room 9 before room 10.
const byText = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const byRoomThenName = (first: PresenceRow, second: PresenceRow) =>
  byText.compare(first.room, second.room) || byText.compare(first.name, second.name);

const byStudent = <T extends { studentId: string }>(items: readonly T[]) => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.studentId, [...(map.get(item.studentId) ?? []), item]);
  return map;
};

// Null when the request makes no sense: a Day that is not a date, a month not begun, and so on.
export async function getVidyalayaPresence(
  request: PresenceRequest,
  deps: PresenceDeps,
): Promise<VidyalayaPresence | null> {
  const days = daysOf(request, dayOf(deps.clock.now()));
  const [first, last] = [days?.[0], days?.at(-1)];
  if (days === null || first === undefined || last === undefined) return null;
  const [students, activePeriods, leaves] = await Promise.all([
    deps.students.list(),
    deps.students.activePeriods(),
    deps.leaves.leavesBetween(startOfDay(first), startOfDay(last) + MS_PER_DAY),
  ]);
  const [periodsOf, leavesOf] = [byStudent(activePeriods), byStudent(leaves)];
  const rows = students
    .map((student): PresenceRow => {
      const periods = periodsOf.get(student.studentId) ?? [];
      const own = leavesOf.get(student.studentId) ?? [];
      return {
        name: student.name,
        room: student.room,
        states: days.map((day) => {
          if (!isActiveOn(periods, day)) return null;
          return isAwayOnDay(own, day) ? 'Away' : 'In hostel';
        }),
      };
    })
    .filter((row) => row.states.some((state) => state !== null))
    .sort(byRoomThenName);
  return { days, rows };
}
