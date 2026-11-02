import type { Clock, Instant } from '@evlos/core';
import type { PunchRepository } from '../ports/punch-repository.js';

export interface UploadedPunch {
  studentId: string;
  punchedAt: Instant;
}

export interface RecordPunchesDeps {
  punches: PunchRepository;
  clock: Clock;
}

// Stores each uploaded Punch once and returns how many were new.
export async function recordPunches(
  deviceSerial: string,
  uploaded: readonly UploadedPunch[],
  deps: RecordPunchesDeps,
): Promise<number> {
  const receivedAt = deps.clock.now();
  let newPunches = 0;
  for (const punch of uploaded) {
    if (await deps.punches.record({ ...punch, deviceSerial, receivedAt })) {
      newPunches += 1;
    }
  }
  return newPunches;
}
