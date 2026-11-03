import { isActiveOn } from '@evlos/core';
import type { StudentForm } from '@evlos/core';
import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { activateStudent, deactivateStudent } from './deactivate-and-activate.js';
import { fakeStudentRepository } from './fake-student-repository.js';

// 00:30 IST on 3 Nov is still 2 Nov in UTC.
const NOW_0030_IST = Date.UTC(2026, 10, 2, 19, 0, 0);
const FORM: StudentForm = {
  studentId: '9001',
  name: 'Test Student',
  room: '101',
  email: 'test.student@example.com',
  phone: '',
};

async function withStudent() {
  const fake = fakeStudentRepository();
  const deps = { students: fake.students, clock: { now: () => NOW_0030_IST } };
  await addStudent(FORM, { ...deps, clock: { now: () => Date.UTC(2026, 10, 1, 5) } });
  return { ...fake, deps };
}

describe('deactivateStudent', () => {
  it('Deactivates an Active Student from today in IST', async () => {
    const { deps, periods } = await withStudent();

    const result = await deactivateStudent('9001', 'rector@example.com', deps);

    expect(result).toBe('deactivated');
    expect(periods[0]?.activeUntil).toBe('2026-11-03');
  });

  it('records the Deactivate in the audit log with the time and the Rector', async () => {
    const { deps, audit } = await withStudent();

    await deactivateStudent('9001', 'rector@example.com', deps);

    expect(audit).toEqual([
      { action: 'Deactivate', studentId: '9001', at: NOW_0030_IST, doneBy: 'rector@example.com' },
    ]);
  });

  it('refuses to Deactivate a Student who is already Deactivated', async () => {
    const { deps, audit } = await withStudent();
    await deactivateStudent('9001', 'rector@example.com', deps);

    const result = await deactivateStudent('9001', 'rector@example.com', deps);

    expect(result).toBe('not-active');
    expect(audit).toHaveLength(1);
  });

  it('refuses an unknown Student ID', async () => {
    const { deps, audit } = await withStudent();

    expect(await deactivateStudent('9999', 'rector@example.com', deps)).toBe('unknown-student');
    expect(audit).toEqual([]);
  });
});

describe('activateStudent', () => {
  it('Activates a Deactivated Student from today in IST', async () => {
    const { deps, periods } = await withStudent();
    await deactivateStudent('9001', 'rector@example.com', deps);

    const result = await activateStudent('9001', 'rector@example.com', deps);

    expect(result).toBe('activated');
    expect(isActiveOn(periods, '2026-11-03')).toBe(true);
  });

  it('records the Activate in the audit log', async () => {
    const { deps, audit } = await withStudent();
    await deactivateStudent('9001', 'rector@example.com', deps);

    await activateStudent('9001', 'rector@example.com', deps);

    expect(audit.map((entry) => entry.action)).toEqual(['Deactivate', 'Activate']);
  });

  it('refuses to Activate a Student who is already Active', async () => {
    const { deps, audit } = await withStudent();

    expect(await activateStudent('9001', 'rector@example.com', deps)).toBe('already-active');
    expect(audit).toEqual([]);
  });

  it('refuses an unknown Student ID', async () => {
    const { deps } = await withStudent();

    expect(await activateStudent('9999', 'rector@example.com', deps)).toBe('unknown-student');
  });
});
