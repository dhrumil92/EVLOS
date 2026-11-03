import type { Day, Instant } from '@evlos/core';
import type {
  Finalization,
  FinalizeRepository,
  Notification,
  PoojaResult,
} from '../ports/finalize-repository.js';

// An in-memory FinalizeRepository for use-case tests.
export function fakeFinalizeRepository() {
  const finalizations: Finalization[] = [];
  const results: (PoojaResult & { day: Day })[] = [];
  const queued: (Notification & { day: Day })[] = [];
  const audit: string[] = [];
  // Every list of Notifications the use case asked to queue.
  const asked: Notification[][] = [];
  const inSpan = (day: Day, first: Day, last: Day) => day >= first && day <= last;

  const finalized: FinalizeRepository = {
    finalizationsBetween: (first, last) =>
      Promise.resolve(finalizations.filter((one) => inSpan(one.day, first, last))),
    finalize: (day, dayResults, at: Instant, doneBy) => {
      if (finalizations.some((one) => one.day === day)) return Promise.resolve(false);
      finalizations.push({ day, finalizedBy: doneBy, finalizedAt: at });
      results.push(...dayResults.map((result) => ({ ...result, day, excludedAt: null })));
      audit.push('Finalize');
      return Promise.resolve(true);
    },
    resultsBetween: (first, last) =>
      Promise.resolve(results.filter((one) => inSpan(one.day, first, last)).map((r) => ({ ...r }))),
    notifiedStudentIds: (day) =>
      Promise.resolve(queued.filter((one) => one.day === day).map((one) => one.studentId)),
    sendNotifications: (day, excludedStudentIds, notifications, at) => {
      asked.push(notifications);
      for (const result of results) {
        if (result.day === day && excludedStudentIds.includes(result.studentId)) {
          result.excludedAt ??= at;
        }
      }
      const fresh = notifications.filter(
        (one) => !queued.some((old) => old.day === day && old.studentId === one.studentId),
      );
      queued.push(...fresh.map((one) => ({ ...one, day })));
      audit.push('Send Notifications');
      return Promise.resolve(fresh.length);
    },
  };
  return { finalized, finalizations, results, queued, audit, asked };
}
