import { dayOf } from './day.js';
import type { Day } from './day.js';
import type { Leave } from './leave.js';

// Vidyalaya Presence: is the Student Away on this Day? He is Away from the Day of his Out Time
// up to, but not including, the Day of his Return Time, so he is In hostel on the Day he
// returns. With no Return Time yet he stays Away on every Day from the Out Time on. Worked out
// from Leaves only, never from Punches. Days are YYYY-MM-DD, so comparing the text compares
// the dates.
export function isAwayOnDay(leaves: readonly Leave[], day: Day): boolean {
  return leaves.some(
    (leave) =>
      dayOf(leave.outAt) <= day && (leave.returnedAt === null || day < dayOf(leave.returnedAt)),
  );
}
