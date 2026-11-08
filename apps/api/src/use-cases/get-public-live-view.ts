import { dayOf, POOJA_SLOTS, poojaSlotOf } from '@evlos/core';
import type { Day, Instant, Punch } from '@evlos/core';
import { getReport } from './get-report.js';
import type { GetReportDeps } from './get-report.js';

// The Public Live View (FR-17): what anyone may see of today, with no login. Numbers only:
// never a name, a room or a Student ID.
export interface PublicLiveView {
  day: Day;
  // Students Present today.
  present: number;
  // Students expected at Pooja today: the Active Students, less those Not Applicable because a
  // Leave touches the Pooja Window.
  expected: number;
  // How many Present Students made their first Punch in each 15-minute bar of the window.
  slots: number[];
  // When these numbers were worked out.
  updatedAt: Instant;
}

// Present and expected come from today's Report, so they follow exactly the same Pooja rules
// as the Rector's pages.
export async function getPublicLiveView(deps: GetReportDeps): Promise<PublicLiveView> {
  const updatedAt = deps.clock.now();
  const day = dayOf(updatedAt);
  const [report, punches] = await Promise.all([
    getReport({ view: 'Day', day }, deps),
    deps.punches.punchesOn(day),
  ]);
  const rows = report?.rows ?? [];
  const presentIds = new Set(
    rows.filter((row) => row.statuses[0] === 'Present').map((row) => row.studentId),
  );
  const notApplicable = rows.filter((row) => row.statuses[0] === 'Not Applicable').length;
  return {
    day,
    present: presentIds.size,
    expected: rows.length - notApplicable,
    slots: firstPunchSlots(punches, presentIds),
    updatedAt,
  };
}

// How many Present Students made their first Punch inside the window in each bar. A Student who
// punched twice is counted once, so the bars add up to the Students Present.
function firstPunchSlots(punches: readonly Punch[], presentIds: ReadonlySet<string>): number[] {
  const first = new Map<string, Instant>();
  for (const punch of punches) {
    if (!presentIds.has(punch.studentId) || poojaSlotOf(punch.punchedAt) === null) continue;
    const earlier = first.get(punch.studentId);
    if (earlier === undefined || punch.punchedAt < earlier) {
      first.set(punch.studentId, punch.punchedAt);
    }
  }
  const slots = Array.from({ length: POOJA_SLOTS }, () => 0);
  for (const punchedAt of first.values()) {
    const slot = poojaSlotOf(punchedAt) ?? 0;
    slots[slot] = (slots[slot] ?? 0) + 1;
  }
  return slots;
}
