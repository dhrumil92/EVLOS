import type { Instant } from './clock.js';
import { msIntoDay } from './day.js';
import { isInPoojaWindow } from './pooja-window.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const POOJA_WINDOW_OPENS_MS = 5.5 * MS_PER_HOUR; // 05:30:00 IST

// The hour slot of a Punch for the Students by hour graph: slot 0 is 05:30 to 06:29,
// slot 1 is 06:30 to 07:29, and so on, up to slot 12, the half hour 17:30 to 18:00.
// Null outside the Pooja Window.
export function hourSlotOf(punchedAt: Instant): number | null {
  if (!isInPoojaWindow(punchedAt)) return null;
  return Math.floor((msIntoDay(punchedAt) - POOJA_WINDOW_OPENS_MS) / MS_PER_HOUR);
}
