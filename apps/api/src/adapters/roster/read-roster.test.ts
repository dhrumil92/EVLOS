import { describe, expect, it } from 'vitest';
import { BYTE_ORDER_MARK, readRoster } from './read-roster.js';

const HEADER = 'Student ID,Name,Room,Email,Phone';

describe('readRoster', () => {
  it('reads each row into the fields of the Add a Student form', () => {
    const roster = readRoster(`${HEADER}\n8001,Aarav Shah,101,aarav@example.com,9800000001\n`);

    expect(roster).toEqual({
      rows: [
        {
          line: 2,
          form: {
            studentId: '8001',
            name: 'Aarav Shah',
            room: '101',
            email: 'aarav@example.com',
            phone: '9800000001',
          },
        },
      ],
      problem: null,
    });
  });

  it('matches the header by name, in any order and any case', () => {
    const roster = readRoster('email,ROOM,name,student id\naarav@example.com,101,Aarav Shah,8001');

    expect(roster.rows[0]?.form).toEqual({
      studentId: '8001',
      name: 'Aarav Shah',
      room: '101',
      email: 'aarav@example.com',
      phone: '',
    });
  });

  it('reads a quoted name with a comma and a doubled quote inside', () => {
    const roster = readRoster(`${HEADER}\n8001,"Shah, Aarav ""Ravi""",101,a@example.com,`);

    expect(roster.rows[0]?.form.name).toBe('Shah, Aarav "Ravi"');
  });

  it('skips the mark Excel puts at the start of a CSV UTF-8 file', () => {
    const roster = readRoster(`${BYTE_ORDER_MARK}${HEADER}\n8001,Aarav Shah,101,a@example.com,`);

    expect(roster.problem).toBeNull();
    expect(roster.rows).toHaveLength(1);
  });

  it('reads Windows line endings and skips blank lines, keeping the file line numbers', () => {
    const roster = readRoster(
      `${HEADER}\r\n8001,A,101,a@example.com,\r\n\r\n8002,B,102,b@example.com,\r\n`,
    );

    expect(roster.rows.map((row) => row.line)).toEqual([2, 4]);
    // The last cell, Phone, must not keep the Windows line ending.
    expect(roster.rows[1]?.form).toEqual({
      studentId: '8002',
      name: 'B',
      room: '102',
      email: 'b@example.com',
      phone: '',
    });
  });

  it('names the columns that are missing from the header', () => {
    const roster = readRoster('Student ID,Name\n8001,Aarav Shah');

    expect(roster).toEqual({
      rows: [],
      problem: 'The header row is missing these columns: Room, Email.',
    });
  });

  it('says so when the file is empty', () => {
    expect(readRoster('').problem).toBe('The file is empty.');
  });
});
