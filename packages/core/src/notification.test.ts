import { describe, expect, it } from 'vitest';
import { studentsToNotify } from './notification.js';
import type { FinalizedList, StudentStatus } from './notification.js';
import { PoojaStatus } from './pooja-status.js';

const absent = (studentId: string): StudentStatus => ({
  studentId,
  poojaStatus: PoojaStatus.ABSENT,
});

const list = (facts: Partial<FinalizedList>): FinalizedList => ({
  isFinalized: true,
  statuses: [],
  excludedStudentIds: [],
  notifiedStudentIds: [],
  ...facts,
});

describe('Notification', () => {
  it('goes to an Absent Student on a Finalized Day', () => {
    const students = studentsToNotify(list({ statuses: [absent('101')] }));

    expect(students).toEqual(['101']);
  });

  it('goes to nobody before Finalize', () => {
    const students = studentsToNotify(list({ isFinalized: false, statuses: [absent('101')] }));

    expect(students).toEqual([]);
  });

  it.each([
    PoojaStatus.PRESENT,
    PoojaStatus.NOT_APPLICABLE,
    PoojaStatus.PENDING,
    PoojaStatus.NEEDS_REVIEW,
  ])('never goes to a Student whose Pooja Status is %s', (poojaStatus) => {
    const students = studentsToNotify(list({ statuses: [{ studentId: '101', poojaStatus }] }));

    expect(students).toEqual([]);
  });

  it('never goes to an Excluded Student', () => {
    const students = studentsToNotify(
      list({ statuses: [absent('101'), absent('102')], excludedStudentIds: ['101'] }),
    );

    expect(students).toEqual(['102']);
  });

  it('is not sent a second time on a retry or a second click', () => {
    const students = studentsToNotify(
      list({ statuses: [absent('101'), absent('102')], notifiedStudentIds: ['101'] }),
    );

    expect(students).toEqual(['102']);
  });

  it('goes once to a Student listed twice', () => {
    const students = studentsToNotify(list({ statuses: [absent('101'), absent('101')] }));

    expect(students).toEqual(['101']);
  });
});
