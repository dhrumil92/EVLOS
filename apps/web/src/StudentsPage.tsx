import { useEffect, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import type { Book } from './LeavesPage.js';
import { LeaveStateLabel } from './LeaveStatus.js';
import { PresenceMenu } from './PresenceMenu.js';
import { DETAIL_FIELDS, errorsFor, FieldInputs } from './student-fields.js';
import type { FieldSpec } from './student-fields.js';
import { StudentMenus } from './StudentMenus.js';
import { ticked, visibleStudents } from './student-list.js';
import type { Group, ListChoices } from './student-list.js';
import type { ReportSource } from './report-source.js';
import { StudentPanel } from './StudentPanel.js';
import type { ActiveChange } from './StudentPanel.js';
import type { AddResult, ListedStudent, StudentForm, StudentSource } from './student-source.js';
import { useStudents } from './use-students.js';

const EMPTY_FORM: StudentForm = { studentId: '', name: '', room: '', email: '', phone: '' };
const FORM_FIELDS: FieldSpec<keyof StudentForm>[] = [
  { name: 'studentId', label: 'Student ID' },
  ...DETAIL_FIELDS,
];
const DONE: Record<ActiveChange, string> = { Deactivate: 'Deactivated', Activate: 'Activated' };
// The longest list shown at once; the rest is one press away.
const PAGE_SIZE = 50;
const GROUP_WORDS: Record<Group, string> = {
  'All Active': 'Active Students',
  'In hostel': 'Students in hostel',
  Away: 'Away Students',
  'Due Back': 'Due Back Students',
  Deactivated: 'Deactivated Students',
};
const GROUP_EMPTY: Record<Group, string> = {
  'All Active': 'No Student is Active.',
  'In hostel': 'No Student is in hostel.',
  Away: 'No Student is Away.',
  'Due Back': 'No Student is Due Back.',
  Deactivated: 'No Student is Deactivated.',
};

const START_CHOICES: ListChoices = { group: 'All Active', search: '', floor: null, sort: 'Room' };

type OpenLeaves = (book: Book, students: readonly string[]) => void;

const plural = (count: number, word: string) => `${String(count)} ${word}${count === 1 ? '' : 's'}`;
const istToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now());

function errorsFrom(result: AddResult, form: StudentForm): Record<string, string> {
  if (result.outcome === 'student-id-used') {
    return {
      studentId: `Student ID ${form.studentId} is already used. A Student ID is never reused.`,
    };
  }
  return result.outcome === 'invalid' ? errorsFor(result.fields) : {};
}

function AddStudentForm(props: { source: StudentSource; onAdded: (name: string) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    try {
      const result = await props.source.add(form);
      setFailed(false);
      setErrors(errorsFrom(result, form));
      if (result.outcome === 'added') {
        setForm(EMPTY_FORM);
        props.onAdded(result.student.name);
      }
    } catch {
      setFailed(true);
    }
  };

  return (
    <form
      className="book-card grid gap-3 p-5"
      aria-label="Add a Student"
      noValidate
      onSubmit={(event) => void save(event)}
    >
      <h2 className="font-display text-2xl font-bold">Add a Student</h2>
      <FieldInputs
        fields={FORM_FIELDS}
        values={form}
        errors={errors}
        onChange={(name, value) => {
          setForm((old) => ({ ...old, [name]: value }));
        }}
      />
      {failed && <p className="field-error">The Student was not saved. Check the server.</p>}
      <div>
        <button className="btn" type="submit">
          Save Student
        </button>
      </div>
    </form>
  );
}

function TickBar(props: {
  students: readonly ListedStudent[];
  ids: ReadonlySet<string>;
  onOpenLeaves?: OpenLeaves | undefined;
  onClear: () => void;
}) {
  const { canLeave, canReturn } = ticked(props.students, props.ids);
  const open = (book: Book, chosen: readonly ListedStudent[]) => () => {
    props.onOpenLeaves?.(
      book,
      chosen.map((s) => s.studentId),
    );
  };
  const barButton =
    'min-h-11 rounded-[10px] border-[1.5px] px-4 font-bold disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <div
      role="region"
      aria-label="Ticked Students"
      className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-t-[20px] bg-primary px-4 py-3 text-white"
    >
      <span className="flex-1 font-bold">{plural(props.ids.size, 'Student')} ticked</span>
      <button
        type="button"
        className={`${barButton} border-white bg-white text-primary`}
        disabled={canReturn.length === 0}
        onClick={open('Back-from-Home Book', canReturn)}
      >
        Record Return for {canReturn.length}
      </button>
      <button
        type="button"
        className={`${barButton} border-on-primary-line bg-transparent text-white`}
        disabled={canLeave.length === 0}
        onClick={open('Going-to-Home Book', canLeave)}
      >
        Record Leave for {canLeave.length}
      </button>
      <button
        type="button"
        className="min-h-11 px-2 text-on-primary-muted underline"
        onClick={props.onClear}
      >
        Clear
      </button>
    </div>
  );
}

function StudentRow(props: {
  student: ListedStudent;
  isTicked: boolean;
  isOpen: boolean;
  onTick: () => void;
  onOpen: () => void;
}) {
  const { student } = props;
  return (
    <tr
      className={`cursor-pointer ${props.isOpen ? 'bg-selected' : `hover:bg-tint ${props.isTicked ? 'bg-wash' : ''}`}`}
      onClick={props.onOpen}
    >
      <td>
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          aria-label={`Tick ${student.name}`}
          checked={props.isTicked}
          onChange={props.onTick}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
      </td>
      <td className="font-bold">{student.room}</td>
      <td>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button type="button" className="text-left font-bold">
            {student.name}
          </button>
          {student.isActive && student.leaveState !== 'In hostel' && (
            <LeaveStateLabel state={student.leaveState} />
          )}
          {!student.isActive && <span className="status status-not-applicable">Deactivated</span>}
        </span>
        <span className="text-sm text-muted">Student ID {student.studentId}</span>
      </td>
      <td className="max-w-[16rem] truncate text-muted">{student.email}</td>
      <td className="whitespace-nowrap text-muted">{student.phone ?? '–'}</td>
    </tr>
  );
}

function countText(shown: number, total: number, choices: ListChoices) {
  const onFloor = choices.floor === null ? '' : ` on floor ${String(choices.floor)}`;
  return `Showing ${String(shown)} of ${String(total)} ${GROUP_WORDS[choices.group]}${onFloor}`;
}

function emptyText(choices: ListChoices) {
  if (choices.search.trim() !== '') return 'No Student matches this search.';
  if (choices.floor !== null) return `No Student is on floor ${String(choices.floor)}.`;
  return GROUP_EMPTY[choices.group];
}

function StudentTable(props: {
  rows: readonly ListedStudent[];
  ids: ReadonlySet<string>;
  openId: string | null;
  onTick: (ids: readonly string[], on: boolean) => void;
  onOpen: (studentId: string) => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = props.rows.slice(0, limit);
  const allTicked = shown.length > 0 && shown.every((s) => props.ids.has(s.studentId));
  return (
    <>
      <div className="overflow-x-auto">
        <table className="student-table min-w-[44rem]" aria-label="Student list">
          <thead>
            <tr>
              <th className="w-12">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-primary"
                  aria-label="Tick every Student shown"
                  checked={allTicked}
                  onChange={() => {
                    props.onTick(
                      shown.map((s) => s.studentId),
                      !allTicked,
                    );
                  }}
                />
              </th>
              <th className="w-20">Room</th>
              <th>Student</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((student) => (
              <StudentRow
                key={student.studentId}
                student={student}
                isTicked={props.ids.has(student.studentId)}
                isOpen={props.openId === student.studentId}
                onTick={() => {
                  props.onTick([student.studentId], !props.ids.has(student.studentId));
                }}
                onOpen={() => {
                  props.onOpen(student.studentId);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
      {props.rows.length > limit && (
        <div className="border-t border-line px-4 py-3">
          <button
            className="btn-quiet"
            type="button"
            onClick={() => {
              setLimit((old) => old + PAGE_SIZE);
            }}
          >
            Show {Math.min(PAGE_SIZE, props.rows.length - limit)} more
          </button>
        </div>
      )}
    </>
  );
}

function useTicks() {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  return {
    ids,
    tick: (changed: readonly string[], on: boolean) => {
      setIds((old) => {
        const next = new Set(old);
        for (const id of changed) {
          if (on) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    clear: () => {
      setIds(new Set());
    },
  };
}

// The list, with its search box, beside the side panel. The filters and sort are in the heading.
function StudentList(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
  openId: string | null;
  side: ReactNode;
  onOpen: (studentId: string) => void;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const { choices } = props;
  const ticks = useTicks();
  const rows = visibleStudents(props.students, choices);
  const total = visibleStudents(props.students, { ...choices, search: '', floor: null }).length;
  return (
    <div className="flex flex-wrap items-start gap-5">
      <section aria-label="Students" className="book-card grid min-w-0 flex-[3_1_40rem]">
        {ticks.ids.size > 0 && (
          <TickBar
            students={props.students}
            ids={ticks.ids}
            onOpenLeaves={props.onOpenLeaves}
            onClear={ticks.clear}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 pt-3 pb-2">
          <p className="text-sm text-muted">{countText(rows.length, total, choices)}</p>
          <input
            className="field w-full sm:w-72"
            type="search"
            aria-label="Search by name, Student ID or room"
            placeholder="Find by name, Student ID or room"
            value={choices.search}
            onChange={(event) => {
              props.onChoices({ search: event.target.value });
            }}
          />
        </div>
        {rows.length === 0 ? (
          <p className="px-4 pb-4 text-muted">{emptyText(choices)}</p>
        ) : (
          <StudentTable
            rows={rows}
            ids={ticks.ids}
            openId={props.openId}
            onTick={ticks.tick}
            onOpen={props.onOpen}
          />
        )}
      </section>
      {props.side}
    </div>
  );
}

function summaryOf(students: readonly ListedStudent[]) {
  const active = students.filter((s) => s.isActive);
  const rooms = new Set(active.map((s) => s.room)).size;
  const gone = students.length - active.length;
  const deactivated =
    gone === 0 ? '' : ` ${String(gone)} ${gone === 1 ? 'is' : 'are'} Deactivated.`;
  return `${plural(active.length, 'Active Student')} in ${plural(rooms, 'room')}.${deactivated}`;
}

function Heading(props: {
  students: ListedStudent[] | null;
  today: string;
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
  adding: boolean;
  onAdd: () => void;
}) {
  const { students } = props;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
          Students
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {students && students.length > 0 && (
            <>
              <StudentMenus
                students={students}
                choices={props.choices}
                onChoices={props.onChoices}
              />
              <PresenceMenu today={props.today} />
            </>
          )}
          <button className="btn min-h-12" type="button" onClick={props.onAdd}>
            {props.adding ? 'Close the form' : 'Add a Student'}
          </button>
        </div>
      </div>
      {students && students.length > 0 && <p className="text-muted">{summaryOf(students)}</p>}
    </div>
  );
}

// The panel's place before a name is pressed, so the page keeps its two columns.
function ChooseAStudent() {
  return (
    <section
      aria-label="Choose a Student"
      className="grid justify-items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-line-strong bg-surface px-6 py-10 text-center"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint text-primary"
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </svg>
      </span>
      <h2 className="font-display text-xl font-bold">Choose a Student</h2>
      <p className="max-w-[32ch] text-muted">
        Press a Student's name in the list to see the month, Leave, Details and Deactivate here.
      </p>
    </section>
  );
}

// Beside the list, always: Add a Student, the chosen Student's panel, or where it will appear.
// Where the page is one column, as on a phone, a form or panel that is open goes above the
// list and the page scrolls to it, so the Rector does not have to scroll to the end to find it.
// The page puts the panel beside the list from 1044px wide (the two widths of the columns, their
// gap and the page margins), so the order is only changed below that.
function SidePanel(props: {
  adding: boolean;
  open: ListedStudent | null;
  source: StudentSource;
  reports: ReportSource;
  today: string;
  onAdded: (name: string) => void;
  onSaved: () => void;
  onActiveChange: (student: ListedStudent, change: ActiveChange) => Promise<void>;
  onClose: () => void;
}) {
  const { open } = props;
  const place = useRef<HTMLElement>(null);
  const isShown = props.adding || open !== null;
  const shownId = open?.studentId ?? null;
  useEffect(() => {
    if (isShown) place.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isShown, shownId]);
  const empty = props.adding ? (
    <AddStudentForm source={props.source} onAdded={props.onAdded} />
  ) : (
    <ChooseAStudent />
  );
  return (
    <aside
      ref={place}
      className={`min-w-0 flex-[2_1_22rem] scroll-mt-16 ${isShown ? 'order-first min-[1044px]:order-none' : ''}`}
    >
      {open === null ? (
        empty
      ) : (
        <StudentPanel
          key={open.studentId}
          student={open}
          source={props.source}
          reports={props.reports}
          today={props.today}
          onSaved={props.onSaved}
          onActiveChange={(change) => props.onActiveChange(open, change)}
          onClose={props.onClose}
        />
      )}
    </aside>
  );
}

function ListArea(props: {
  students: ListedStudent[] | null;
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
  openId: string | null;
  side: ReactNode;
  onOpen: (studentId: string) => void;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const { students } = props;
  if (students === null) return null;
  if (students.length === 0) {
    return (
      <div className="flex flex-wrap items-start gap-5">
        <section className="report-card min-w-0 flex-[3_1_40rem]">
          <p className="text-muted">No Students yet. Use Add a Student to enter the first one.</p>
        </section>
        {props.side}
      </div>
    );
  }
  return (
    <StudentList
      students={students}
      choices={props.choices}
      onChoices={props.onChoices}
      openId={props.openId}
      side={props.side}
      onOpen={props.onOpen}
      onOpenLeaves={props.onOpenLeaves}
    />
  );
}

// The Students page: filter, sort, find and tick Students; one Student's Leave, Details and
// Deactivate, and their month, in the panel beside the list; Add a Student in the same place.
export function StudentsPage(props: {
  source: StudentSource;
  reports: ReportSource;
  today?: string;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const { source } = props;
  const { students, failed, refresh } = useStudents(source);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [choices, setChoices] = useState(START_CHOICES);
  const change = (changed: Partial<ListChoices>) => {
    setChoices((old) => ({ ...old, ...changed }));
  };
  const today = props.today ?? istToday();
  const open = adding ? null : (students?.find((s) => s.studentId === openId) ?? null);

  const changeActive = async (student: ListedStudent, change: ActiveChange) => {
    await (change === 'Deactivate'
      ? source.deactivate(student.studentId)
      : source.activate(student.studentId));
    setMessage(`${DONE[change]} ${student.name}.`);
    await refresh();
  };

  return (
    <div className="grid gap-5">
      <Heading
        students={students}
        today={today}
        choices={choices}
        onChoices={change}
        adding={adding}
        onAdd={() => {
          setAdding((old) => !old);
          setOpenId(null);
        }}
      />
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {failed && (
        <p className="notice">
          The Students page cannot reach the EVLOS server. Start it with npm run dev, then reload
          this page.
        </p>
      )}
      <ListArea
        students={students}
        choices={choices}
        onChoices={change}
        openId={openId}
        onOpen={(studentId) => {
          setOpenId(studentId);
          setAdding(false);
        }}
        onOpenLeaves={props.onOpenLeaves}
        side={
          <SidePanel
            adding={adding}
            open={open}
            source={source}
            reports={props.reports}
            today={today}
            onAdded={(name) => {
              setMessage(`Added ${name}.`);
              void refresh();
            }}
            onSaved={() => void refresh()}
            onActiveChange={changeActive}
            onClose={() => {
              setOpenId(null);
            }}
          />
        }
      />
    </div>
  );
}
