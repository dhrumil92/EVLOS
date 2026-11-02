import { describe, expect, it } from 'vitest';
import { parseAttlog } from './parse-attlog.js';

// Same shape as a real ATTLOG line, with a made-up Student ID.
const line = (studentId: string, time: string) => `${studentId}\t${time}\t0\t1\t\t0\t0`;

const AT_2127_IST = Date.UTC(2026, 10, 2, 15, 57, 41);

describe('parseAttlog', () => {
  it('reads the Student ID and the Device time as IST', () => {
    const { punches } = parseAttlog(line('9001', '2026-11-02 21:27:41') + '\n');

    expect(punches).toEqual([{ studentId: '9001', punchedAt: AT_2127_IST }]);
  });

  it('reads the IST Day boundary as the evening before in UTC', () => {
    const { punches } = parseAttlog(line('9001', '2026-11-02 00:00:00'));

    expect(punches[0]?.punchedAt).toBe(Date.UTC(2026, 10, 1, 18, 30, 0));
  });

  it('reads several Punches in one upload', () => {
    const body = `${line('9001', '2026-11-02 21:35:39')}\n${line('9002', '2026-11-02 21:38:32')}\n`;

    const { punches } = parseAttlog(body);

    expect(punches.map((punch) => punch.studentId)).toEqual(['9001', '9002']);
  });

  it('reads lines that end in a carriage return', () => {
    const body = '9001\t2026-11-02 21:27:41\r\n';

    const { punches, rejectedLines } = parseAttlog(body);

    expect(punches).toHaveLength(1);
    expect(rejectedLines).toBe(0);
  });

  it('keeps leading zeros in a Student ID', () => {
    const { punches } = parseAttlog(line('0042', '2026-11-02 21:27:41'));

    expect(punches[0]?.studentId).toBe('0042');
  });

  it('finds nothing in an empty upload', () => {
    expect(parseAttlog('')).toEqual({ punches: [], rejectedLines: 0 });
  });

  it('ignores blank lines without counting them as rejected', () => {
    const { rejectedLines } = parseAttlog('\n\n');

    expect(rejectedLines).toBe(0);
  });

  it('counts a line without a timestamp as rejected and keeps the good lines', () => {
    const body = `9001\n${line('9002', '2026-11-02 21:27:41')}`;

    const { punches, rejectedLines } = parseAttlog(body);

    expect(punches.map((punch) => punch.studentId)).toEqual(['9002']);
    expect(rejectedLines).toBe(1);
  });

  it('rejects a line with no Student ID', () => {
    const { punches, rejectedLines } = parseAttlog(line('', '2026-11-02 21:27:41'));

    expect(punches).toEqual([]);
    expect(rejectedLines).toBe(1);
  });

  it.each(['2026-13-02 21:27:41', '2026-02-30 21:27:41', '2026-11-02 25:00:00', 'not a time'])(
    'rejects the impossible time %s',
    (time) => {
      const { punches, rejectedLines } = parseAttlog(line('9001', time));

      expect(punches).toEqual([]);
      expect(rejectedLines).toBe(1);
    },
  );
});
