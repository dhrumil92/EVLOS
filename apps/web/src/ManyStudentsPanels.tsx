import { useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { LeaveStateLabel, refusalText } from './LeaveStatus.js';
import type { ListedStudent, RowAnswer, StudentSource } from './student-source.js';

// One chosen Student. ownDate is set when his dates differ from the ones at the top.
interface Row<Times> {
  student: ListedStudent;
  times: Times;
  ownDate: boolean;
  problem: string;
}

interface PanelProps {
  students: readonly ListedStudent[];
  source: StudentSource;
  today: string;
  onDone: () => void;
}

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;

function useRows<Times>(blank: Times) {
  const [rows, setRows] = useState<Row<Times>[]>([]);
  const update = (studentId: string, change: (row: Row<Times>) => Row<Times>) => {
    setRows((old) => old.map((row) => (row.student.studentId === studentId ? change(row) : row)));
  };
  return {
    rows,
    add: (student: ListedStudent) => {
      setRows((old) => [...old, { student, times: { ...blank }, ownDate: false, problem: '' }]);
    },
    remove: (studentId: string) => {
      setRows((old) => old.filter((row) => row.student.studentId !== studentId));
    },
    setTimes: (studentId: string, times: Partial<Times>) => {
      update(studentId, (row) => ({ ...row, times: { ...row.times, ...times } }));
    },
    keepOwnDate: (studentId: string) => {
      update(studentId, (row) => ({ ...row, ownDate: true }));
    },
    // Saved rows leave the panel; a refused row stays, showing why (FR-4: only that row is blocked).
    settle: (answers: readonly RowAnswer[]) => {
      const refused = new Map(
        answers.filter((a) => a.outcome === 'refused').map((a) => [a.studentId, a.reason ?? '']),
      );
      const saved = new Set(answers.filter((a) => a.outcome === 'done').map((a) => a.studentId));
      setRows((old) =>
        old
          .filter((row) => !saved.has(row.student.studentId))
          .map((row) => {
            const reason = refused.get(row.student.studentId);
            return reason === undefined ? row : { ...row, problem: refusalText(reason) };
          }),
      );
      return { saved: saved.size, refused: refused.size };
    },
  };
}

function StudentPicker(props: {
  students: readonly ListedStudent[];
  chosen: readonly Row<unknown>[];
  onAdd: (student: ListedStudent) => void;
}) {
  const [search, setSearch] = useState('');
  const matches = useMemo(() => {
    const wanted = search.trim().toLowerCase();
    if (wanted === '') return [];
    const chosenIds = new Set(props.chosen.map((row) => row.student.studentId));
    return props.students
      .filter((s) => s.isActive && !chosenIds.has(s.studentId))
      .filter((s) => `${s.name} ${s.studentId} ${s.room}`.toLowerCase().includes(wanted))
      .slice(0, 8);
  }, [props.students, props.chosen, search]);

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-mist">
        Find a Student by name, Student ID or room
        <input
          className="field"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </label>
      {matches.length > 0 && (
        <ul className="picker-results">
          {matches.map((student) => (
            <li key={student.studentId}>
              <span>
                {student.name} <span className="text-mist">room {student.room}</span>
              </span>
              {student.leaveState !== 'In hostel' && <LeaveStateLabel state={student.leaveState} />}
              <button
                className="btn-quiet"
                type="button"
                aria-label={`Add ${student.name}`}
                onClick={() => {
                  props.onAdd(student);
                }}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  type: 'date' | 'time';
  value: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-mist">
      {props.label}
      <input
        className="field"
        type={props.type}
        required
        max={props.max}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </label>
  );
}

function RowFrame(props: {
  row: Row<unknown>;
  skipped: string | null;
  onOwnDate: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { student } = props.row;
  return (
    <li className="many-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{student.name}</span>
        <span className="text-mist">room {student.room}</span>
        <button
          className="link-button ml-auto"
          type="button"
          aria-label={`Remove ${student.name}`}
          onClick={props.onRemove}
        >
          Remove
        </button>
      </div>
      {props.skipped ? (
        <p className="text-mist">{props.skipped}</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          {props.children}
          {!props.row.ownDate && (
            <button
              className="link-button"
              type="button"
              aria-label={`Change date for ${student.name}`}
              onClick={props.onOwnDate}
            >
              Change date
            </button>
          )}
        </div>
      )}
      {props.row.problem && <p className="field-error">{props.row.problem}</p>}
    </li>
  );
}

function PanelFrame(props: {
  title: string;
  top: ReactNode;
  picker: ReactNode;
  rows: ReactNode;
  summary: string;
  button: string;
  canSend: boolean;
  note: string;
  onSend: () => Promise<void>;
}) {
  const send = (event: SyntheticEvent) => {
    event.preventDefault();
    void props.onSend();
  };
  return (
    <form className="report-card grid gap-4" noValidate aria-label={props.title} onSubmit={send}>
      <h2 className="font-display text-2xl font-semibold">{props.title}</h2>
      <div className="flex flex-wrap gap-3">{props.top}</div>
      {props.picker}
      <ul className="grid gap-2">{props.rows}</ul>
      {props.summary && <p>{props.summary}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" type="submit" disabled={!props.canSend}>
          {props.button}
        </button>
        {props.note && <span role="status">{props.note}</span>}
      </div>
    </form>
  );
}

function resultNote(noun: string, counts: { saved: number; refused: number }) {
  const fix =
    counts.refused === 0
      ? ''
      : ` ${plural(counts.refused, 'row')} need${counts.refused === 1 ? 's' : ''} a fix.`;
  return `Recorded ${plural(counts.saved, noun)}.${fix}`;
}

function summaryText(sent: number, skipped: number, willBe: string, skippedAs: string) {
  if (sent + skipped === 0) return '';
  const skip =
    skipped === 0
      ? ''
      : ` ${String(skipped)} ${skipped === 1 ? 'is' : 'are'} ${skippedAs} and will be skipped.`;
  return `${plural(sent, 'Student')} will be ${willBe}.${skip}`;
}

interface LeaveTimes {
  outTime: string;
  expectedReturnTime: string;
  outDay: string;
  expectedReturnDay: string;
}

// Leave for many Students (FR-4b): dates once at the top, two times on each row.
export function ManyLeavesPanel(props: PanelProps) {
  const [outDay, setOutDay] = useState(props.today);
  const [expectedReturnDay, setExpectedReturnDay] = useState(props.today);
  const [note, setNote] = useState('');
  const blank: LeaveTimes = {
    outTime: '',
    expectedReturnTime: '',
    outDay: '',
    expectedReturnDay: '',
  };
  const rows = useRows(blank);
  const isSkipped = (row: Row<LeaveTimes>) => row.student.leaveState !== 'In hostel';
  const toSend = rows.rows.filter((row) => !isSkipped(row));

  const send = async () => {
    try {
      const answers = await props.source.recordLeaves(
        toSend.map(({ student, times, ownDate }) => ({
          studentId: student.studentId,
          outDay: ownDate ? times.outDay : outDay,
          outTime: times.outTime,
          expectedReturnDay: ownDate ? times.expectedReturnDay : expectedReturnDay,
          expectedReturnTime: times.expectedReturnTime,
        })),
      );
      setNote(resultNote('Leave', rows.settle(answers)));
      props.onDone();
    } catch {
      setNote('Nothing was saved. Check the server.');
    }
  };

  return (
    <PanelFrame
      title="Leave for many Students"
      top={
        <>
          <Field
            label="Out date"
            type="date"
            value={outDay}
            max={props.today}
            onChange={setOutDay}
          />
          <Field
            label="Expected Return date"
            type="date"
            value={expectedReturnDay}
            onChange={setExpectedReturnDay}
          />
        </>
      }
      picker={<StudentPicker students={props.students} chosen={rows.rows} onAdd={rows.add} />}
      rows={rows.rows.map((row) => {
        const { name, studentId } = row.student;
        const set = (field: keyof LeaveTimes) => (value: string) => {
          rows.setTimes(studentId, { [field]: value });
        };
        return (
          <RowFrame
            key={studentId}
            row={row}
            skipped={isSkipped(row) ? 'Already Away, will be skipped' : null}
            onOwnDate={() => {
              rows.setTimes(studentId, { outDay, expectedReturnDay });
              rows.keepOwnDate(studentId);
            }}
            onRemove={() => {
              rows.remove(studentId);
            }}
          >
            {row.ownDate && (
              <Field
                label={`Out date for ${name}`}
                type="date"
                value={row.times.outDay}
                max={props.today}
                onChange={set('outDay')}
              />
            )}
            <Field
              label={`Out time for ${name}`}
              type="time"
              value={row.times.outTime}
              onChange={set('outTime')}
            />
            {row.ownDate && (
              <Field
                label={`Expected Return date for ${name}`}
                type="date"
                value={row.times.expectedReturnDay}
                onChange={set('expectedReturnDay')}
              />
            )}
            <Field
              label={`Expected Return time for ${name}`}
              type="time"
              value={row.times.expectedReturnTime}
              onChange={set('expectedReturnTime')}
            />
          </RowFrame>
        );
      })}
      summary={summaryText(toSend.length, rows.rows.length - toSend.length, 'Away', 'already Away')}
      button={`Record ${plural(toSend.length, 'Leave')}`}
      canSend={toSend.length > 0}
      note={note}
      onSend={send}
    />
  );
}

interface ReturnTimes {
  returnTime: string;
  returnDay: string;
}

// Return for many Students (FR-5): the Return date once at the top, a time on each row.
export function ManyReturnsPanel(props: PanelProps) {
  const [returnDay, setReturnDay] = useState(props.today);
  const [note, setNote] = useState('');
  const rows = useRows<ReturnTimes>({ returnTime: '', returnDay: '' });
  const isSkipped = (row: Row<ReturnTimes>) => row.student.leaveState === 'In hostel';
  const toSend = rows.rows.filter((row) => !isSkipped(row));

  const send = async () => {
    try {
      const answers = await props.source.returnLeaves(
        toSend.map(({ student, times, ownDate }) => ({
          studentId: student.studentId,
          returnDay: ownDate ? times.returnDay : returnDay,
          returnTime: times.returnTime,
        })),
      );
      setNote(resultNote('Return', rows.settle(answers)));
      props.onDone();
    } catch {
      setNote('Nothing was saved. Check the server.');
    }
  };

  return (
    <PanelFrame
      title="Return for many Students"
      top={
        <Field
          label="Return date"
          type="date"
          value={returnDay}
          max={props.today}
          onChange={setReturnDay}
        />
      }
      picker={<StudentPicker students={props.students} chosen={rows.rows} onAdd={rows.add} />}
      rows={rows.rows.map((row) => {
        const { name, studentId } = row.student;
        return (
          <RowFrame
            key={studentId}
            row={row}
            skipped={isSkipped(row) ? 'Not Away, will be skipped' : null}
            onOwnDate={() => {
              rows.setTimes(studentId, { returnDay });
              rows.keepOwnDate(studentId);
            }}
            onRemove={() => {
              rows.remove(studentId);
            }}
          >
            {row.ownDate && (
              <Field
                label={`Return date for ${name}`}
                type="date"
                value={row.times.returnDay}
                max={props.today}
                onChange={(value) => {
                  rows.setTimes(studentId, { returnDay: value });
                }}
              />
            )}
            <Field
              label={`Return time for ${name}`}
              type="time"
              value={row.times.returnTime}
              onChange={(value) => {
                rows.setTimes(studentId, { returnTime: value });
              }}
            />
          </RowFrame>
        );
      })}
      summary={summaryText(
        toSend.length,
        rows.rows.length - toSend.length,
        'back in hostel',
        'not Away',
      )}
      button={`Record ${plural(toSend.length, 'Return')}`}
      canSend={toSend.length > 0}
      note={note}
      onSend={send}
    />
  );
}

const TOOLS = ['Leave for many Students', 'Return for many Students'] as const;

// The two buttons that open a many-Students panel, on the Leaves page and the Student list.
export function ManyStudentsTools(props: PanelProps) {
  const [open, setOpen] = useState<(typeof TOOLS)[number] | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        {TOOLS.map((tool) => (
          <button
            key={tool}
            className={open === tool ? 'btn' : 'btn-quiet'}
            type="button"
            aria-pressed={open === tool}
            onClick={() => {
              setOpen((old) => (old === tool ? null : tool));
            }}
          >
            {tool}
          </button>
        ))}
      </div>
      {open === 'Leave for many Students' && <ManyLeavesPanel {...props} />}
      {open === 'Return for many Students' && <ManyReturnsPanel {...props} />}
    </div>
  );
}
