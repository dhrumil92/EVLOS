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

// Due Back: Away, and Expected Return is tomorrow or earlier. Day strings sort by date.
export function isDueBack(leaves: readonly Leave[], clock: Clock): boolean {
  const tomorrow = dayOf(clock.now() + MS_PER_DAY);
  return leaves.some((leave) => isOpen(leave) && dayOf(leave.expectedReturnAt) <= tomorrow);
}
