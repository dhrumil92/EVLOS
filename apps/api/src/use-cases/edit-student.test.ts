import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { editStudent } from './edit-student.js';
import { fakeStudentRepository } from './fake-student-repository.js';

const clock = { now: () => Date.UTC(2026, 10, 3, 5) };
const DETAILS = {
  name: ' New Name ',
  room: '202',
  email: 'new.name@example.com',
  phone: '',
};

async function withStudent() {
  const fake = fakeStudentRepository();
  await addStudent(
    { studentId: '9001', name: 'Test', room: '101', email: 'a@example.com', phone: '98' },
    { students: fake.students, clock },
  );
  return fake;
}

describe('editStudent', () => {
  it('saves the cleaned details under the same Student ID', async () => {
    const { students, saved } = await withStudent();

    const result = await editStudent('9001', DETAILS, { students });

    expect(result.outcome).toBe('edited');
    expect(saved).toEqual([
      { studentId: '9001', name: 'New Name', room: '202', email: DETAILS.email, phone: null },
    ]);
  });

  it('saves nothing when a field is invalid, and names the field', async () => {
    const { students, saved } = await withStudent();

    const result = await editStudent('9001', { ...DETAILS, room: ' ' }, { students });

    expect(result).toEqual({ outcome: 'invalid', fields: ['room'] });
    expect(saved[0]?.room).toBe('101');
  });

  it('refuses an unknown Student ID', async () => {
    const { students } = await withStudent();

    const result = await editStudent('9999', DETAILS, { students });

    expect(result).toEqual({ outcome: 'unknown-student' });
  });
});
