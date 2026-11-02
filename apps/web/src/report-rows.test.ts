import { describe, expect, it } from 'vitest';
import { countOf, visibleRows } from './report-rows.js';
import type { PoojaStatusName, ReportRow } from './report-source.js';

const row = (name: string, room: string, ...statuses: PoojaStatusName[]): ReportRow => ({
  studentId: name,
  name,
  room,
  statuses,
});

const names = (rows: ReportRow[]) => rows.map((r) => r.name);

describe('visibleRows', () => {
  it('sorts by room in ascending order', () => {
    const rows = [row('Asha', 'B-101', 'Present'), row('Bina', 'A-201', 'Present')];

    expect(names(visibleRows(rows, 'Room', 'All'))).toEqual(['Bina', 'Asha']);
  });

  it('sorts room numbers by value, so A-9 comes before A-10', () => {
    const rows = [row('Asha', 'A-10', 'Present'), row('Bina', 'A-9', 'Present')];

    expect(names(visibleRows(rows, 'Room', 'All'))).toEqual(['Bina', 'Asha']);
  });

  it('sorts Students in one room by name', () => {
    const rows = [row('Bina', 'A-1', 'Present'), row('Asha', 'A-1', 'Present')];

    expect(names(visibleRows(rows, 'Room', 'All'))).toEqual(['Asha', 'Bina']);
  });

  it('sorts by name', () => {
    const rows = [row('Bina', 'A-1', 'Present'), row('Asha', 'B-1', 'Present')];

    expect(names(visibleRows(rows, 'Name', 'All'))).toEqual(['Asha', 'Bina']);
  });

  it('keeps only the Students with the chosen Pooja Status', () => {
    const rows = [row('Asha', 'A-1', 'Absent'), row('Bina', 'A-2', 'Present')];

    expect(names(visibleRows(rows, 'Room', 'Absent'))).toEqual(['Asha']);
  });

  it('keeps a Student with that Pooja Status on any Day of a month', () => {
    const rows = [row('Asha', 'A-1', 'Present', 'Absent', 'Present')];

    expect(names(visibleRows(rows, 'Room', 'Absent'))).toEqual(['Asha']);
  });

  it('leaves the given list unchanged', () => {
    const rows = [row('Bina', 'B-1', 'Present'), row('Asha', 'A-1', 'Present')];

    visibleRows(rows, 'Room', 'All');

    expect(names(rows)).toEqual(['Bina', 'Asha']);
  });
});

describe('countOf', () => {
  it('counts the Days with a Pooja Status', () => {
    expect(countOf(row('Asha', 'A-1', 'Present', 'Absent', 'Present'), 'Present')).toBe(2);
  });
});
