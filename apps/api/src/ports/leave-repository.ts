import type { Instant, Leave } from '@evlos/core';

export type StoredLeave = Leave & { leaveId: number; studentId: string };
export type LeaveTimes = Pick<Leave, 'outAt' | 'expectedReturnAt'>;

// Every change below is written to the audit log in the same transaction, with the time it
// was done (at) and the email of the Rector who did it (doneBy), as FR-14 says.
export interface LeaveRepository {
  // A Student's Leaves, oldest first. Cancelled Leaves are left out.
  leavesOf(studentId: string): Promise<StoredLeave[]>;
  // Every Leave with no Return Time yet, for the Student list.
  openLeaves(): Promise<StoredLeave[]>;
  // Every Leave that overlaps the span from first to last, open ones included.
  leavesBetween(first: Instant, last: Instant): Promise<StoredLeave[]>;
  record(studentId: string, times: LeaveTimes, at: Instant, doneBy: string): Promise<void>;
  edit(leave: StoredLeave, times: LeaveTimes, at: Instant, doneBy: string): Promise<void>;
  cancel(leave: StoredLeave, at: Instant, doneBy: string): Promise<void>;
  recordReturn(leave: StoredLeave, returnedAt: Instant, at: Instant, doneBy: string): Promise<void>;
}
