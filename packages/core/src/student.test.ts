import { describe, expect, it } from 'vitest';
import { cleanStudent, floorOf, invalidFields, isActiveOn } from './student.js';
import type { ActivePeriod, Student } from './student.js';

const student = (facts: Partial<Student> = {}): Student => ({
  studentId: '9001',
  name: 'Test Student',
  room: '101',
  email: 'test.student@example.com',
  phone: null,
  ...facts,
});

describe('invalidFields', () => {
  it('accepts a Student with no phone, because phone is optional', () => {
    expect(invalidFields(student())).toEqual([]);
  });

  it.each([
    ['studentId', { studentId: '' }],
    ['name', { name: '' }],
    ['room', { room: '' }],
    ['email', { email: '' }],
  ])('requires %s', (field, facts) => {
    expect(invalidFields(student(facts))).toEqual([field]);
  });

  it('refuses a Student ID that is not a number', () => {
    expect(invalidFields(student({ studentId: '90a1' }))).toEqual(['studentId']);
  });

  it('keeps a Student ID with leading zeros valid', () => {
    expect(invalidFields(student({ studentId: '0042' }))).toEqual([]);
  });

  it.each(['no-at-sign.example.com', 'two@@example.com', 'no-dot@example', 'a b@example.com'])(
    'refuses the email %s',
    (email) => {
      expect(invalidFields(student({ email }))).toEqual(['email']);
    },
  );

  it.each(['101', '714', '205'])('accepts the room %s, three digits', (room) => {
    expect(invalidFields(student({ room }))).toEqual([]);
  });

  it.each(['A-101', '10', '1001', '10a', '1 01'])('refuses the room %s', (room) => {
    expect(invalidFields(student({ room }))).toEqual(['room']);
  });

  it('reports every invalid field at once', () => {
    expect(invalidFields(student({ name: '', room: '' }))).toEqual(['name', 'room']);
  });
});

describe('cleanStudent', () => {
  it('removes spaces around what was typed', () => {
    const form = {
      studentId: ' 9001 ',
      name: ' Test ',
      room: ' 101 ',
      email: ' a@b.co ',
      phone: ' 98 ',
    };

    expect(cleanStudent(form)).toEqual({
      studentId: '9001',
      name: 'Test',
      room: '101',
      email: 'a@b.co',
      phone: '98',
    });
  });

  it('stores an empty phone as no phone', () => {
    const form = { studentId: '9001', name: 'Test', room: '101', email: 'a@b.co', phone: '  ' };

    expect(cleanStudent(form).phone).toBeNull();
  });
});

describe('floorOf', () => {
  it.each([
    ['101', 1],
    ['605', 6],
    ['714', 7],
  ])('puts room %s on floor %i, its first digit', (room, floor) => {
    expect(floorOf(room)).toBe(floor);
  });
});

describe('isActiveOn', () => {
  const addedNov1: ActivePeriod = { activeFrom: '2026-11-01', activeUntil: null };
  const deactivatedNov5: ActivePeriod = { activeFrom: '2026-11-01', activeUntil: '2026-11-05' };

  it('makes a Student Active from the Day he is added', () => {
    expect(isActiveOn([addedNov1], '2026-11-01')).toBe(true);
  });

  it('keeps a Student who was never Deactivated Active', () => {
    expect(isActiveOn([addedNov1], '2027-03-01')).toBe(true);
  });

  it('does not make a Student Active before the Day he is added', () => {
    expect(isActiveOn([addedNov1], '2026-10-31')).toBe(false);
  });

  it('keeps him Active on the Days before he is Deactivated', () => {
    expect(isActiveOn([deactivatedNov5], '2026-11-04')).toBe(true);
  });

  it('makes Deactivate take effect on the Day it is done', () => {
    expect(isActiveOn([deactivatedNov5], '2026-11-05')).toBe(false);
  });

  it('makes him Active again from the Day he is Activated, not the Days between', () => {
    const periods = [deactivatedNov5, { activeFrom: '2026-11-09', activeUntil: null }];

    expect(isActiveOn(periods, '2026-11-07')).toBe(false);
    expect(isActiveOn(periods, '2026-11-09')).toBe(true);
  });

  it('gives a Student with no Active period no Active Day', () => {
    expect(isActiveOn([], '2026-11-03')).toBe(false);
  });
});
