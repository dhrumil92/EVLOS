import type { Clock, Instant } from './clock.js';
import { dayOf } from './day.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface Leave {
  outAt: Instant;
  expectedReturnAt: Instant;
  returnedAt: Instant | null;
}

function isOpen(leave: Leave): boolean {
  return leave.returnedAt === null;
}

// Away: the Student has an open Leave (no Return Time yet).
export function isAway(leaves: readonly Leave[]): boolean {
  return leaves.some(isOpen);
}

export type LeaveProblem =
  'out-time-in-future' | 'expected-return-before-out' | 'already-away' | 'overlaps-earlier-leave';

export type ReturnProblem = 'no-open-leave' | 'return-time-in-future' | 'return-before-out';

// Why a new or edited Leave cannot be saved, or null when it can (FR-4). otherLeaves are
// the Student's other Leaves; an edited Leave is left out of them.
export function leaveProblem(
  leave: Pick<Leave, 'outAt' | 'expectedReturnAt'>,
  otherLeaves: readonly Leave[],
  now: Instant,
): LeaveProblem | null {
  // A Student fills the Leave Note only as he leaves, so an Out Time is never ahead of now.
  if (leave.outAt > now) return 'out-time-in-future';
  if (leave.expectedReturnAt < leave.outAt) return 'expected-return-before-out';
  if (otherLeaves.some(isOpen)) return 'already-away';
  // He cannot leave again before he came back from an earlier Leave.
  const overlaps = otherLeaves.some((other) => (other.returnedAt ?? 0) > leave.outAt);
  return overlaps ? 'overlaps-earlier-leave' : null;
}

// Why a Return Time cannot be recorded, or null when it can (FR-5).
export function returnProblem(
  openLeave: Leave | null,
  returnedAt: Instant,
  now: Instant,
): ReturnProblem | null {
  if (openLeave === null) return 'no-open-leave';
  if (returnedAt > now) return 'return-time-in-future';
  return returnedAt < openLeave.outAt ? 'return-before-out' : null;
}

// Due Back: Away, and Expected Return is tomorrow or earlier. Day strings sort by date.
export function isDueBack(leaves: readonly Leave[], clock: Clock): boolean {
  const tomorrow = dayOf(clock.now() + MS_PER_DAY);
  return leaves.some((leave) => isOpen(leave) && dayOf(leave.expectedReturnAt) <= tomorrow);
}
