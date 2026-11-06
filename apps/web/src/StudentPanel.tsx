import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { LeaveStatus } from './LeaveStatus.js';
import { DETAIL_FIELDS, errorsFor, FieldInputs } from './student-fields.js';
import type { ListedStudent, StudentDetails, StudentSource } from './student-source.js';

export type ActiveChange = 'Deactivate' | 'Activate';

const detailsOf = (student: ListedStudent): StudentDetails => ({
  name: student.name,
  room: student.room,
  email: student.email,
  phone: student.phone ?? '',
});

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');

function DetailsForm(props: {
  student: ListedStudent;
  source: StudentSource;
  onSaved: () => void;
  onBack: () => void;
}) {
  const [details, setDetails] = useState(() => detailsOf(props.student));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    try {
      const result = await props.source.edit(props.student.studentId, details);
      setErrors(result.outcome === 'invalid' ? errorsFor(result.fields) : {});
      if (result.outcome === 'edited') props.onSaved();
      if (result.outcome === 'unknown-student') setNote('No Student has this ID.');
    } catch {
      setNote('The details were not saved. Check the server.');
    }
  };

  return (
    <form className="grid gap-3" noValidate onSubmit={(event) => void save(event)}>
      <FieldInputs
        fields={DETAIL_FIELDS}
        values={details}
        errors={errors}
        onChange={(name, value) => {
          setDetails((old) => ({ ...old, [name]: value }));
          setNote('');
        }}
      />
      <p className="text-sm text-muted">
        Student ID {props.student.studentId} cannot be changed. It matches the fingerprint on the
        Device.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="submit">
          Save details
        </button>
        <button className="btn-quiet" type="button" onClick={props.onBack}>
          Back
        </button>
        {note && (
          <span role="status" className="field-error">
            {note}
          </span>
        )}
      </div>
    </form>
  );
}

function Details(props: { student: ListedStudent; source: StudentSource; onSaved: () => void }) {
  const { student } = props;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  if (editing) {
    return (
      <DetailsForm
        student={student}
        source={props.source}
        onSaved={() => {
          setEditing(false);
          setSaved(true);
          props.onSaved();
        }}
        onBack={() => {
          setEditing(false);
        }}
      />
    );
  }
  return (
    <div className="grid gap-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-muted">Email</dt>
        <dd className="break-words">{student.email}</dd>
        <dt className="text-muted">Phone</dt>
        <dd>{student.phone ?? '–'}</dd>
        <dt className="text-muted">Room</dt>
        <dd>
          {student.room}, Floor {student.floor}
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="btn-quiet"
          type="button"
          onClick={() => {
            setEditing(true);
            setSaved(false);
          }}
        >
          Edit details
        </button>
        {saved && (
          <span role="status" className="font-bold text-ok">
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}

const ACTIVE_TEXT: Record<ActiveChange, { ask: string; why: string }> = {
  Deactivate: {
    ask: 'Left the hostel for good?',
    why: 'From today the Student is not listed and gets no Pooja Status. Finalized Days never change, and the Punches, Leaves and Reports stay.',
  },
  Activate: {
    ask: 'Back in the hostel?',
    why: 'From today the Student is listed and gets a Pooja Status again. The Days the Student was Deactivated are not evaluated.',
  },
};

// Deactivate or Activate, small and at the bottom, and asked once more before it happens.
function ActiveChangeBox(props: {
  student: ListedStudent;
  onChange: (change: ActiveChange) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const change: ActiveChange = props.student.isActive ? 'Deactivate' : 'Activate';
  const confirm = async () => {
    try {
      await props.onChange(change);
    } catch {
      setFailed(true);
    }
    setAsking(false);
  };
  return (
    <div className="grid gap-2 border-t border-line pt-4">
      <p className="text-sm text-muted">
        {ACTIVE_TEXT[change].ask} {ACTIVE_TEXT[change].why}
      </p>
      {asking ? (
        <div className="grid gap-3" role="group" aria-label={`Confirm ${change}`}>
          <p className="font-bold">
            {change} {props.student.name} from today?
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-danger" type="button" onClick={() => void confirm()}>
              Yes, {change}
            </button>
            <button
              className="btn-quiet"
              type="button"
              onClick={() => {
                setAsking(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="link-button justify-self-start text-danger"
          type="button"
          onClick={() => {
            setAsking(true);
            setFailed(false);
          }}
        >
          {change} {props.student.name}
        </button>
      )}
      {failed && (
        <p className="field-error">Nothing changed. Reload the page to see the current state.</p>
      )}
    </div>
  );
}

// Everything about one Student, beside the list: Leave first, then Details, then Deactivate.
export function StudentPanel(props: {
  student: ListedStudent;
  source: StudentSource;
  // Today's IST date, the default for Leave and Return dates.
  today: string;
  onSaved: () => void;
  onActiveChange: (change: ActiveChange) => Promise<void>;
  onClose: () => void;
}) {
  const { student } = props;
  return (
    <section
      aria-label={student.name}
      className="book-card grid gap-5 p-5"
      onKeyDown={(event) => {
        if (event.key === 'Escape') props.onClose();
      }}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-tint font-display text-xl font-extrabold text-primary"
        >
          {initials(student.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl leading-tight font-extrabold">{student.name}</h2>
          <p className="text-muted">
            Room {student.room}, Student ID {student.studentId}
          </p>
        </div>
        <button
          className="gear border-[1.5px] border-line"
          type="button"
          aria-label="Close"
          onClick={props.onClose}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      {student.isActive && (
        <div className="grid gap-2 rounded-2xl border border-line bg-wash p-4">
          <h3 className="font-display text-lg font-bold">Leave</h3>
          <LeaveStatus
            student={student}
            source={props.source}
            today={props.today}
            onChanged={props.onSaved}
          />
        </div>
      )}
      <div className="grid gap-2">
        <h3 className="font-display text-lg font-bold">Details</h3>
        <Details student={student} source={props.source} onSaved={props.onSaved} />
      </div>
      <ActiveChangeBox student={student} onChange={props.onActiveChange} />
    </section>
  );
}
