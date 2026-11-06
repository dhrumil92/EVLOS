import { useCallback, useEffect, useState } from 'react';
import { DeviceLastSeen, useDeviceStatus } from './DeviceLastSeen.js';
import { httpDeviceStatusSource } from './device-status-source.js';
import type { DeviceStatus, DeviceStatusSource } from './device-status-source.js';
import type { NotificationState, Review, ReviewSource, ReviewStudent } from './review-source.js';

const IST = { timeZone: 'Asia/Kolkata' } as const;
const dayWords = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const timeWords = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const inWords = (day: string) =>
  dayWords.format(new Date(`${day}T12:00:00+05:30`)).replace(',', '');

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

const REFUSALS: Record<string, string> = {
  'pooja-window-open': 'Finalize is available after 18:00, when the Pooja Window closes.',
  'already-finalized': 'This Day is already Finalized.',
  'not-finalized': 'Finalize the Day before sending Notifications.',
};
const refusalText = (reason: string) => REFUSALS[reason] ?? 'Nothing changed. Reload the page.';
const NOTIFICATION_TEXT: Record<NotificationState, string> = {
  queued: 'Notification queued',
  sent: 'Notification sent',
  failed: 'Notification not sent',
};
const QUIET_DEVICE =
  'The Device has not been in touch for 10 minutes or more, so Punches may still be on it. ';
// The server failed part way, so the page cannot know what was saved.
const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';

// Asks before a change that cannot be undone from the page. Also used on the Settings page.
export function Confirm(props: {
  question: string;
  yes: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="danger-zone grid gap-3" role="group" aria-label="Confirm">
      <p className="font-display text-xl font-semibold">{props.question}</p>
      <div className="flex flex-wrap gap-3">
        <button className="btn" type="button" onClick={props.onYes}>
          {props.yes}
        </button>
        <button className="btn-quiet" type="button" onClick={props.onNo}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function StudentTable(props: { label: string; students: ReviewStudent[] }) {
  return (
    <div className="student-scroll">
      <table className="student-table" aria-label={props.label}>
        <thead>
          <tr>
            <th>Room</th>
            <th>Student</th>
            <th>Student ID</th>
          </tr>
        </thead>
        <tbody>
          {props.students.map((student) => (
            <tr key={student.studentId}>
              <td>{student.room}</td>
              <td className="font-semibold">{student.name}</td>
              <td>{student.studentId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Before Finalize: the Device's Last Seen, the Needs Review list and the Finalize button
// (FR-8). A quiet Device is named in the question, as Punches may still be on it.
function BeforeFinalize(props: {
  review: Review;
  device: DeviceStatus | null;
  onFinalize: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const { review } = props;
  if (!review.canFinalize) {
    return <p className="text-muted">{REFUSALS['pooja-window-open']}</p>;
  }
  const count = review.needsReview.length;
  return (
    <div className="grid gap-4">
      <p className="notice">
        Before you Finalize, check the Leave Notes and both books, and record any missing Leaves and
        Returns. A Student with a Leave is Not Applicable, never Absent.
      </p>
      <DeviceLastSeen status={props.device} />
      {count === 0 ? (
        <p className="text-muted">
          No Student is on Needs Review. Every Student punched or was Away.
        </p>
      ) : (
        <StudentTable label="Needs Review" students={review.needsReview} />
      )}
      {asking ? (
        <Confirm
          question={`${props.device?.isQuiet ? QUIET_DEVICE : ''}${plural(count, 'Student')} will be Absent. The Day will be locked.`}
          yes="Yes, Finalize"
          onYes={() => void props.onFinalize()}
          onNo={() => {
            setAsking(false);
          }}
        />
      ) : (
        <div>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setAsking(true);
            }}
          >
            Finalize the Day
          </button>
        </div>
      )}
    </div>
  );
}

// The Student's name, with a Punch After Finalize under it when one arrived (FR-2).
function AbsentName({ student }: { student: Review['absent'][number] }) {
  return (
    <span className="grid">
      <span className="font-semibold">{student.name}</span>
      {student.punchAfterFinalize !== null && (
        <span className="text-sm font-bold text-after-finalize">
          Punched at {timeWords.format(student.punchAfterFinalize)}, arrived after Finalize
        </span>
      )}
    </span>
  );
}

function AbsentRow(props: {
  student: Review['absent'][number];
  isCrossed: boolean;
  onToggle: () => void;
}) {
  const { student, isCrossed } = props;
  const state = student.notification
    ? NOTIFICATION_TEXT[student.notification]
    : student.isExcluded
      ? 'Excluded'
      : null;
  return (
    <li className={`email-row ${isCrossed || student.isExcluded ? 'email-row-excluded' : ''}`}>
      <span className="text-muted">{student.room}</span>
      <AbsentName student={student} />
      {state ? (
        <span className="text-muted">{state}</span>
      ) : (
        <button
          className={isCrossed ? 'link-button' : 'cross'}
          type="button"
          aria-label={isCrossed ? `Include ${student.name} again` : `Exclude ${student.name}`}
          title={isCrossed ? 'Include again' : 'Exclude from the email'}
          onClick={props.onToggle}
        >
          {isCrossed ? 'Undo' : '×'}
        </button>
      )}
    </li>
  );
}

// After Finalize: the email list with a cross for each Absent Student (FR-9).
function AfterFinalize(props: { review: Review; onSend: (excluded: string[]) => Promise<void> }) {
  const { review } = props;
  const [crossed, setCrossed] = useState<string[]>([]);
  const [asking, setAsking] = useState(false);
  const toSend = review.absent.filter(
    (one) => one.notification === null && !one.isExcluded && !crossed.includes(one.studentId),
  ).length;
  const toggle = (studentId: string) => {
    setCrossed((old) =>
      old.includes(studentId) ? old.filter((id) => id !== studentId) : [...old, studentId],
    );
  };
  const button = `Send Notifications to ${plural(toSend, 'Student')}`;
  // A Punch After Finalize may mean the Student was at Pooja (FR-2); only unsent ones matter.
  const punchedLater = review.absent.filter(
    (one) => one.punchAfterFinalize !== null && one.notification === null,
  ).length;
  return (
    <div className="grid gap-4">
      {punchedLater > 0 && (
        <p className="notice" role="status">
          {plural(punchedLater, 'Student')} punched in the Pooja Window, but the Punch arrived after
          Finalize. Check before you Send Notifications, and Exclude a Student who was at Pooja.
        </p>
      )}
      {review.absent.length === 0 ? (
        <p className="text-muted">No Student is Absent on this Day.</p>
      ) : (
        <>
          <p className="text-muted">
            Absent Students get one email each. Press the cross to Exclude a Student who explained
            why he missed Pooja. He stays Absent in Reports.
          </p>
          <ul className="grid" aria-label="Email list">
            {review.absent.map((student) => (
              <AbsentRow
                key={student.studentId}
                student={student}
                isCrossed={crossed.includes(student.studentId)}
                onToggle={() => {
                  toggle(student.studentId);
                }}
              />
            ))}
          </ul>
        </>
      )}
      {asking ? (
        <Confirm
          question={`${button}?`}
          yes="Yes, send"
          onYes={() => {
            setAsking(false);
            void props.onSend(crossed).then(() => {
              setCrossed([]);
            });
          }}
          onNo={() => {
            setAsking(false);
          }}
        />
      ) : (
        <div>
          <button
            className="btn"
            type="button"
            disabled={toSend === 0}
            onClick={() => {
              setAsking(true);
            }}
          >
            {button}
          </button>
        </div>
      )}
    </div>
  );
}

function DayChooser(props: {
  review: Review | null;
  day: string;
  today: string;
  onDay: (day: string) => void;
}) {
  const others = (props.review?.notFinalizedDays ?? []).filter((day) => day !== props.day);
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <label className="grid gap-1 text-muted">
        Day
        <input
          className="field"
          type="date"
          max={props.today}
          value={props.day}
          onChange={(event) => {
            if (event.target.value) props.onDay(event.target.value);
          }}
        />
      </label>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">Not Finalized yet:</span>
          {others.map((day) => (
            <button
              key={day}
              className="btn-quiet"
              type="button"
              onClick={() => {
                props.onDay(day);
              }}
            >
              {inWords(day)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The Review and Finalize page: Needs Review, Finalize, Exclude, Send Notifications.
export function ReviewPage(props: {
  source: ReviewSource;
  today: string;
  device?: DeviceStatusSource;
}) {
  const { source } = props;
  const device = useDeviceStatus(props.device ?? httpDeviceStatusSource);
  const [day, setDay] = useState(props.today);
  const [review, setReview] = useState<Review | null>(null);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      setReview(await source.load(day));
    } catch {
      setNote('The Review cannot be loaded. Check the server, then reload this page.');
    }
  }, [source, day]);

  useEffect(() => {
    setNote('');
    void refresh();
  }, [refresh]);

  // Runs one of the Rector's actions and always shows how it ended, even when the server fails.
  const act = async (action: () => Promise<string>) => {
    try {
      setNote(await action());
    } catch {
      setNote(SERVER_FAILED);
    }
    await refresh();
  };

  const finalize = () =>
    act(async () => {
      const answer = await source.finalize(day);
      return 'outcome' in answer
        ? `Finalized. ${plural(answer.absent, 'Student')} Absent.`
        : refusalText(answer.reason);
    });

  const send = (excluded: string[]) =>
    act(async () => {
      const answer = await source.send(day, excluded);
      return 'outcome' in answer
        ? `${plural(answer.queued, 'Notification')} queued. Emails go out within a few minutes.`
        : refusalText(answer.reason);
    });

  const finalization = review?.day === day ? review.finalization : null;
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-display text-[2.5rem] leading-tight font-bold text-primary">
          Review and Finalize
        </h1>
        <p className="text-muted">
          Review the Needs Review list, Finalize the Day, then Send Notifications.
        </p>
      </div>
      <DayChooser review={review} day={day} today={props.today} onDay={setDay} />
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      {review && (
        <section className="report-card grid gap-4" aria-label={inWords(day)}>
          <div>
            <h2 className="font-display text-2xl font-semibold">{inWords(day)}</h2>
            <p className="text-muted">
              {finalization
                ? `Finalized at ${timeWords.format(finalization.finalizedAt)} by ${finalization.finalizedBy}.`
                : 'Not Finalized.'}
            </p>
          </div>
          {finalization ? (
            <AfterFinalize key={day} review={review} onSend={send} />
          ) : (
            <BeforeFinalize key={day} review={review} device={device} onFinalize={finalize} />
          )}
        </section>
      )}
    </div>
  );
}
