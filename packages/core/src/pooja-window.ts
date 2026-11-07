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

const SLOT_MS = 15 * MS_PER_MINUTE;
// The Pooja Window cut into 15-minute bars: 12.5 hours make 50 of them.
export const POOJA_SLOTS = (POOJA_WINDOW_CLOSES_MS - POOJA_WINDOW_OPENS_MS) / SLOT_MS;

// Which 15-minute bar of the Pooja Window a Punch falls in: 0 for 05:30 to 05:45, up to 49 for
// 17:45 to 18:00. 18:00:00 belongs to the window, so it goes in the last bar. Null outside it.
export function poojaSlotOf(punchedAt: Instant): number | null {
  if (!isInPoojaWindow(punchedAt)) return null;
  const slot = Math.floor((msIntoDay(punchedAt) - POOJA_WINDOW_OPENS_MS) / SLOT_MS);
  return Math.min(slot, POOJA_SLOTS - 1);
}

export interface PoojaWindow {
  opensAt: Instant;
  closesAt: Instant;
}

export function poojaWindowOf(day: Day): PoojaWindow {
  const start = startOfDay(day);
  return { opensAt: start + POOJA_WINDOW_OPENS_MS, closesAt: start + POOJA_WINDOW_CLOSES_MS };
}
