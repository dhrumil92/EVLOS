import type { Clock, Instant } from './clock.js';
import { dayOf } from './day.js';
import type { Day } from './day.js';
import type { Leave } from './leave.js';
import { isInPoojaWindow, poojaWindowOf } from './pooja-window.js';
import type { PoojaWindow } from './pooja-window.js';

export const PoojaStatus = {
  PRESENT: 'PRESENT',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  ABSENT: 'ABSENT',
} as const;

export type PoojaStatus = (typeof PoojaStatus)[keyof typeof PoojaStatus];

export interface StudentDay {
  day: Day;
  punches: readonly Instant[];
  leaves: readonly Leave[];
  isFinalized: boolean;
}

// Any overlap counts, including a Leave that only touches an edge of the window.
function overlapsWindow(leave: Leave, window: PoojaWindow): boolean {
  const leftBeforeWindowClosed = leave.outAt <= window.closesAt;
  const returnedAfterWindowOpened = leave.returnedAt === null || leave.returnedAt >= window.opensAt;
  return leftBeforeWindowClosed && returnedAfterWindowOpened;
}

// The order matters: a Punch always wins, and Not Applicable is never Absent.
export function poojaStatusOf(studentDay: StudentDay, clock: Clock): PoojaStatus {
  const { day, punches, leaves, isFinalized } = studentDay;
  const window = poojaWindowOf(day);

  if (punches.some((punchedAt) => dayOf(punchedAt) === day && isInPoojaWindow(punchedAt))) {
    return PoojaStatus.PRESENT;
  }
  if (leaves.some((leave) => overlapsWindow(leave, window))) {
    return PoojaStatus.NOT_APPLICABLE;
  }
  if (clock.now() <= window.closesAt) {
    return PoojaStatus.PENDING;
  }
  return isFinalized ? PoojaStatus.ABSENT : PoojaStatus.NEEDS_REVIEW;
}
