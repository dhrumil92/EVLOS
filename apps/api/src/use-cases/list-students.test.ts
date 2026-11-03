import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { deactivateStudent } from './deactivate-and-activate.js';
import { fakeLeaveRepository } from './fake-leave-repository.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { recordLeave } from './leaves.js';
import { listStudents } from './list-students.js';

// 00:30 IST on 3 November 2026.
const NOW_0030_IST = Date.UTC(2026, 10, 2, 19, 0, 0);
const RECTOR = 'rector@example.com';
const form = (studentId: string) => ({
  studentId,
  name: `Student ${studentId}`,
  room: '101',
  email: `${studentId}@example.com`,
  phone: '',
});
const leaveUntil = (expectedReturnDay: string) => ({
  outDay: '2026-11-02',
  outTime: '18:00',
  expectedReturnDay,
  expectedReturnTime: '18:00',
});

function setUp() {
  const { students } = fakeStudentRepository();
  const { leaves } = fakeLeaveRepository();
  return { students, leaves, clock: { now: () => NOW_0030_IST } };
}

describe('listStudents', () => {
  it('marks each Student Active or not on today in IST', async () => {
    const deps = setUp();
    await addStudent(form('9001'), deps);
    await addStudent(form('9002'), deps);
    await deactivateStudent('9002', RECTOR, deps);

    const listed = await listStudents(deps);

    expect(listed.map((one) => [one.studentId, one.isActive])).toEqual([
      ['9001', true],
      ['9002', false],
    ]);
  });

  it('gives each Student the floor of his room', async () => {
    const deps = setUp();
    await addStudent({ ...form('9001'), room: '605' }, deps);

    const [listed] = await listStudents(deps);

    expect(listed?.floor).toBe(6);
  });

  it('shows In hostel, Away or Due Back for each Student', async () => {
    const deps = setUp();
    for (const studentId of ['9001', '9002', '9003']) await addStudent(form(studentId), deps);
    await recordLeave('9002', leaveUntil('2026-11-08'), RECTOR, deps);
    await recordLeave('9003', leaveUntil('2026-11-04'), RECTOR, deps);

    const listed = await listStudents(deps);

    expect(listed.map((one) => one.leaveState)).toEqual(['In hostel', 'Away', 'Due Back']);
  });

  it('gives the open Leave of an Away Student, and none to a Student in hostel', async () => {
    const deps = setUp();
    await addStudent(form('9001'), deps);
    await addStudent(form('9002'), deps);
    await recordLeave('9002', leaveUntil('2026-11-08'), RECTOR, deps);

    const [inHostel, away] = await listStudents(deps);

    expect(inHostel?.openLeave).toBeNull();
    expect(away?.openLeave).toEqual({
      outAt: Date.UTC(2026, 10, 2, 12, 30),
      expectedReturnAt: Date.UTC(2026, 10, 8, 12, 30),
    });
  });
});
