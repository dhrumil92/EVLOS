import { useState } from 'react';
import { timeOfDay } from './ist-words.js';
import type { NotificationState, Review } from './review-source.js';

type Absent = Review['absent'][number];

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;
const isAre = (count: number) => (count === 1 ? 'is' : 'are');

const NOTIFICATION_TEXT: Record<NotificationState, string> = {
  queued: 'Notification queued',
  sent: 'Notification sent',
  failed: 'Notification not sent',
};
const NOTIFICATION_LOOK: Record<NotificationState, string> = {
  queued: 'status-review',
  sent: 'status-present',
  failed: 'status-absent',
};

// A Student is still waiting for a decision until emailed or Excluded on the server.
const isOpen = (one: Absent) => one.notification === null && !one.isExcluded;

function EmailState(props: { student: Absent; isCrossed: boolean }) {
  const { student } = props;
  if (student.notification) {
    return (
      <span className={`status ${NOTIFICATION_LOOK[student.notification]}`}>
        {NOTIFICATION_TEXT[student.notification]}
      </span>
    );
  }
  if (student.isExcluded || props.isCrossed) {
    return <span className="status bg-quiet text-quiet-ink">Excluded</span>;
  }
  return <span className="status bg-tint text-primary">Will get the email</span>;
}

function AbsentRow(props: { student: Absent; isCrossed: boolean; onToggle: () => void }) {
  const { student, isCrossed } = props;
  return (
    <tr
      className={
        student.punchAfterFinalize !== null && isOpen(student) ? 'bg-after-finalize-row' : ''
      }
    >
      <td className="font-bold">{student.room}</td>
      <td>
        <span className="block font-bold">{student.name}</span>
        {student.punchAfterFinalize !== null && (
          <span className="text-sm font-bold text-after-finalize">
            Punched at {timeOfDay(student.punchAfterFinalize)}, arrived after Finalize
          </span>
        )}
      </td>
      <td>
        <EmailState student={student} isCrossed={isCrossed} />
      </td>
      <td>
        {isOpen(student) && (
          <button
            className="btn-quiet whitespace-nowrap"
            type="button"
            aria-label={isCrossed ? `Include ${student.name} again` : `Exclude ${student.name}`}
            onClick={props.onToggle}
          >
            {isCrossed ? 'Include again' : 'Exclude'}
          </button>
        )}
      </td>
    </tr>
  );
}

// A Punch made in the Pooja Window that reached EVLOS after Finalize (FR-2): the Student stays
// Absent, so the Rector can Exclude the name before any email goes out.
function PunchAfterFinalizeBanner(props: {
  students: readonly Absent[];
  crossed: readonly string[];
  onExclude: (studentId: string) => void;
}) {
  if (props.students.length === 0) return null;
  return (
    <section
      aria-label="Punch After Finalize"
      className="grid gap-3 rounded-[18px] border-[1.5px] border-after-finalize-line bg-after-finalize-wash px-5 py-4 text-after-finalize-ink"
    >
      <h2 className="font-bold">{plural(props.students.length, 'Punch')} After Finalize</h2>
      <ul className="grid gap-3">
        {props.students.map((student) => (
          <li key={student.studentId} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="flex-[1_1_26rem]">
              {student.name} punched at {timeOfDay(student.punchAfterFinalize ?? 0)} in the Pooja
              Window, but the Punch reached EVLOS after you Finalized. The Student stays Absent in
              Reports.
            </p>
            {props.crossed.includes(student.studentId) ? (
              <p className="font-bold">Excluded. No email will go out.</p>
            ) : (
              <button
                className="btn border-after-finalize bg-after-finalize"
                type="button"
                aria-label={`Exclude ${student.name}, whose Punch arrived after Finalize`}
                onClick={() => {
                  props.onExclude(student.studentId);
                }}
              >
                Exclude {student.name}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function barText(absent: readonly Absent[], crossed: readonly string[]) {
  const willGet = absent.filter((one) => isOpen(one) && !crossed.includes(one.studentId)).length;
  const excluded = absent.filter(
    (one) => one.notification === null && (one.isExcluded || crossed.includes(one.studentId)),
  ).length;
  const emailed = absent.filter((one) => one.notification !== null).length;
  const parts = [`${plural(willGet, 'Student')} will get the email.`];
  if (excluded > 0) parts.push(`${String(excluded)} ${isAre(excluded)} Excluded.`);
  if (emailed > 0)
    parts.push(`${String(emailed)} already ${emailed === 1 ? 'has' : 'have'} a Notification.`);
  return { willGet, text: parts.join(' ') };
}

// Send asks once, in the bar itself, because an email cannot be taken back.
function SendBar(props: {
  absent: readonly Absent[];
  crossed: readonly string[];
  onSend: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const { willGet, text } = barText(props.absent, props.crossed);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[20px] border-t border-line bg-wash px-4 py-4 md:px-6">
      {asking ? (
        <>
          <p className="font-bold">Send {plural(willGet, 'email')} now?</p>
          <span className="flex flex-wrap gap-3">
            <button
              className="btn-quiet"
              type="button"
              onClick={() => {
                setAsking(false);
              }}
            >
              Go back
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setAsking(false);
                props.onSend();
              }}
            >
              Yes, send
            </button>
          </span>
        </>
      ) : (
        <>
          <p>{text}</p>
          <button
            className="btn min-h-13 px-6 text-lg"
            type="button"
            disabled={willGet === 0}
            onClick={() => {
              setAsking(true);
            }}
          >
            Send Notifications to {plural(willGet, 'Student')}
          </button>
        </>
      )}
    </div>
  );
}

function GoodToKnow() {
  return (
    <section className="report-card grid gap-2" aria-label="Good to know">
      <h2 className="font-display text-lg font-bold">Good to know</h2>
      <ul className="grid list-disc gap-1.5 pl-5 text-muted">
        <li>Each Student gets at most one email for this Day, even if you press Send twice.</li>
        <li>After sending, every line shows Notification queued, sent or not sent.</li>
        <li>The Daily Report goes to the Report Recipients at 23:30 whether you send or not.</li>
      </ul>
    </section>
  );
}

// After Finalize (FR-9): Exclude any Absent Student, then Send Notifications to the rest.
export function ExcludeAndSend(props: {
  review: Review;
  finalizedLine: string;
  onSend: (excluded: string[]) => Promise<void>;
}) {
  const { absent } = props.review;
  const [crossed, setCrossed] = useState<string[]>([]);
  const toggle = (studentId: string) => {
    setCrossed((old) =>
      old.includes(studentId) ? old.filter((id) => id !== studentId) : [...old, studentId],
    );
  };
  const punchedLater = absent.filter((one) => one.punchAfterFinalize !== null && isOpen(one));
  return (
    <div className="grid gap-5">
      <PunchAfterFinalizeBanner
        students={punchedLater}
        crossed={crossed}
        onExclude={(studentId) => {
          if (!crossed.includes(studentId)) toggle(studentId);
        }}
      />
      <div className="flex flex-wrap items-start gap-5">
        <section className="book-card grid min-w-0 flex-[3_1_36rem]" aria-label="Absent Students">
          <div className="grid gap-1 px-4 pt-5 pb-3 md:px-6">
            <h2 className="font-display text-2xl font-bold">
              {plural(absent.length, 'Student')} {isAre(absent.length)} Absent
            </h2>
            <p className="text-sm font-bold text-ok">{props.finalizedLine}</p>
            <p className="max-w-[70ch] text-muted">
              {absent.length === 0
                ? 'No Student is Absent on this Day.'
                : 'Exclude a Student who explained the missed Pooja, or whose Punch arrived after Finalize. No reason is needed. An Excluded Student stays Absent in Reports but gets no email.'}
            </p>
          </div>
          {absent.length > 0 && (
            <div className="overflow-x-auto">
              <table className="student-table" aria-label="Email list">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>
                      <span className="sr-only">Change</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {absent.map((student) => (
                    <AbsentRow
                      key={student.studentId}
                      student={student}
                      isCrossed={crossed.includes(student.studentId)}
                      onToggle={() => {
                        toggle(student.studentId);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SendBar
            absent={absent}
            crossed={crossed}
            onSend={() => {
              void props.onSend(crossed).then(() => {
                setCrossed([]);
              });
            }}
          />
        </section>
        <aside className="grid min-w-0 flex-[1_1_18rem] gap-5">
          <GoodToKnow />
        </aside>
      </div>
    </div>
  );
}
