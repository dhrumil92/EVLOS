import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { LeaveStateLabel } from './LeaveStatus.js';
import { ManyStudentsTools } from './ManyStudentsPanels.js';
import { byName, byRoom } from './report-rows.js';
import { StudentFilter } from './StudentFilter.js';
import type { StudentSort } from './StudentFilter.js';
import { DETAIL_FIELDS, errorsFor, FieldInputs } from './student-fields.js';
import type { FieldSpec } from './student-fields.js';
import type { AddResult, ListedStudent, StudentForm, StudentSource } from './student-source.js';
import { StudentSettings } from './StudentSettings.js';
import type { ActiveChange } from './StudentSettings.js';

const EMPTY_FORM: StudentForm = { studentId: '', name: '', room: '', email: '', phone: '' };
const FORM_FIELDS: FieldSpec<keyof StudentForm>[] = [
  { name: 'studentId', label: 'Student ID' },
  ...DETAIL_FIELDS,
];

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
    <form className="report-card grid gap-3" noValidate onSubmit={(event) => void save(event)}>
      <h2 className="font-display text-2xl font-semibold">Add a Student</h2>
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

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  );
}

interface TableProps {
  rows: ListedStudent[];
  openId: string | null;
  onToggle: (studentId: string) => void;
  settingsFor: (student: ListedStudent) => ReactNode;
}

function StudentRow({
  student,
  isOpen,
  onToggle,
}: {
  student: ListedStudent;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={`${isOpen ? 'row-open' : ''} ${student.isActive ? '' : 'row-deactivated'}`}>
      <td>{student.room}</td>
      <td className="font-semibold">
        <span>{student.name}</span>
        {student.leaveState !== 'In hostel' && (
          <span className="ml-2">
            <LeaveStateLabel state={student.leaveState} />
          </span>
        )}
        {!student.isActive && (
          <span className="status status-not-applicable ml-2">Deactivated</span>
        )}
      </td>
      <td>{student.studentId}</td>
      <td>{student.email}</td>
      <td>{student.phone ?? '–'}</td>
      <td className="text-right">
        <button
          className="gear"
          type="button"
          aria-label={`Settings for ${student.name}`}
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <GearIcon />
        </button>
      </td>
    </tr>
  );
}

function StudentTable({ rows, openId, onToggle, settingsFor }: TableProps) {
  return (
    <div className="student-scroll" tabIndex={0} aria-label="Student list, scrolls">
      <table className="student-table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Student</th>
            <th>Student ID</th>
            <th>Email</th>
            <th>Phone</th>
            <th>
              <span className="sr-only">Settings</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((student) => (
            <Fragment key={student.studentId}>
              <StudentRow
                student={student}
                isOpen={openId === student.studentId}
                onToggle={() => {
                  onToggle(student.studentId);
                }}
              />
              {openId === student.studentId && (
                <tr className="settings-row">
                  <td colSpan={6}>{settingsFor(student)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The switch shows one group at a time: Active Students, or only the Deactivated ones.
const inGroup = (student: ListedStudent, showDeactivated: boolean) =>
  student.isActive !== showDeactivated;

interface ListChoices {
  search: string;
  showDeactivated: boolean;
  floor: number | null;
  sort: StudentSort;
}

function visibleStudents(group: ListedStudent[], choices: ListChoices) {
  const wanted = choices.search.trim().toLowerCase();
  return group
    .filter((s) => choices.floor === null || s.floor === choices.floor)
    .filter((s) => `${s.name} ${s.studentId} ${s.room}`.toLowerCase().includes(wanted))
    .sort(choices.sort === 'Room' ? byRoom : byName);
}

function countText(shown: number, total: number, choices: ListChoices) {
  const group = choices.showDeactivated ? 'Deactivated' : 'Active';
  const onFloor = choices.floor === null ? '' : ` on floor ${String(choices.floor)}`;
  return `Showing ${String(shown)} of ${String(total)} ${group} Students${onFloor}`;
}

function emptyText(choices: ListChoices) {
  if (choices.search.trim() !== '') return 'No Student matches this search.';
  if (choices.floor !== null) return `No Student is on floor ${String(choices.floor)}.`;
  return choices.showDeactivated ? 'No Student is Deactivated.' : 'No Student is Active.';
}

function StudentList(props: {
  students: ListedStudent[];
  openId: string | null;
  onToggle: (studentId: string) => void;
  settingsFor: (student: ListedStudent) => ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [floor, setFloor] = useState<number | null>(null);
  const [sort, setSort] = useState<StudentSort>('Room');
  const choices = { search, showDeactivated, floor, sort };
  const group = useMemo(
    () => props.students.filter((s) => inGroup(s, showDeactivated)),
    [props.students, showDeactivated],
  );
  const floors = [...new Set(group.map((s) => s.floor))].sort((a, b) => a - b);
  const rows = visibleStudents(group, choices);

  if (props.students.length === 0) {
    return (
      <section className="report-card">
        <p className="text-muted">No Students yet. Use Add a Student to enter the first one.</p>
      </section>
    );
  }
  return (
    <section className="report-card" aria-label="Students">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
        <p className="text-muted">{countText(rows.length, group.length, choices)}</p>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
          <label className="switch">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(event) => {
                setShowDeactivated(event.target.checked);
              }}
            />
            Show Deactivated
          </label>
          <div className="flex items-end gap-2">
            <label className="grid gap-1 text-muted">
              Search by name, Student ID or room
              <input
                className="field"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </label>
            <StudentFilter
              floors={floors}
              floor={floor}
              sort={sort}
              onFloor={setFloor}
              onSort={setSort}
            />
          </div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">{emptyText(choices)}</p>
      ) : (
        <StudentTable
          rows={rows}
          openId={props.openId}
          onToggle={props.onToggle}
          settingsFor={props.settingsFor}
        />
      )}
    </section>
  );
}

const DONE: Record<ActiveChange, string> = { Deactivate: 'Deactivated', Activate: 'Activated' };

const istToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(Date.now());

export function StudentsPage({
  source,
  today = istToday(),
}: {
  source: StudentSource;
  today?: string;
}) {
  const [students, setStudents] = useState<ListedStudent[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [forMany, setForMany] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStudents(await source.list());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const changeActive = async (student: ListedStudent, change: ActiveChange) => {
    await (change === 'Deactivate'
      ? source.deactivate(student.studentId)
      : source.activate(student.studentId));
    setMessage(`${DONE[change]} ${student.name}.`);
    await refresh();
  };

  const settingsFor = (student: ListedStudent) => (
    <StudentSettings
      student={student}
      source={source}
      today={today}
      onSaved={() => void refresh()}
      onActiveChange={(change) => changeActive(student, change)}
      onClose={() => {
        setOpenId(null);
      }}
    />
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-[2.5rem] leading-tight font-bold text-primary">
            Students
          </h1>
          <p className="text-muted">
            Add Students, edit their details, and open the gear for more.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="gear gear-common"
            type="button"
            aria-label="Leave or Return for many Students"
            title="Leave or Return for many Students"
            aria-expanded={forMany}
            onClick={() => {
              setForMany((old) => !old);
            }}
          >
            <GearIcon />
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setAdding((old) => !old);
            }}
          >
            {adding ? 'Close the form' : 'Add a Student'}
          </button>
        </div>
      </div>
      {forMany && (
        <ManyStudentsTools
          students={students ?? []}
          source={source}
          today={today}
          onDone={() => void refresh()}
        />
      )}
      {adding && (
        <AddStudentForm
          source={source}
          onAdded={(name) => {
            setMessage(`Added ${name}.`);
            void refresh();
          }}
        />
      )}
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
      {students && (
        <StudentList
          students={students}
          openId={openId}
          onToggle={(studentId) => {
            setOpenId((old) => (old === studentId ? null : studentId));
          }}
          settingsFor={settingsFor}
        />
      )}
    </div>
  );
}
