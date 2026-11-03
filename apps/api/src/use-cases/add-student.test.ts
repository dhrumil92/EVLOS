import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { fakeStudentRepository as fakeStudents } from './fake-student-repository.js';

const NOW_0030_IST = Date.UTC(2026, 10, 2, 19, 0, 0);
const form = {
  studentId: '9001',
  name: ' Test Student ',
  room: '101',
  email: 'test.student@example.com',
  phone: '',
};

const clock = { now: () => NOW_0030_IST };

describe('addStudent', () => {
  it('saves a cleaned Student', async () => {
    const { students, saved } = fakeStudents();

    const result = await addStudent(form, { students, clock });

    expect(result.outcome).toBe('added');
    expect(saved[0]?.name).toBe('Test Student');
    expect(saved[0]?.phone).toBeNull();
  });

  it('makes the Student Active from today in IST, not the UTC date', async () => {
    const { students, periods } = fakeStudents();

    await addStudent(form, { students, clock });

    expect(periods[0]?.activeFrom).toBe('2026-11-03');
  });

  it('saves nothing when a field is invalid, and names the field', async () => {
    const { students, saved } = fakeStudents();

    const result = await addStudent({ ...form, email: 'wrong' }, { students, clock });

    expect(result).toEqual({ outcome: 'invalid', fields: ['email'] });
    expect(saved).toEqual([]);
  });

  it('refuses a Student ID that is already used', async () => {
    const { students } = fakeStudents();
    await addStudent(form, { students, clock });

    const result = await addStudent({ ...form, name: 'Someone Else' }, { students, clock });

    expect(result).toEqual({ outcome: 'student-id-used' });
  });
});
