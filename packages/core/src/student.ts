import type { Day } from './day.js';

export interface Student {
  studentId: string;
  name: string;
  room: string;
  email: string;
  phone: string | null;
}

export type StudentField = 'studentId' | 'name' | 'room' | 'email';

export type StudentForm = Omit<Student, 'phone'> & { phone: string };

// The details the Rector may edit after adding a Student. The Student ID never changes.
export type StudentDetails = Omit<StudentForm, 'studentId'>;

// activeUntil is the Day he was Deactivated, so he is not Active on it. Null while Active.
export interface ActivePeriod {
  activeFrom: Day;
  activeUntil: Day | null;
}

// Days are YYYY-MM-DD, so comparing the text compares the dates.
export function isActiveOn(periods: readonly ActivePeriod[], day: Day): boolean {
  return periods.some(
    (period) =>
      period.activeFrom <= day && (period.activeUntil === null || day < period.activeUntil),
  );
}

const DIGITS = /^\d+$/;
// A room is three digits: the floor, then the room on that floor, such as 605.
const ROOM = /^\d{3}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanStudent(form: StudentForm): Student {
  return {
    studentId: form.studentId.trim(),
    name: form.name.trim(),
    room: form.room.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
  };
}

// Used for Students and for the Rector's login.
export function isEmailAddress(text: string): boolean {
  return EMAIL.test(text);
}

// The floor is the first digit of a valid room: room 605 is on floor 6.
export function floorOf(room: string): number {
  return Number(room.charAt(0));
}

export function invalidFields(student: Student): StudentField[] {
  const checks: [StudentField, boolean][] = [
    ['studentId', DIGITS.test(student.studentId)],
    ['name', student.name !== ''],
    ['room', ROOM.test(student.room)],
    ['email', isEmailAddress(student.email)],
  ];
  return checks.filter(([, isValid]) => !isValid).map(([field]) => field);
}
