import { describe, expect, it } from 'vitest';
import { addStudent } from './add-student.js';
import { fakeStudentRepository } from './fake-student-repository.js';
import { loadRoster } from './load-roster.js';
import type { RosterRow } from './load-roster.js';

// 00:30 IST on 16 November: still 15 November in UTC.
const NOW = Date.UTC(2026, 10, 15, 19, 0);
const row = (line: number, studentId: string, facts: Partial<RosterRow['form']> = {}) => ({
  line,
  form: {
    studentId,
    name: `Student ${studentId}`,
    room: '101',
    email: `${studentId}@example.com`,
    phone: '',
    ...facts,
  },
});

function setUp() {
  const fake = fakeStudentRepository();
  return { ...fake, deps: { students: fake.students, clock: { now: () => NOW } } };
}

describe('loadRoster', () => {
  it('checks every row and saves nothing without --save', async () => {
    const { deps, saved } = setUp();

    const result = await loadRoster([row(2, '8001'), row(3, '8002')], false, deps);

    expect(result).toEqual({ ready: 2, problems: [], saved: false });
    expect(saved).toEqual([]);
  });

  it('saves every Student, cleaned and Active from today in IST', async () => {
    const { deps, saved, periods } = setUp();

    const result = await loadRoster([row(2, '8001', { name: ' Aarav Shah ' })], true, deps);

    expect(result.saved).toBe(true);
    expect(saved[0]?.name).toBe('Aarav Shah');
    expect(periods[0]?.activeFrom).toBe('2026-11-16');
  });

  it('names the line and the field of each problem, without the personal data', async () => {
    const { deps } = setUp();

    const result = await loadRoster(
      [row(2, '8001', { room: 'A-12', email: 'secret-but-wrong' }), row(3, '80x2')],
      false,
      deps,
    );

    expect(result.problems).toEqual([
      'line 2: Room is not three digits.',
      'line 2: Email is not a valid email address.',
      'line 3: Student ID is not a number.',
    ]);
    expect(result.problems.join(' ')).not.toContain('secret');
  });

  it('refuses a Student ID that appears twice in the file', async () => {
    const { deps } = setUp();

    const result = await loadRoster([row(2, '8001'), row(5, '8001')], false, deps);

    expect(result.problems).toEqual(['line 5: Student ID 8001 is also on line 2.']);
  });

  it('catches a repeated Student ID even when its first line has another problem', async () => {
    const { deps } = setUp();

    const result = await loadRoster([row(2, '8001', { email: 'x' }), row(3, '8001')], false, deps);

    expect(result.problems).toContain('line 3: Student ID 8001 is also on line 2.');
  });

  it('refuses a Student ID already used, because Student IDs are never reused', async () => {
    const { deps } = setUp();
    await addStudent(row(0, '8001').form, deps);

    const result = await loadRoster([row(2, '8001')], false, deps);

    expect(result.problems).toEqual(['line 2: Student ID 8001 is already used.']);
  });

  it('saves nothing at all when any row has a problem', async () => {
    const { deps, saved } = setUp();

    const result = await loadRoster([row(2, '8001'), row(3, '8002', { room: '' })], true, deps);

    expect(result).toEqual({
      ready: 1,
      problems: ['line 3: Room is not three digits.'],
      saved: false,
    });
    expect(saved).toEqual([]);
  });

  it('saves nothing from an empty list', async () => {
    const { deps } = setUp();

    expect(await loadRoster([], true, deps)).toEqual({ ready: 0, problems: [], saved: false });
  });
});
