import type { Instant } from './clock.js';

export interface Punch {
  studentId: string;
  punchedAt: Instant;
}

// The same Punch is the same Student ID at the same timestamp. The first copy is kept.
export function uniquePunches(punches: readonly Punch[]): Punch[] {
  const seen = new Set<string>();
  return punches.filter((punch) => {
    const key = `${punch.studentId}|${String(punch.punchedAt)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
