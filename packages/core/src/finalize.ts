import type { Instant } from './clock.js';
import type { Day } from './day.js';
import { poojaWindowOf } from './pooja-window.js';

// Finalize is available only after the Day's Pooja Window has closed (FR-8). The window
// includes 18:00:00, so a Punch at that second can still arrive and count.
export function canFinalize(day: Day, now: Instant): boolean {
  return now > poojaWindowOf(day).closesAt;
}
