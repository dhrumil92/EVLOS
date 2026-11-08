import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { inWords, refusalText } from './LeaveStatus.js';
import {
  blankLine,
  isAlreadyAway,
  isReady,
  newLineFrom,
  studentsInRooms,
  toLeaveRows,
} from './going-book.js';
import type { BookLine } from './going-book.js';
import { BOOK_DAYS } from './book-day.js';
import type { BookDay } from './book-day.js';
import type { ListedStudent, RowAnswer, StudentSource } from './student-source.js';

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;
const inputClass = 'field w-full';
// Fixed widths, so date and time boxes never stretch a line past its card.
const timeClass = 'field w-[8.5rem]';
const dateClass = 'field w-[10.5rem]';

// "Asha", "Asha and Bina", "Asha, Bina and Chitra".
function namesInWords(names: readonly string[]) {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1] ?? ''}`;
}

const canSend = (line: BookLine) => isReady(line) && line.problem === '';

// The lines and the changes the Rector can make to them. A refused line keeps its reason
// until the line is changed (FR-4: only that line is blocked).
// The book opens with one line for each Student sent from another page, or one blank line.
function firstLines(students: readonly ListedStudent[], startStudents: readonly string[]) {
  const sent = startStudents.flatMap((id) => students.filter((s) => s.studentId === id));
  if (sent.length === 0) return [blankLine(1)];
  return sent.map((student, index) => ({ ...blankLine(index + 1), student, room: student.room }));
}

function useBookLines(first: () => BookLine[]) {
  const [lines, setLines] = useState<BookLine[]>(first);
  // Each line needs its own React key; a counter never hands out the same one twice.
  const lastKey = useRef(lines.length);
  const takeKey = () => {
    lastKey.current += 1;
    return lastKey.current;
  };
  return {
    lines,
    change: (key: number, patch: Partial<BookLine>) => {
      setLines((old) =>
        old.map((line) => (line.key === key ? { ...line, ...patch, problem: '' } : line)),
      );
    },
    add: () => {
      const key = takeKey();
      setLines((old) => {
        const above = old[old.length - 1];
        return [...old, above ? newLineFrom(above, key, old.length) : blankLine(key)];
      });
    },
    remove: (key: number) => {
      const fresh = takeKey();
      setLines((old) => {
        const left = old.filter((line) => line.key !== key);
        return left.length > 0 ? left : [blankLine(fresh)];
      });
    },
    settle: (answers: readonly RowAnswer[]) => {
      const saved = new Set(answers.filter((a) => a.outcome === 'done').map((a) => a.studentId));
      const refused = new Map(
        answers.filter((a) => a.outcome === 'refused').map((a) => [a.studentId, a.reason ?? '']),
      );
      const fresh = takeKey();
      setLines((old) => {
        const left = old
          .filter((line) => !(canSend(line) && saved.has(line.student?.studentId ?? '')))
          .map((line) => {
            const reason = refused.get(line.student?.studentId ?? '');
            return reason === undefined ? line : { ...line, problem: refusalText(reason) };
          });
        return left.length > 0 ? left : [blankLine(fresh)];
      });
    },
  };
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="text-sm font-bold text-muted">
      {children}
    </span>
  );
}

function CopiedNote({ line }: { line: BookLine }) {
  if (line.copiedFrom === null) return null;
  return <span className="text-xs text-muted">copied from line {line.copiedFrom}</span>;
}

function Suggestions(props: {
  line: BookLine;
  number: number;
  students: readonly ListedStudent[];
  onPick: (student: ListedStudent) => void;
}) {
  const found = studentsInRooms(props.students, props.line.room);
  if (props.line.room.trim() === '') {
    return <p className="py-2 text-muted">Type the room first.</p>;
  }
  if (found.length === 0) {
    return (
      <p className="py-2 text-muted">
        No Active Student in a room starting with {props.line.room}.
      </p>
    );
  }
  return (
    <ul
      aria-label={`Students for line ${String(props.number)}`}
      className="picker-results border-primary"
    >
      {found.map((student) => {
        const away = student.leaveState !== 'In hostel';
        return (
          <li key={student.studentId}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-3 px-3 text-left hover:bg-tint"
              aria-label={`${student.name}, room ${student.room}${away ? ', already Away' : ''}`}
              onClick={() => {
                props.onPick(student);
              }}
            >
              <span className="w-12 font-bold">{student.room}</span>
              <span className="flex-1 font-bold">{student.name}</span>
              {away && <span className="text-sm font-bold text-danger">Already Away</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function StudentCell(props: {
  line: BookLine;
  number: number;
  students: readonly ListedStudent[];
  onChange: (patch: Partial<BookLine>) => void;
}) {
  const { student } = props.line;
  if (student === null) {
    return (
      <Suggestions
        line={props.line}
        number={props.number}
        students={props.students}
        onPick={(picked) => {
          props.onChange({ student: picked, room: picked.room });
        }}
      />
    );
  }
  return (
    <span className="flex min-h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-line-strong bg-wash px-3">
      <span className="font-bold">{student.name}</span>
      <span className="text-sm text-muted">{student.studentId}</span>
      <button
        type="button"
        className="link-button ml-auto text-sm"
        aria-label={`Change the Student on line ${String(props.number)}`}
        onClick={() => {
          props.onChange({ student: null });
        }}
      >
        Change
      </button>
    </span>
  );
}

function OutCell(props: {
  line: BookLine;
  label: string;
  today: string;
  onChange: (patch: Partial<BookLine>) => void;
}) {
  const { line, label } = props;
  return (
    <div className="grid gap-1">
      <Caption>Out Time</Caption>
      <div className="flex gap-2">
        <select
          className="field w-auto"
          aria-label={`Out day, ${label}`}
          value={line.outDay}
          onChange={(event) => {
            props.onChange({ outDay: event.target.value as BookDay, copiedFrom: null });
          }}
        >
          {BOOK_DAYS.map((day) => (
            <option key={day}>{day}</option>
          ))}
        </select>
        <input
          className={timeClass}
          type="time"
          aria-label={`Out Time, ${label}`}
          value={line.outTime}
          onChange={(event) => {
            props.onChange({ outTime: event.target.value, copiedFrom: null });
          }}
        />
      </div>
      {line.outDay === 'Pick a date' && (
        <input
          className={dateClass}
          type="date"
          aria-label={`Out date, ${label}`}
          max={props.today}
          value={line.pickedOutDay}
          onChange={(event) => {
            props.onChange({ pickedOutDay: event.target.value });
          }}
        />
      )}
      <CopiedNote line={line} />
    </div>
  );
}

function ReturnCell(props: {
  line: BookLine;
  label: string;
  onChange: (patch: Partial<BookLine>) => void;
  onEnter: () => void;
}) {
  const { line, label } = props;
  const enterAddsLine = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    props.onEnter();
  };
  return (
    <div className="grid gap-1">
      <Caption>Expected Return</Caption>
      <div className="flex gap-2">
        <input
          className={dateClass}
          type="date"
          aria-label={`Expected Return date, ${label}`}
          value={line.expectedReturnDay}
          onChange={(event) => {
            props.onChange({ expectedReturnDay: event.target.value, copiedFrom: null });
          }}
        />
        <input
          className={timeClass}
          type="time"
          aria-label={`Expected Return time, ${label}`}
          value={line.expectedReturnTime}
          onKeyDown={enterAddsLine}
          onChange={(event) => {
            props.onChange({ expectedReturnTime: event.target.value, copiedFrom: null });
          }}
        />
      </div>
      <CopiedNote line={line} />
    </div>
  );
}

// Why a line cannot be saved: the Student is already Away, or the server refused it.
function LineProblem(props: { line: BookLine; onOpenReturns: (studentId: string) => void }) {
  const { line } = props;
  const { student } = line;
  if (student !== null && isAlreadyAway(line)) {
    const since = student.openLeave ? ` since ${inWords(student.openLeave.outAt)}` : '';
    return (
      <p role="alert" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-danger">
        <span>
          {student.name} is already Away{since}. Record that Return first, then this Leave.
        </span>
        <button
          type="button"
          className="link-button text-danger"
          onClick={() => {
            props.onOpenReturns(student.studentId);
          }}
        >
          Record Return for {student.name}
        </button>
      </p>
    );
  }
  if (line.problem === '') return null;
  return (
    <p role="alert" className="field-error">
      {line.problem}
    </p>
  );
}

function LineItem(props: {
  line: BookLine;
  number: number;
  students: readonly ListedStudent[];
  today: string;
  onChange: (patch: Partial<BookLine>) => void;
  onRemove: () => void;
  onEnter: () => void;
  onOpenReturns: (studentId: string) => void;
}) {
  const { line, number } = props;
  const label = `line ${String(number)}`;
  const hasProblem = isAlreadyAway(line) || line.problem !== '';
  return (
    <li
      className={`grid gap-3 border-t border-line px-4 py-4 md:px-6 ${hasProblem ? 'bg-danger-wash' : ''}`}
    >
      {/* Two rows, so a line fits any width: who left, then when. */}
      <div className="grid grid-cols-[1.5rem_5.5rem_minmax(0,1fr)_2.75rem] items-start gap-x-3 gap-y-4">
        <span className={`pt-8 font-bold ${hasProblem ? 'text-danger' : 'text-muted'}`}>
          {number}
        </span>
        <div className="grid gap-1">
          <Caption>Room</Caption>
          <input
            className={inputClass}
            inputMode="numeric"
            aria-label={`Room, ${label}`}
            value={line.room}
            onChange={(event) => {
              props.onChange({ room: event.target.value, student: null });
            }}
          />
        </div>
        <div className="grid min-w-0 gap-1">
          <Caption>Student</Caption>
          <StudentCell
            line={line}
            number={number}
            students={props.students}
            onChange={props.onChange}
          />
        </div>
        <button
          type="button"
          className="gear mt-6 border-[1.5px] border-line"
          aria-label={`Remove ${label}`}
          onClick={props.onRemove}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="col-start-2 col-end-4 flex flex-wrap gap-x-6 gap-y-3">
          <OutCell line={line} label={label} today={props.today} onChange={props.onChange} />
          <ReturnCell line={line} label={label} onChange={props.onChange} onEnter={props.onEnter} />
        </div>
      </div>
      <LineProblem line={line} onOpenReturns={props.onOpenReturns} />
    </li>
  );
}

function summaryOf(lines: readonly BookLine[]) {
  const ready = lines.filter(canSend).length;
  const needFix = lines.filter((line) => isAlreadyAway(line) || line.problem !== '').length;
  const notFinished = lines.length - ready - needFix;
  const parts = [`${plural(ready, 'line')} ready.`];
  if (needFix > 0) parts.push(`${plural(needFix, 'line')} need${needFix === 1 ? 's' : ''} a fix.`);
  if (notFinished > 0) {
    parts.push(`${plural(notFinished, 'line')} ${notFinished === 1 ? 'is' : 'are'} not finished.`);
  }
  return { ready, text: parts.join(' ') };
}

function savedNote(names: readonly string[]) {
  if (names.length === 0) return 'Nothing was saved. Each line below says why.';
  const are = names.length === 1 ? 'is' : 'are';
  return `Saved ${plural(names.length, 'Leave')}. ${namesInWords(names)} ${are} now Away.`;
}

// The Going-to-Home Book, copied one line per Student (FR-4b): room, Student, Out Time and
// Expected Return. Each line keeps its own times; a new line starts with the ones above it.
export function GoingToHomeBook(props: {
  students: readonly ListedStudent[];
  source: StudentSource;
  today: string;
  startStudents: readonly string[];
  onSaved: () => void;
  onOpenReturns: (studentId: string) => void;
}) {
  const book = useBookLines(() => firstLines(props.students, props.startStudents));
  const [note, setNote] = useState<{ saved: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const summary = summaryOf(book.lines);

  const save = async () => {
    const sendable = book.lines.filter(canSend);
    setSending(true);
    try {
      const answers = await props.source.recordLeaves(toLeaveRows(sendable, props.today));
      const done = new Set(answers.filter((a) => a.outcome === 'done').map((a) => a.studentId));
      const names = sendable
        .filter((line) => done.has(line.student?.studentId ?? ''))
        .map((line) => line.student?.name ?? '');
      book.settle(answers);
      setNote({ saved: names.length > 0, text: savedNote(names) });
      props.onSaved();
    } catch {
      setNote({
        saved: false,
        text: 'Nothing was saved. Check the server, then press Save again.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Lines from the Going-to-Home Book" className="book-card grid">
      <div className="grid gap-1 px-4 pt-5 pb-3 md:px-6">
        <h2 className="font-display text-2xl font-bold">One line for each Student in the book</h2>
        <p className="text-muted">
          Type the room, pick the Student, then check the times. Each new line copies the times from
          the line above, so a group that left together needs no retyping.
        </p>
      </div>
      {note && (
        <p
          role="status"
          className={`mx-4 mb-3 rounded-xl border px-4 py-3 font-bold md:mx-6 ${note.saved ? 'border-ok-line bg-ok-wash text-ok' : 'border-danger-line bg-danger-wash text-danger'}`}
        >
          {note.text}
        </p>
      )}
      <ol>
        {book.lines.map((line, index) => (
          <LineItem
            key={line.key}
            line={line}
            number={index + 1}
            students={props.students}
            today={props.today}
            onChange={(patch) => {
              book.change(line.key, patch);
            }}
            onRemove={() => {
              book.remove(line.key);
            }}
            onEnter={() => {
              if (index === book.lines.length - 1) book.add();
            }}
            onOpenReturns={props.onOpenReturns}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 md:px-6">
        <button type="button" className="btn-quiet border-dashed" onClick={book.add}>
          Add a line
        </button>
        <span className="text-sm text-muted">or press Enter in the last box</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-[20px] border-t border-line bg-wash px-4 py-4 md:px-6">
        <p>{summary.text}</p>
        <button
          type="button"
          className="btn min-h-13 px-7 text-lg"
          disabled={summary.ready === 0 || sending}
          onClick={() => void save()}
        >
          Save {plural(summary.ready, 'Leave')}
        </button>
      </div>
    </section>
  );
}
