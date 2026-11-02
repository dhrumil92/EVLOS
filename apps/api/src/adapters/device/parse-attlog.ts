import type { Instant } from '@evlos/core';

export interface DevicePunch {
  studentId: string;
  punchedAt: Instant;
}

export interface ParsedAttlog {
  punches: DevicePunch[];
  rejectedLines: number;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DEVICE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

// The Device sends IST with no timezone, for example 2026-11-02 21:27:41.
function instantOf(deviceTime: string): Instant | null {
  if (!DEVICE_TIME.test(deviceTime)) {
    return null;
  }
  const instant = Date.parse(`${deviceTime.replace(' ', 'T')}+05:30`);
  if (Number.isNaN(instant)) {
    return null;
  }
  // Reading the time back catches dates that roll over, such as 30 February.
  const readBack = new Date(instant + IST_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
  return readBack === deviceTime ? instant : null;
}

function punchOf(line: string): DevicePunch | null {
  const [studentId = '', deviceTime = ''] = line.split('\t');
  const punchedAt = instantOf(deviceTime);
  return studentId === '' || punchedAt === null ? null : { studentId, punchedAt };
}

// One Punch per line: Student ID, time, then fields EVLOS does not use.
export function parseAttlog(body: string): ParsedAttlog {
  const lines = body.split(/\r?\n/).filter((line) => line.trim() !== '');
  const punches = lines.map(punchOf).filter((punch) => punch !== null);
  return { punches, rejectedLines: lines.length - punches.length };
}
