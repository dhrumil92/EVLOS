import {
  canFinalize,
  dayOf,
  daysBetween,
  isInPoojaWindow,
  PoojaStatus,
  studentsToNotify,
} from '@evlos/core';
import type { Clock, Day, Instant, Student } from '@evlos/core';
import type {
  FinalStatus,
  FinalizeRepository,
  Notification,
  NotificationState,
  PoojaResult,
} from '../ports/finalize-repository.js';
import { computedStatus, firstPunchOn, loadEvidence } from './day-evidence.js';
import { dayInWords } from './day-in-words.js';
import type { EvidenceDeps } from './day-evidence.js';
import { daysOf } from './get-report.js';

export type ReviewDeps = EvidenceDeps & { finalized: FinalizeRepository; clock: Clock };

export interface ReviewStudent {
  studentId: string;
  name: string;
  room: string;
}

export interface Review {
  day: Day;
  canFinalize: boolean;
  finalization: { finalizedBy: string; finalizedAt: Instant } | null;
  // Before Finalize: the Students Finalize will make Absent.
  needsReview: ReviewStudent[];
  // After Finalize: the email list, each with its Exclude and Notification state, and the
  // time of a Punch After Finalize when one arrived.
  absent: (ReviewStudent & {
    isExcluded: boolean;
    notification: NotificationState | null;
    punchAfterFinalize: Instant | null;
  })[];
  // Days up to now that can be Finalized and are not yet, so none is forgotten.
  notFinalizedDays: Day[];
}

export type FinalizeResult =
  | { outcome: 'finalized'; absent: number }
  | { outcome: 'refused'; reason: 'invalid-day' | 'pooja-window-open' | 'already-finalized' };

export type SendResult =
  { outcome: 'queued'; queued: number } | { outcome: 'refused'; reason: 'not-finalized' };

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// How far back the not-Finalized reminder looks.
const LOOK_BACK_DAYS = 31;

const shortly = ({ studentId, name, room }: Student): ReviewStudent => ({ studentId, name, room });

async function notFinalizedDays(deps: ReviewDeps): Promise<Day[]> {
  const now = deps.clock.now();
  const today = dayOf(now);
  const periods = await deps.students.activePeriods();
  const firstActive = periods.map((period) => period.activeFrom).sort()[0];
  if (firstActive === undefined) return [];
  const lookBack = dayOf(now - LOOK_BACK_DAYS * MS_PER_DAY);
  const days = daysBetween(firstActive > lookBack ? firstActive : lookBack, today);
  const done = new Set(
    (await deps.finalized.finalizationsBetween(days[0] ?? today, today)).map((f) => f.day),
  );
  return days.filter((day) => !done.has(day) && canFinalize(day, now));
}

// A Punch After Finalize: made inside the Pooja Window, but it reached EVLOS after the Day was
// Finalized, as when the Device was offline and sent it later with its own time (FR-2). The
// Day stays locked; the Rector sees it before Send Notifications and can Exclude the Student.
// The earliest one of each Student, by Student ID.
async function punchesAfterFinalize(day: Day, finalizedAt: Instant, deps: ReviewDeps) {
  const arrived = await deps.punches.punchesReceivedAfter(day, finalizedAt);
  const earliest = new Map<string, Instant>();
  for (const punch of arrived.filter((one) => isInPoojaWindow(one.punchedAt))) {
    const known = earliest.get(punch.studentId);
    if (known === undefined || punch.punchedAt < known) {
      earliest.set(punch.studentId, punch.punchedAt);
    }
  }
  return earliest;
}

async function absentList(
  day: Day,
  finalizedAt: Instant,
  results: PoojaResult[],
  deps: ReviewDeps,
) {
  const [students, notifications, arrivedLater] = await Promise.all([
    deps.students.list(),
    deps.finalized.notificationStates(day),
    punchesAfterFinalize(day, finalizedAt, deps),
  ]);
  const byId = new Map(students.map((student) => [student.studentId, student]));
  const stateOf = new Map(notifications.map((one) => [one.studentId, one.state]));
  return results
    .filter((result) => result.status === 'Absent')
    .flatMap((result) => {
      const student = byId.get(result.studentId);
      if (student === undefined) return [];
      const isExcluded = result.excludedAt !== null;
      const notification = stateOf.get(student.studentId) ?? null;
      const punchAfterFinalize = arrivedLater.get(student.studentId) ?? null;
      return [{ ...shortly(student), isExcluded, notification, punchAfterFinalize }];
    });
}

// The Review and Finalize page for one Day (FR-8, FR-9).
export async function getReview(day: Day, deps: ReviewDeps): Promise<Review | null> {
  if (daysOf({ view: 'Day', day }, dayOf(deps.clock.now())) === null) return null;
  const [finalizations, results, everyone, pastDays] = await Promise.all([
    deps.finalized.finalizationsBetween(day, day),
    deps.finalized.resultsBetween(day, day),
    loadEvidence(day, day, deps),
    notFinalizedDays(deps),
  ]);
  const finalization = finalizations[0] ?? null;
  const needsReview = finalization
    ? []
    : everyone
        .filter((evidence) => computedStatus(day, evidence, deps.clock) === 'Needs Review')
        .map((evidence) => shortly(evidence.student));
  return {
    day,
    canFinalize: finalization === null && canFinalize(day, deps.clock.now()),
    finalization: finalization && {
      finalizedBy: finalization.finalizedBy,
      finalizedAt: finalization.finalizedAt,
    },
    needsReview,
    absent: finalization ? await absentList(day, finalization.finalizedAt, results, deps) : [],
    notFinalizedDays: pastDays,
  };
}

// Finalize: every Needs Review becomes Absent, every Pooja Status is saved, the Day is locked.
// No email is sent (FR-8).
export async function finalizeDay(
  day: Day,
  doneBy: string,
  deps: ReviewDeps,
): Promise<FinalizeResult> {
  const now = deps.clock.now();
  if (daysOf({ view: 'Day', day }, dayOf(now)) === null) {
    return { outcome: 'refused', reason: 'invalid-day' };
  }
  if (!canFinalize(day, now)) return { outcome: 'refused', reason: 'pooja-window-open' };
  const results = (await loadEvidence(day, day, deps)).flatMap((evidence) => {
    // After the window closes a status is only ever Present, Not Applicable or Absent.
    const status = computedStatus(day, evidence, deps.clock, true) as FinalStatus | null;
    if (status === null) return [];
    const firstPunchAt = firstPunchOn(day, evidence.punches);
    return [{ studentId: evidence.student.studentId, status, firstPunchAt }];
  });
  const locked = await deps.finalized.finalize(day, results, now, doneBy);
  if (!locked) return { outcome: 'refused', reason: 'already-finalized' };
  return { outcome: 'finalized', absent: results.filter((r) => r.status === 'Absent').length };
}

function notificationFor(day: Day, student: Student): Notification {
  return {
    studentId: student.studentId,
    recipient: student.email,
    subject: `Pooja missed on ${dayInWords(day)}`,
    body:
      `Dear ${student.name},\n\n` +
      `You did not punch at Pooja on ${dayInWords(day)}, and you were in the hostel that day.\n` +
      'If you think this is a mistake, please speak to the Rector.\n\n' +
      'EVLOS, hostel Pooja attendance',
  };
}

// Send Notifications: save the Exclusions and queue one email per Absent Student who is not
// Excluded and not already notified for the Day (FR-9). The emails leave in Phase 5.
export async function sendNotifications(
  day: Day,
  excludedStudentIds: readonly string[],
  doneBy: string,
  deps: ReviewDeps,
): Promise<SendResult> {
  const [finalizations, results, notified, students] = await Promise.all([
    deps.finalized.finalizationsBetween(day, day),
    deps.finalized.resultsBetween(day, day),
    deps.finalized.notifiedStudentIds(day),
    deps.students.list(),
  ]);
  if (finalizations.length === 0) return { outcome: 'refused', reason: 'not-finalized' };
  const absent = new Set(results.filter((r) => r.status === 'Absent').map((r) => r.studentId));
  const newlyExcluded = excludedStudentIds.filter((id) => absent.has(id) && !notified.includes(id));
  const toNotify = studentsToNotify({
    isFinalized: true,
    statuses: [...absent].map((studentId) => ({ studentId, poojaStatus: PoojaStatus.ABSENT })),
    excludedStudentIds: [
      ...results.filter((r) => r.excludedAt !== null).map((r) => r.studentId),
      ...newlyExcluded,
    ],
    notifiedStudentIds: notified,
  });
  const byId = new Map(students.map((student) => [student.studentId, student]));
  const notifications = toNotify.flatMap((id) => {
    const student = byId.get(id);
    return student ? [notificationFor(day, student)] : [];
  });
  const queued = await deps.finalized.sendNotifications(
    day,
    newlyExcluded,
    notifications,
    deps.clock.now(),
    doneBy,
  );
  return { outcome: 'queued', queued };
}
