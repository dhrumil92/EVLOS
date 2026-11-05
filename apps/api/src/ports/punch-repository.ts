import type { Day, Instant, Punch } from '@evlos/core';

export interface ReceivedPunch {
  deviceSerial: string;
  studentId: string;
  punchedAt: Instant;
  receivedAt: Instant;
}

export interface PunchRepository {
  // Stores a Punch once. Returns false when the same Punch was already stored.
  record(punch: ReceivedPunch): Promise<boolean>;
  // Every Punch made on the Day, newest first.
  punchesOn(day: Day): Promise<Punch[]>;
  // Every Punch from the first Day to the last (IST Days, both included), oldest first.
  punchesBetween(first: Day, last: Day): Promise<Punch[]>;
  // Every Punch made on the Day that arrived after the given moment, such as the moment the
  // Day was Finalized, oldest first.
  punchesReceivedAfter(day: Day, after: Instant): Promise<Punch[]>;
}
