import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { Book } from './LeavesPage.js';
import { LeaveStateLabel } from './LeaveStatus.js';
import { DETAIL_FIELDS, errorsFor, FieldInputs } from './student-fields.js';
import type { FieldSpec } from './student-fields.js';
import { GROUPS, groupCounts, SORTS, ticked, visibleStudents } from './student-list.js';
import type { Group, ListChoices, StudentSort } from './student-list.js';
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

function Toolbar(props: {
  students: readonly ListedStudent[];
  choices: ListChoices;
  onChoices: (change: Partial<ListChoices>) => void;
}) {
  const { choices } = props;
  const counts = groupCounts(props.students);
  const floors = [...new Set(props.students.map((s) => s.floor))].sort((a, b) => a - b);
  return (
    <section
      aria-label="Find and filter"
      className="book-card flex flex-wrap items-end gap-x-4 gap-y-3 p-4"
    >
      <label className="grid flex-[2_1_18rem] gap-1 text-sm font-bold text-muted">
        Search by name, Student ID or room
        <input
          className="field w-full font-normal"
          type="search"
          value={choices.search}
          onChange={(event) => {
            props.onChoices({ search: event.target.value });
          }}
        />
      </label>
      <div role="group" aria-label="Show" className="flex flex-[3_1_26rem] flex-wrap gap-2">
        {GROUPS.map((group) => {
          const isOn = group === choices.group;
          return (
            <button
              key={group}
              type="button"
              aria-pressed={isOn}
              onClick={() => {
                props.onChoices({ group });
              }}
              className={`min-h-11 rounded-full border-[1.5px] px-3.5 font-bold ${isOn ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:border-primary'}`}
            >
              {group}{' '}
              <span className={`font-normal ${isOn ? 'text-on-primary-muted' : 'text-muted'}`}>
                {counts[group]}
              </span>
            </button>
          );
        })}
      </div>
      <label className="grid gap-1 text-sm font-bold text-muted">
        Floor
        <select
          className="field font-normal"
          value={choices.floor === null ? '' : String(choices.floor)}
          onChange={(event) => {
            props.onChoices({
              floor: event.target.value === '' ? null : Number(event.target.value),
            });
          }}
        >
          <option value="">All floors</option>
          {floors.map((floor) => (
            <option key={floor} value={String(floor)}>
              Floor {floor}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold text-muted">
        Sort by
        <select
          className="field font-normal"
          value={choices.sort}
          onChange={(event) => {
            props.onChoices({ sort: event.target.value as StudentSort });
          }}
        >
          {SORTS.map((sort) => (
            <option key={sort}>{sort}</option>
          ))}
        </select>
      </label>
    </section>
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
    <tr className={props.isOpen ? 'bg-tint' : props.isTicked ? 'bg-wash' : ''}>
      <td>
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          aria-label={`Tick ${student.name}`}
          checked={props.isTicked}
          onChange={props.onTick}
        />
      </td>
      <td className="font-bold">{student.room}</td>
      <td>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            className="text-left font-bold hover:text-primary hover:underline"
            onClick={props.onOpen}
          >
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

function StudentList(props: {
  students: readonly ListedStudent[];
  openId: string | null;
  onOpen: (studentId: string) => void;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const [choices, setChoices] = useState<ListChoices>({
    group: 'All Active',
    search: '',
    floor: null,
    sort: 'Room',
  });
  const ticks = useTicks();
  const rows = visibleStudents(props.students, choices);
  const total = visibleStudents(props.students, { ...choices, search: '', floor: null }).length;
  return (
    <div className="grid min-w-0 gap-4">
      <Toolbar
        students={props.students}
        choices={choices}
        onChoices={(change) => {
          setChoices((old) => ({ ...old, ...change }));
        }}
      />
      <section aria-label="Students" className="book-card grid">
        {ticks.ids.size > 0 && (
          <TickBar
            students={props.students}
            ids={ticks.ids}
            onOpenLeaves={props.onOpenLeaves}
            onClear={ticks.clear}
          />
        )}
        <p className="px-4 pt-3 pb-2 text-sm text-muted">
          {countText(rows.length, total, choices)}
        </p>
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

function Heading(props: { students: ListedStudent[] | null; adding: boolean; onAdd: () => void }) {
  const { students } = props;
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[2.75rem] leading-tight font-extrabold tracking-tight">
          Students
        </h1>
        {students && students.length > 0 && <p className="text-muted">{summaryOf(students)}</p>}
      </div>
      <button className="btn min-h-12" type="button" onClick={props.onAdd}>
        {props.adding ? 'Close the form' : 'Add a Student'}
      </button>
    </div>
  );
}

// Beside the list: Add a Student, or the chosen Student's panel, or nothing.
function SidePanel(props: {
  adding: boolean;
  open: ListedStudent | null;
  source: StudentSource;
  today: string;
  onAdded: (name: string) => void;
  onSaved: () => void;
  onActiveChange: (student: ListedStudent, change: ActiveChange) => Promise<void>;
  onClose: () => void;
}) {
  const { open } = props;
  if (!props.adding && open === null) return null;
  return (
    <aside className="min-w-0 flex-[2_1_22rem]">
      {open === null ? (
        <AddStudentForm source={props.source} onAdded={props.onAdded} />
      ) : (
        <StudentPanel
          key={open.studentId}
          student={open}
          source={props.source}
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
  openId: string | null;
  onOpen: (studentId: string) => void;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const { students } = props;
  if (students === null) return null;
  if (students.length === 0) {
    return (
      <section className="report-card">
        <p className="text-muted">No Students yet. Use Add a Student to enter the first one.</p>
      </section>
    );
  }
  return (
    <StudentList
      students={students}
      openId={props.openId}
      onOpen={props.onOpen}
      onOpenLeaves={props.onOpenLeaves}
    />
  );
}

// The Students page: find, filter and tick Students; one Student's Leave, Details and
// Deactivate in the panel beside the list; Add a Student in the same place.
export function StudentsPage(props: {
  source: StudentSource;
  today?: string;
  onOpenLeaves?: OpenLeaves | undefined;
}) {
  const { source } = props;
  const { students, failed, refresh } = useStudents(source);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
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
      <div className="flex flex-wrap items-start gap-5">
        <div className="min-w-0 flex-[3_1_40rem]">
          <ListArea
            students={students}
            openId={openId}
            onOpen={(studentId) => {
              setOpenId(studentId);
              setAdding(false);
            }}
            onOpenLeaves={props.onOpenLeaves}
          />
        </div>
        <SidePanel
          adding={adding}
          open={open}
          source={source}
          today={props.today ?? istToday()}
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
      </div>
    </div>
  );
}
