import type { Instant } from './clock.js';
import { msIntoDay, startOfDay } from './day.js';
import type { Day } from './day.js';

const MS_PER_MINUTE = 60 * 1000;
const POOJA_WINDOW_OPENS_MS = (5 * 60 + 30) * MS_PER_MINUTE; // 05:30:00 IST
const POOJA_WINDOW_CLOSES_MS = 18 * 60 * MS_PER_MINUTE; // 18:00:00 IST

// A Punch counts only inside the Pooja Window; both ends are included.
export function isInPoojaWindow(punchedAt: Instant): boolean {
  const msIntoIstDay = msIntoDay(punchedAt);
  return msIntoIstDay >= POOJA_WINDOW_OPENS_MS && msIntoIstDay <= POOJA_WINDOW_CLOSES_MS;
}

export interface PoojaWindow {
  opensAt: Instant;
  closesAt: Instant;
}

export function poojaWindowOf(day: Day): PoojaWindow {
  const start = startOfDay(day);
  return { opensAt: start + POOJA_WINDOW_OPENS_MS, closesAt: start + POOJA_WINDOW_CLOSES_MS };
}
