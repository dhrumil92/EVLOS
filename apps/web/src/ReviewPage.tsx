import { useCallback, useEffect, useState } from 'react';
import { dayAfter, dayBefore } from './calendar-day.js';
import { useDeviceStatus } from './DeviceLastSeen.js';
import { httpDeviceStatusSource } from './device-status-source.js';
import type { DeviceStatus, DeviceStatusSource } from './device-status-source.js';
import { NeedsReview, WINDOW_OPEN } from './NeedsReview.js';
import type { PoojaStatusName, ReportSource } from './report-source.js';
import type { NotificationState, Review, ReviewSource } from './review-source.js';
import { ReviewSteps } from './ReviewSteps.js';

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
  'pooja-window-open': WINDOW_OPEN,
  'already-finalized': 'This Day is already Finalized.',
  'not-finalized': 'Finalize the Day before sending Notifications.',
};
const refusalText = (reason: string) => REFUSALS[reason] ?? 'Nothing changed. Reload the page.';
const NOTIFICATION_TEXT: Record<NotificationState, string> = {
  queued: 'Notification queued',
  sent: 'Notification sent',
  failed: 'Notification not sent',
};
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

function Arrow(props: { label: string; disabled: boolean; path: string; onClick: () => void }) {
  return (
    <button
      className="gear border-[1.5px] border-line-strong bg-surface disabled:cursor-not-allowed disabled:opacity-40"
      type="button"
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d={props.path} />
      </svg>
    </button>
  );
}

// The Day, with arrows for the day before and after; no Day after today (FR-8).
function DaySwitcher(props: {
  day: string;
  today: string;
  finalizedAt: number | null;
  onDay: (day: string) => void;
}) {
  const { day } = props;
  return (
    <div className="grid justify-items-end gap-1">
      <div className="flex items-end gap-2">
        <Arrow
          label="Previous Day"
          disabled={false}
          path="M15 6l-6 6 6 6"
          onClick={() => {
            props.onDay(dayBefore(day));
          }}
        />
        <label className="grid gap-1 text-sm font-bold text-muted">
          Day
          <input
            className="field font-normal"
            type="date"
            max={props.today}
            value={day}
            onChange={(event) => {
              if (event.target.value) props.onDay(event.target.value);
            }}
          />
        </label>
        <Arrow
          label="Next Day"
          disabled={day >= props.today}
          path="M9 6l6 6-6 6"
          onClick={() => {
            props.onDay(dayAfter(day));
          }}
        />
      </div>
      <p
        className={`text-sm font-bold ${props.finalizedAt === null ? 'text-review-ink' : 'text-ok'}`}
      >
        {props.finalizedAt === null
          ? 'Not Finalized'
          : `Finalized at ${timeWords.format(props.finalizedAt)}`}
      </p>
    </div>
  );
}

function EarlierDays(props: { review: Review | null; day: string; onDay: (day: string) => void }) {
  const others = (props.review?.notFinalizedDays ?? []).filter((day) => day !== props.day);
  if (others.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted">Earlier Days not Finalized:</span>
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
  );
}

// The Pooja Statuses of the Day, from its Day Report. Reloaded whenever the Review changes,
// so the counts follow a Finalize.
function useDayStatuses(reports: ReportSource | undefined, day: string, review: Review | null) {
  const [statuses, setStatuses] = useState<PoojaStatusName[] | null>(null);
  useEffect(() => {
    if (reports === undefined || review === null) return;
    let isCurrent = true;
    reports
      .load({ view: 'Day', day })
      .then((report) => {
        if (!isCurrent) return;
        setStatuses(report.rows.flatMap((row) => (row.statuses[0] ? [row.statuses[0]] : [])));
      })
      .catch(() => {
        if (isCurrent) setStatuses(null);
      });
    return () => {
      isCurrent = false;
    };
  }, [reports, day, review]);
  return statuses;
}

function DayCounts(props: { review: Review; statuses: PoojaStatusName[] }) {
  const { review, statuses } = props;
  const third: PoojaStatusName = review.finalization
    ? 'Absent'
    : review.canFinalize
      ? 'Needs Review'
      : 'Pending';
  const count = (status: PoojaStatusName) => statuses.filter((one) => one === status).length;
  const cells = [
    { label: 'Present', value: count('Present'), tone: 'text-present-ink' },
    { label: 'Not Applicable (on Leave)', value: count('Not Applicable'), tone: 'text-muted' },
    { label: third, value: count(third), tone: 'text-review-ink' },
    { label: 'Active Students', value: statuses.length, tone: 'text-ink' },
  ];
  return (
    <section
      aria-label="Pooja Status for this Day"
      className="grid grid-cols-2 overflow-hidden rounded-[20px] border border-line bg-surface md:grid-cols-4"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="grid border-r border-line px-5 py-4">
          <span className="text-sm text-muted">{cell.label}</span>
          <span className={`font-display text-4xl font-extrabold ${cell.tone}`}>{cell.value}</span>
        </div>
      ))}
    </section>
  );
}

// Loads the Day's Review and runs Finalize and Send Notifications for it.
function useReview(source: ReviewSource, day: string) {
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

  // A Review loaded for another Day is never shown for this one.
  return { review, current: review?.day === day ? review : null, note, finalize, send };
}

// The Day's steps, counts and either the Needs Review list or the email list.
function DayBody(props: {
  review: Review;
  day: string;
  statuses: PoojaStatusName[] | null;
  device: DeviceStatus | null;
  onFinalize: () => Promise<void>;
  onSend: (excluded: string[]) => Promise<void>;
  onOpenLeaves?: (() => void) | undefined;
}) {
  const { review, day } = props;
  const { finalization } = review;
  return (
    <>
      {props.statuses && <DayCounts review={review} statuses={props.statuses} />}
      {finalization ? (
        <section className="report-card grid gap-4" aria-label={inWords(day)}>
          <div>
            <h2 className="font-display text-2xl font-bold">{inWords(day)}</h2>
            <p className="text-muted">
              {`Finalized at ${timeWords.format(finalization.finalizedAt)} by ${finalization.finalizedBy}.`}
            </p>
          </div>
          <AfterFinalize key={day} review={review} onSend={props.onSend} />
        </section>
      ) : (
        <NeedsReview
          key={day}
          review={review}
          dayWords={inWords(day)}
          device={props.device}
          onFinalize={props.onFinalize}
          onOpenLeaves={props.onOpenLeaves}
        />
      )}
    </>
  );
}

// The Review and Finalize page: Needs Review, Finalize, Exclude, Send Notifications.
export function ReviewPage(props: {
  source: ReviewSource;
  today: string;
  device?: DeviceStatusSource;
  reports?: ReportSource;
  onOpenLeaves?: (() => void) | undefined;
}) {
  const device = useDeviceStatus(props.device ?? httpDeviceStatusSource);
  const [day, setDay] = useState(props.today);
  const { review, current, note, finalize, send } = useReview(props.source, day);
  const statuses = useDayStatuses(props.reports, day, review);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
            Review and Finalize
          </h1>
          <p className="text-muted">
            Review the Needs Review list, Finalize the Day, then Send Notifications.
          </p>
        </div>
        <DaySwitcher
          day={day}
          today={props.today}
          finalizedAt={current?.finalization?.finalizedAt ?? null}
          onDay={setDay}
        />
      </div>
      <EarlierDays review={review} day={day} onDay={setDay} />
      {current && <ReviewSteps review={current} />}
      {note && (
        <p className="notice" role="status">
          {note}
        </p>
      )}
      {current && (
        <DayBody
          review={current}
          day={day}
          statuses={statuses}
          device={device}
          onFinalize={finalize}
          onSend={send}
          onOpenLeaves={props.onOpenLeaves}
        />
      )}
    </div>
  );
}
