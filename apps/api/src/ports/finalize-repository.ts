import type { Day, Instant } from '@evlos/core';

// After Finalize no Student is Pending or Needs Review (FR-8).
export type FinalStatus = 'Present' | 'Absent' | 'Not Applicable';

export interface PoojaResult {
  studentId: string;
  status: FinalStatus;
  firstPunchAt: Instant | null;
  excludedAt: Instant | null;
}

export interface Finalization {
  day: Day;
  finalizedBy: string;
  finalizedAt: Instant;
}

export interface Notification {
  studentId: string;
  recipient: string;
  subject: string;
  body: string;
}

// queued: waiting to be sent, or being sent now. sent: the email has gone.
// failed: the email provider refused it every time, so it was given up.
export type NotificationState = 'queued' | 'sent' | 'failed';

// Each change is written with its audit entry in one transaction (FR-14).
export interface FinalizeRepository {
  finalizationsBetween(first: Day, last: Day): Promise<Finalization[]>;
  // Locks the Day and saves every Pooja Status. Returns false when it was already Finalized.
  finalize(
    day: Day,
    results: Omit<PoojaResult, 'excludedAt'>[],
    at: Instant,
    doneBy: string,
  ): Promise<boolean>;
  resultsBetween(first: Day, last: Day): Promise<(PoojaResult & { day: Day })[]>;
  // Student IDs that already have a Notification queued for the Day.
  notifiedStudentIds(day: Day): Promise<string[]>;
  // How far each Notification of the Day has got, for the Rector to see.
  notificationStates(day: Day): Promise<{ studentId: string; state: NotificationState }[]>;
  // Saves the Exclusions and queues the Notifications. Returns how many were newly queued;
  // one already queued for the same Day and Student is never queued again.
  sendNotifications(
    day: Day,
    excludedStudentIds: string[],
    notifications: Notification[],
    at: Instant,
    doneBy: string,
  ): Promise<number>;
}
