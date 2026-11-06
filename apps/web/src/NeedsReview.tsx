import { useState } from 'react';
import { DeviceLastSeen } from './DeviceLastSeen.js';
import type { DeviceStatus } from './device-status-source.js';
import { FinalizeConfirm } from './FinalizeConfirm.js';
import type { Review, ReviewStudent } from './review-source.js';

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;
export const WINDOW_OPEN = 'Finalize is available after 18:00, when the Pooja Window closes.';

function NeedsReviewTable(props: {
  students: readonly ReviewStudent[];
  onOpenLeaves?: (() => void) | undefined;
}) {
  const { onOpenLeaves } = props;
  return (
    <div className="overflow-x-auto">
      <table className="student-table" aria-label="Needs Review">
        <thead>
          <tr>
            <th>Room</th>
            <th>Student</th>
            {onOpenLeaves && <th>If the Student was away</th>}
          </tr>
        </thead>
        <tbody>
          {props.students.map((student) => (
            <tr key={student.studentId}>
              <td className="font-bold">{student.room}</td>
              <td>
                <span className="block font-bold">{student.name}</span>
                <span className="text-sm text-muted">Student ID {student.studentId}</span>
              </td>
              {onOpenLeaves && (
                <td>
                  <button
                    className="btn-quiet whitespace-nowrap"
                    type="button"
                    aria-label={`Record a missed Leave for ${student.name}`}
                    onClick={onOpenLeaves}
                  >
                    Record a missed Leave
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NeedsReviewCard(props: { review: Review; onOpenLeaves?: (() => void) | undefined }) {
  const { review } = props;
  const count = review.needsReview.length;
  if (!review.canFinalize) {
    return (
      <section className="report-card grid gap-2" aria-label="Needs Review">
        <h2 className="font-display text-2xl font-bold">The Pooja Window is still open</h2>
        <p className="text-muted">
          A Student with no Punch is Pending until 18:00. After that, anyone still without a Punch
          who was in the hostel Needs Review.
        </p>
      </section>
    );
  }
  return (
    <section className="book-card grid gap-2 pb-2" aria-label="Students who Need Review">
      <div className="grid gap-1 px-4 pt-5 md:px-6">
        <h2 className="font-display text-2xl font-bold">
          {plural(count, 'Student')} {count === 1 ? 'Needs' : 'Need'} Review
        </h2>
        <p className="max-w-[70ch] text-muted">
          {count === 0
            ? 'Every Student punched or was Away.'
            : 'They were in the hostel for the whole Pooja Window and have no Punch inside it. If one was really away, record the missed Leave and the line leaves this list. Everyone still here becomes Absent when you Finalize.'}
        </p>
      </div>
      {count > 0 && (
        <NeedsReviewTable students={review.needsReview} onOpenLeaves={props.onOpenLeaves} />
      )}
    </section>
  );
}

function BeforeYouFinalize(props: {
  device: DeviceStatus | null;
  onOpenLeaves?: (() => void) | undefined;
}) {
  return (
    <section className="report-card grid gap-3" aria-label="Before you Finalize">
      <h2 className="font-display text-xl font-bold">Before you Finalize</h2>
      <DeviceLastSeen status={props.device} />
      <div className="grid gap-1">
        <p className="font-bold">Both books copied?</p>
        <p className="text-muted">
          Check the Leave Notes and both books, and record any missing Leaves and Returns. A Leave
          recorded after Finalize does not change this Day.
        </p>
        {props.onOpenLeaves && (
          <button
            className="link-button justify-self-start"
            type="button"
            onClick={props.onOpenLeaves}
          >
            Open Leaves
          </button>
        )}
      </div>
    </section>
  );
}

function FinalizeCard(props: { review: Review; dayWords: string; onAsk: () => void }) {
  const { review } = props;
  if (!review.canFinalize) {
    return (
      <section className="report-card grid gap-2" aria-label="Finalize">
        <h2 className="font-display text-xl font-bold">Finalize {props.dayWords}</h2>
        <p className="text-muted">{WINDOW_OPEN}</p>
      </section>
    );
  }
  const count = review.needsReview.length;
  return (
    <section className="report-card grid gap-3 border-[1.5px] border-primary" aria-label="Finalize">
      <h2 className="font-display text-xl font-bold">Finalize {props.dayWords}</h2>
      <ul className="grid list-disc gap-1 pl-5 text-muted">
        <li>
          {count === 0
            ? 'No Student becomes Absent.'
            : `The ${plural(count, 'Student')} above become${count === 1 ? 's' : ''} Absent.`}
        </li>
        <li>The Day is locked.</li>
        <li>No email goes out yet. You choose who gets one next.</li>
      </ul>
      <button className="btn min-h-13 text-lg" type="button" onClick={props.onAsk}>
        Finalize the Day
      </button>
      <p className="text-sm text-muted">
        Not done by 23:00? The Review Reminder email lists the Students who Need Review.
      </p>
    </section>
  );
}

// Before Finalize (FR-8): who Needs Review, what to check, and Finalize with a confirmation
// that names the Students who become Absent and warns when the Device is quiet.
export function NeedsReview(props: {
  review: Review;
  dayWords: string;
  device: DeviceStatus | null;
  onFinalize: () => Promise<void>;
  onOpenLeaves?: (() => void) | undefined;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="grid min-w-0 flex-[3_1_36rem] gap-5">
        <NeedsReviewCard review={props.review} onOpenLeaves={props.onOpenLeaves} />
      </div>
      <aside className="grid min-w-0 flex-[1_1_18rem] gap-5">
        <BeforeYouFinalize device={props.device} onOpenLeaves={props.onOpenLeaves} />
        <FinalizeCard
          review={props.review}
          dayWords={props.dayWords}
          onAsk={() => {
            setAsking(true);
          }}
        />
      </aside>
      {asking && (
        <FinalizeConfirm
          dayWords={props.dayWords}
          names={props.review.needsReview}
          deviceQuiet={props.device?.isQuiet ?? false}
          onFinalize={() => {
            setAsking(false);
            void props.onFinalize();
          }}
          onBack={() => {
            setAsking(false);
          }}
        />
      )}
    </div>
  );
}
