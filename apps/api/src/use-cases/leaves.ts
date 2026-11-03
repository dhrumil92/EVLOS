import { dayOf, istInstant, isActiveOn, leaveProblem, returnProblem } from '@evlos/core';
import type { Clock, LeaveProblem, ReturnProblem } from '@evlos/core';
import type { LeaveRepository, LeaveTimes } from '../ports/leave-repository.js';
import type { StudentRepository } from '../ports/student-repository.js';

// What the Rector types: dates as YYYY-MM-DD and times as HH:MM, in IST, as in the books.
export interface LeaveForm {
  outDay: string;
  outTime: string;
  expectedReturnDay: string;
  expectedReturnTime: string;
}

export interface ReturnForm {
  returnDay: string;
  returnTime: string;
}

export type LeaveRefusal =
  LeaveProblem | ReturnProblem | 'invalid-time' | 'unknown-student' | 'not-active';

export type LeaveResult = { outcome: 'done' } | { outcome: 'refused'; reason: LeaveRefusal };

export interface LeaveDeps {
  students: StudentRepository;
  leaves: LeaveRepository;
  clock: Clock;
}

const DONE: LeaveResult = { outcome: 'done' };
const refused = (reason: LeaveRefusal): LeaveResult => ({ outcome: 'refused', reason });

function timesFrom(form: LeaveForm): LeaveTimes | null {
  const outAt = istInstant(form.outDay, form.outTime);
  const expectedReturnAt = istInstant(form.expectedReturnDay, form.expectedReturnTime);
  return outAt === null || expectedReturnAt === null ? null : { outAt, expectedReturnAt };
}

async function activeProblem(studentId: string, deps: LeaveDeps): Promise<LeaveRefusal | null> {
  const all = await deps.students.activePeriods();
  const periods = all.filter((period) => period.studentId === studentId);
  if (periods.length === 0) return 'unknown-student';
  return isActiveOn(periods, dayOf(deps.clock.now())) ? null : 'not-active';
}

async function openLeaveOf(studentId: string, deps: LeaveDeps) {
  const leaves = await deps.leaves.leavesOf(studentId);
  const open = leaves.find((leave) => leave.returnedAt === null) ?? null;
  return { open, others: leaves.filter((leave) => leave !== open) };
}

export async function recordLeave(
  studentId: string,
  form: LeaveForm,
  doneBy: string,
  deps: LeaveDeps,
): Promise<LeaveResult> {
  const times = timesFrom(form);
  if (times === null) return refused('invalid-time');
  const notActive = await activeProblem(studentId, deps);
  if (notActive) return refused(notActive);
  const now = deps.clock.now();
  const problem = leaveProblem(times, await deps.leaves.leavesOf(studentId), now);
  if (problem) return refused(problem);
  await deps.leaves.record(studentId, times, now, doneBy);
  return DONE;
}

// Only the open Leave can be edited; a Leave with a Return Time is fixed.
export async function editLeave(
  studentId: string,
  form: LeaveForm,
  doneBy: string,
  deps: LeaveDeps,
): Promise<LeaveResult> {
  const times = timesFrom(form);
  if (times === null) return refused('invalid-time');
  const { open, others } = await openLeaveOf(studentId, deps);
  if (open === null) return refused('no-open-leave');
  const now = deps.clock.now();
  const problem = leaveProblem(times, others, now);
  if (problem) return refused(problem);
  await deps.leaves.edit(open, times, now, doneBy);
  return DONE;
}

export async function cancelLeave(
  studentId: string,
  doneBy: string,
  deps: LeaveDeps,
): Promise<LeaveResult> {
  const { open } = await openLeaveOf(studentId, deps);
  if (open === null) return refused('no-open-leave');
  await deps.leaves.cancel(open, deps.clock.now(), doneBy);
  return DONE;
}

export async function returnLeave(
  studentId: string,
  form: ReturnForm,
  doneBy: string,
  deps: LeaveDeps,
): Promise<LeaveResult> {
  const returnedAt = istInstant(form.returnDay, form.returnTime);
  if (returnedAt === null) return refused('invalid-time');
  const { open } = await openLeaveOf(studentId, deps);
  const now = deps.clock.now();
  const problem = returnProblem(open, returnedAt, now);
  if (problem || open === null) return refused(problem ?? 'no-open-leave');
  await deps.leaves.recordReturn(open, returnedAt, now, doneBy);
  return DONE;
}
