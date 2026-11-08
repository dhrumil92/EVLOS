import type { LiveViewPunch } from './live-view-source.js';

// The Pooja Window (05:30 to 18:00 IST, both ends included) cut into 15-minute slots, for the
// band on the Live view that shows when the Students punched.
const SLOT_MS = 15 * 60 * 1000;
const WINDOW_MS = 12.5 * 60 * 60 * 1000;
export const SLOTS = WINDOW_MS / SLOT_MS;

const windowStart = (day: string) => Date.parse(`${day}T05:30:00+05:30`);

const clockOf = (minutesAfterOpen: number) => {
  const total = 5 * 60 + 30 + minutesAfterOpen;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

// "06:30 to 06:45".
export const slotWords = (slot: number) => `${clockOf(slot * 15)} to ${clockOf(slot * 15 + 15)}`;

// How many Students made their first counted Punch in each slot. A Student who punched twice
// is counted once, so the bars add up to the Students Present.
export function firstPunchSlots(punches: readonly LiveViewPunch[], day: string): number[] {
  const first = new Map<string, number>();
  for (const punch of punches) {
    if (!punch.isCounted) continue;
    const earlier = first.get(punch.studentId);
    if (earlier === undefined || punch.punchedAt < earlier) {
      first.set(punch.studentId, punch.punchedAt);
    }
  }
  const counts = Array.from({ length: SLOTS }, () => 0);
  const start = windowStart(day);
  for (const punchedAt of first.values()) {
    // 18:00 exactly belongs to the window, so it goes in the last slot.
    const slot = Math.min(SLOTS - 1, Math.floor((punchedAt - start) / SLOT_MS));
    if (slot >= 0) counts[slot] = (counts[slot] ?? 0) + 1;
  }
  return counts;
}

export function busiestSlot(counts: readonly number[]): number | null {
  const most = Math.max(0, ...counts);
  return most === 0 ? null : counts.indexOf(most);
}

// Where Now sits along the window, from 0 to 1; null outside the window or on another Day.
export function nowShare(now: number, day: string): number | null {
  const share = (now - windowStart(day)) / WINDOW_MS;
  return share >= 0 && share <= 1 ? share : null;
}
