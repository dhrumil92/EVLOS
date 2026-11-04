import type { Day } from '@evlos/core';
import type { OutboxRepository } from '../ports/outbox-repository.js';
import { dayInWords } from './day-in-words.js';
import { toEachAddress } from './report-email.js';
import { getReview } from './review.js';
import type { ReviewDeps, ReviewStudent } from './review.js';

export type ReviewReminderDeps = ReviewDeps & {
  outbox: Pick<OutboxRepository, 'queue'>;
  reportEmailAddresses: readonly string[];
};

const byRoomThenName = (first: ReviewStudent, second: ReviewStudent) =>
  first.room.localeCompare(second.room) || first.name.localeCompare(second.name);

const studentCount = (count: number) => `${String(count)} Student${count === 1 ? '' : 's'}`;

function bodyOf(day: Day, needsReview: readonly ReviewStudent[]): string {
  const list = [...needsReview]
    .sort(byRoomThenName)
    .map((student) => `Room ${student.room}  ${student.name}  (Student ID ${student.studentId})`);
  return [
    `${dayInWords(day)} is not Finalized yet.`,
    'These Students had no Punch and were in the hostel for the whole Pooja Window, ' +
      'so they are on Needs Review:',
    list.join('\n'),
    'Check the Leave Notes and both books, record any missing Leaves and Returns, ' +
      'then Finalize the Day on the Review page.',
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

// The Review Reminder (FR-10): at 23:00 IST, the Students on Needs Review, for each address
// in REPORT_EMAIL. Queued only when the Day is not Finalized and some Student is on Needs
// Review, and once per Day and address. Returns how many were queued.
export async function queueReviewReminder(day: Day, deps: ReviewReminderDeps): Promise<number> {
  if (deps.reportEmailAddresses.length === 0) return 0;
  const review = await getReview(day, deps);
  if (review === null || review.finalization !== null || review.needsReview.length === 0) {
    return 0;
  }
  const email = {
    kind: 'Review Reminder' as const,
    about: day,
    subject: `Review Reminder: ${studentCount(review.needsReview.length)} on Needs Review for ${dayInWords(day)}`,
    body: bodyOf(day, review.needsReview),
    attachment: null,
  };
  return deps.outbox.queue(toEachAddress(deps.reportEmailAddresses, email, deps.clock.now()));
}
