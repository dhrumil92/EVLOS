import { useState } from 'react';
import type { ReactNode } from 'react';
import { awayInOrder, hasTime, isFound, toReturnRows } from './back-book.js';
import type { ReturnWhen } from './back-book.js';
import { BOOK_DAYS } from './book-day.js';
import type { BookDay } from './book-day.js';
import { inWords, LeaveStateLabel, LeaveStatus, refusalText } from './LeaveStatus.js';
import type { ListedStudent, RowAnswer, StudentSource } from './student-source.js';

// One Away Student's line: ticked when the name is in the book. "own" is set once the
// Rector changes this line's time; until then the line follows the time at the top.
interface LineState {
  ticked: boolean;
  own: ReturnWhen | null;
  problem: string;
}

const UNTICKED: LineState = { ticked: false, own: null, problem: '' };
const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;
const istClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function namesInWords(names: readonly string[]) {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

function WhenFields(props: {
  when: ReturnWhen;
  label: string;
  today: string;
  strong: boolean;
  onChange: (when: ReturnWhen) => void;
}) {
  const { when, label } = props;
  return (
    <span className="flex flex-wrap gap-2">
      <select
        className="field w-auto"
        aria-label={`Return day for ${label}`}
        value={when.day}
        onChange={(event) => {
          props.onChange({ ...when, day: event.target.value as BookDay });
        }}
      >
        {BOOK_DAYS.map((day) => (
          <option key={day}>{day}</option>
        ))}
      </select>
      {when.day === 'Pick a date' && (
        <input
          className="field w-[10.5rem]"
          type="date"
          aria-label={`Return date for ${label}`}
          max={props.today}
          value={when.pickedDay}
          onChange={(event) => {
            props.onChange({ ...when, pickedDay: event.target.value });
          }}
        />
      )}
      <input
        className={`field w-[8.5rem] ${props.strong ? 'border-2 border-primary' : ''}`}
        type="time"
        aria-label={`Return Time for ${label}`}
        value={when.time}
        onChange={(event) => {
          props.onChange({ ...when, time: event.target.value });
        }}
      />
    </span>
  );
}

function TopTime(props: {
  top: ReturnWhen;
  today: string;
  onChange: (when: ReturnWhen) => void;
  onNow: () => void;
}) {
  return (
    <fieldset className="grid gap-2 rounded-2xl border-[1.5px] border-line-strong bg-wash px-4 pt-1 pb-3">
      <legend className="px-1.5 text-sm font-bold">Return Time for ticked Students</legend>
      <div className="flex flex-wrap items-center gap-2">
        <WhenFields
          when={props.top}
          label="ticked Students"
          today={props.today}
          strong={false}
          onChange={props.onChange}
        />
        <button type="button" className="btn-quiet" onClick={props.onNow}>
          Use now
        </button>
      </div>
      <p className="text-sm text-muted">
        Each ticked line starts with this. Change a line if the book shows another time.
      </p>
    </fieldset>
  );
}

function Detail({ children }: { children: ReactNode }) {
  return <span className="text-sm text-muted">{children}</span>;
}

function ReturnLine(props: {
  student: ListedStudent;
  line: LineState;
  top: ReturnWhen;
  today: string;
  moreOpen: boolean;
  source: StudentSource;
  onTick: () => void;
  onOwn: (when: ReturnWhen) => void;
  onMore: () => void;
  onChanged: () => void;
}) {
  const { student, line } = props;
  const leave = student.openLeave;
  return (
    <li
      className={`grid grid-cols-[2rem_3.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 md:px-6 ${line.problem ? 'bg-danger-wash' : line.ticked ? 'bg-tint' : ''}`}
    >
      <input
        type="checkbox"
        className="h-5.5 w-5.5 accent-primary"
        aria-label={`${student.name} came back`}
        checked={line.ticked}
        onChange={props.onTick}
      />
      <span className="font-bold">{student.room}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold">{student.name}</span>
        <LeaveStateLabel state={student.leaveState} />
      </span>
      <button
        type="button"
        className="gear border-[1.5px] border-line"
        aria-label={`More for ${student.name}`}
        aria-expanded={props.moreOpen}
        onClick={props.onMore}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      <div className="col-start-2 col-end-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        {leave && (
          <span className="grid">
            <Detail>Out {inWords(leave.outAt)}</Detail>
            <Detail>Expected back {inWords(leave.expectedReturnAt)}</Detail>
          </span>
        )}
        {line.ticked ? (
          <span className="grid gap-1">
            <WhenFields
              when={line.own ?? props.top}
              label={student.name}
              today={props.today}
              strong={line.own !== null}
              onChange={props.onOwn}
            />
            <Detail>{line.own ? 'changed on this line' : 'from the top'}</Detail>
          </span>
        ) : (
          <Detail>Not ticked</Detail>
        )}
      </div>
      {line.problem && (
        <p role="alert" className="field-error col-start-2 col-end-5">
          {line.problem}
        </p>
      )}
      {props.moreOpen && (
        <div className="col-start-2 col-end-5 rounded-xl border border-line bg-surface p-4">
          <LeaveStatus
            student={student}
            source={props.source}
            today={props.today}
            onChanged={props.onChanged}
            offerReturn={false}
          />
        </div>
      )}
    </li>
  );
}

function useLines(startTicked: string | null) {
  const [lines, setLines] = useState<Record<string, LineState>>(
    startTicked ? { [startTicked]: { ...UNTICKED, ticked: true } } : {},
  );
  const [returned, setReturned] = useState<ReadonlySet<string>>(new Set());
  const lineOf = (studentId: string) => lines[studentId] ?? UNTICKED;
  const change = (studentId: string, patch: Partial<LineState>) => {
    setLines((old) => ({
      ...old,
      [studentId]: { ...(old[studentId] ?? UNTICKED), ...patch, problem: '' },
    }));
  };
  // Saved Students leave the book; a refused line stays ticked with its reason.
  const settle = (answers: readonly RowAnswer[]) => {
    const done = answers.filter((a) => a.outcome === 'done').map((a) => a.studentId);
    setReturned((old) => new Set([...old, ...done]));
    setLines((old) => {
      const next = { ...old };
      for (const answer of answers) {
        if (answer.outcome === 'refused') {
          next[answer.studentId] = {
            ...(old[answer.studentId] ?? UNTICKED),
            problem: refusalText(answer.reason ?? ''),
          };
        }
      }
      return next;
    });
  };
  return { lineOf, change, settle, returned };
}

function summaryOf(ticked: number, ready: number, needFix: number) {
  const fix =
    needFix === 0 ? '' : ` ${plural(needFix, 'line')} need${needFix === 1 ? 's' : ''} a fix.`;
  return `${String(ticked)} ticked, ${String(ready)} ready.${fix}`;
}

function recordedNote(names: readonly string[]) {
  if (names.length === 0) return 'Nothing was saved. Each ticked line says why.';
  const are = names.length === 1 ? 'is' : 'are';
  return `Recorded ${plural(names.length, 'Return')}. ${namesInWords(names)} ${are} in hostel.`;
}

// The Back-from-Home Book (FR-5): every Away Student is listed, so the Rector ticks the names
// written in the book. One Return Time at the top fills every ticked line; a line can differ.
export function BackFromHomeBook(props: {
  students: readonly ListedStudent[];
  source: StudentSource;
  today: string;
  now?: () => number;
  startTicked: string | null;
  onSaved: () => void;
}) {
  const [top, setTop] = useState<ReturnWhen>({ day: 'Today', pickedDay: '', time: '' });
  const [find, setFind] = useState('');
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [note, setNote] = useState<{ saved: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const book = useLines(props.startTicked);

  const away = awayInOrder(props.students).filter((s) => !book.returned.has(s.studentId));
  const whenOf = (s: ListedStudent) => book.lineOf(s.studentId).own ?? top;
  const ticked = away.filter((s) => book.lineOf(s.studentId).ticked);
  const ready = ticked.filter((s) => hasTime(whenOf(s)) && book.lineOf(s.studentId).problem === '');
  const needFix = ticked.filter((s) => book.lineOf(s.studentId).problem !== '').length;

  const record = async () => {
    setSending(true);
    try {
      const rows = ready.map((student) => ({ student, when: whenOf(student) }));
      const answers = await props.source.returnLeaves(toReturnRows(rows, props.today));
      const done = new Set(answers.filter((a) => a.outcome === 'done').map((a) => a.studentId));
      book.settle(answers);
      const names = ready.filter((s) => done.has(s.studentId)).map((s) => s.name);
      setNote({ saved: names.length > 0, text: recordedNote(names) });
      props.onSaved();
    } catch {
      setNote({
        saved: false,
        text: 'Nothing was saved. Check the server, then press Record again.',
      });
    } finally {
      setSending(false);
    }
  };

  if (away.length === 0 && note === null) {
    return (
      <section aria-label="Students who are Away" className="report-card">
        <p className="text-muted">No Student is Away, so there is no Return to record.</p>
      </section>
    );
  }

  return (
    <section aria-label="Students who are Away" className="book-card grid">
      <div className="grid gap-4 px-4 pt-5 pb-4 md:px-6">
        <div>
          <h2 className="font-display text-2xl font-bold">Tick each Student written in the book</h2>
          <p className="text-muted">
            Only Students who are Away are listed, so there is nothing to search for most days.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="grid flex-[1_1_14rem] gap-1 text-sm font-bold">
            Find
            <input
              className="field w-full font-normal"
              type="search"
              aria-label="Find by room or name"
              placeholder="Room or name"
              value={find}
              onChange={(event) => {
                setFind(event.target.value);
              }}
            />
          </label>
          <div className="flex-[2_1_24rem]">
            <TopTime
              top={top}
              today={props.today}
              onChange={setTop}
              onNow={() => {
                setTop({
                  day: 'Today',
                  pickedDay: '',
                  time: istClock.format((props.now ?? Date.now)()),
                });
              }}
            />
          </div>
        </div>
        {note && (
          <p
            role="status"
            className={`rounded-xl border px-4 py-3 font-bold ${note.saved ? 'border-ok-line bg-ok-wash text-ok' : 'border-danger-line bg-danger-wash text-danger'}`}
          >
            {note.text}
          </p>
        )}
      </div>
      <ul aria-label="Away Students to tick">
        {away
          .filter((s) => isFound(s, find))
          .map((student) => (
            <ReturnLine
              key={student.studentId}
              student={student}
              line={book.lineOf(student.studentId)}
              top={top}
              today={props.today}
              moreOpen={moreFor === student.studentId}
              source={props.source}
              onTick={() => {
                book.change(student.studentId, { ticked: !book.lineOf(student.studentId).ticked });
              }}
              onOwn={(when) => {
                book.change(student.studentId, { own: when });
              }}
              onMore={() => {
                setMoreFor((old) => (old === student.studentId ? null : student.studentId));
              }}
              onChanged={props.onSaved}
            />
          ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[20px] border-t border-line bg-wash px-4 py-4 md:px-6">
        <p>{summaryOf(ticked.length, ready.length, needFix)}</p>
        <button
          type="button"
          className="btn min-h-13 px-7 text-lg"
          disabled={ready.length === 0 || sending}
          onClick={() => void record()}
        >
          Record {plural(ready.length, 'Return')}
        </button>
      </div>
    </section>
  );
}
