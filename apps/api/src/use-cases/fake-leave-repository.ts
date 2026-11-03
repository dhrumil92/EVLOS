import type { Instant } from '@evlos/core';
import type { LeaveRepository, StoredLeave } from '../ports/leave-repository.js';

// An in-memory LeaveRepository for use-case tests.
export function fakeLeaveRepository() {
  const stored: StoredLeave[] = [];
  const cancelled = new Set<number>();
  const audit: { action: string; studentId: string; at: Instant; doneBy: string }[] = [];
  const find = (leave: StoredLeave) => stored.find((one) => one.leaveId === leave.leaveId);
  const live = () => stored.filter((one) => !cancelled.has(one.leaveId));
  const plain = (leave: StoredLeave) => ({ ...leave });

  const leaves: LeaveRepository = {
    leavesOf: (studentId) =>
      Promise.resolve(
        live()
          .filter((one) => one.studentId === studentId)
          .map(plain),
      ),
    openLeaves: () =>
      Promise.resolve(
        live()
          .filter((one) => one.returnedAt === null)
          .map(plain),
      ),
    leavesBetween: (first, last) =>
      Promise.resolve(
        live()
          .filter(
            (one) => one.outAt <= last && (one.returnedAt === null || one.returnedAt >= first),
          )
          .map(plain),
      ),
    record: (studentId, times, at, doneBy) => {
      stored.push({
        leaveId: stored.length + 1,
        studentId,
        ...times,
        returnedAt: null,
      });
      audit.push({ action: 'Leave', studentId, at, doneBy });
      return Promise.resolve();
    },
    edit: (leave, times, at, doneBy) => {
      Object.assign(find(leave) ?? {}, times);
      audit.push({ action: 'Edit Leave', studentId: leave.studentId, at, doneBy });
      return Promise.resolve();
    },
    cancel: (leave, at, doneBy) => {
      cancelled.add(leave.leaveId);
      audit.push({ action: 'Cancel Leave', studentId: leave.studentId, at, doneBy });
      return Promise.resolve();
    },
    recordReturn: (leave, returnedAt, at, doneBy) => {
      Object.assign(find(leave) ?? {}, { returnedAt });
      audit.push({ action: 'Return', studentId: leave.studentId, at, doneBy });
      return Promise.resolve();
    },
  };
  return { leaves, stored, audit };
}
