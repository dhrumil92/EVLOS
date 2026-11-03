import { useId, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { LeaveStatus } from './LeaveStatus.js';
import { DETAIL_FIELDS, errorsFor, FieldInputs } from './student-fields.js';
import type { ListedStudent, StudentDetails, StudentSource } from './student-source.js';

const TABS = ['Details', 'Leave status', 'Danger zone'] as const;
type Tab = (typeof TABS)[number];

export type ActiveChange = 'Deactivate' | 'Activate';

const detailsOf = (student: ListedStudent): StudentDetails => ({
  name: student.name,
  room: student.room,
  email: student.email,
  phone: student.phone ?? '',
});

function Details(props: { student: ListedStudent; source: StudentSource; onSaved: () => void }) {
  const [details, setDetails] = useState(() => detailsOf(props.student));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    try {
      const result = await props.source.edit(props.student.studentId, details);
      setErrors(result.outcome === 'invalid' ? errorsFor(result.fields) : {});
      if (result.outcome === 'edited') props.onSaved();
      const notes = { edited: 'Saved.', invalid: '', 'unknown-student': 'No Student has this ID.' };
      setNote(notes[result.outcome]);
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
      <p className="text-mist">
        Student ID {props.student.studentId} cannot be changed. It matches his fingerprint on the
        Device.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" type="submit">
          Save details
        </button>
        {note && <span role="status">{note}</span>}
      </div>
    </form>
  );
}

const DANGER_TEXT: Record<ActiveChange, string> = {
  Deactivate:
    'Deactivate him when he has left the hostel. From today he is not listed and gets no ' +
    'Pooja Status. Finalized Days never change, and his Punches, Leaves and Reports stay.',
  Activate:
    'Activate him when he is back in the hostel. He is listed and gets a Pooja Status again ' +
    'from today. The Days he was Deactivated are not evaluated.',
};

function DangerZone(props: {
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
      setAsking(false);
    }
  };

  return (
    <div className="danger-zone grid gap-3">
      <p>{DANGER_TEXT[change]}</p>
      {asking ? (
        <div className="grid gap-3" role="group" aria-label={`Confirm ${change}`}>
          <p className="font-display text-xl font-semibold">
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
        <div>
          <button
            className="btn-outline-danger"
            type="button"
            onClick={() => {
              setAsking(true);
              setFailed(false);
            }}
          >
            {change} {props.student.name}
          </button>
        </div>
      )}
      {failed && (
        <p className="field-error">Nothing changed. Reload the page to see his current state.</p>
      )}
    </div>
  );
}

export function StudentSettings(props: {
  student: ListedStudent;
  source: StudentSource;
  // Today's IST date, the default for Leave and Return dates.
  today: string;
  onSaved: () => void;
  onActiveChange: (change: ActiveChange) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('Details');
  const id = useId();

  return (
    <section
      className="settings"
      aria-label={`Settings for ${props.student.name}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') props.onClose();
      }}
    >
      <div className="settings-tabs" role="tablist" aria-label="Settings">
        {TABS.map((name, index) => (
          <button
            key={name}
            id={`${id}-tab-${String(index)}`}
            type="button"
            role="tab"
            aria-selected={tab === name}
            aria-controls={`${id}-panel`}
            className={name === 'Danger zone' ? 'settings-tab settings-tab-danger' : 'settings-tab'}
            onClick={() => {
              setTab(name);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-tab-${String(TABS.indexOf(tab))}`}
        className="pt-4"
      >
        {tab === 'Details' && (
          <Details student={props.student} source={props.source} onSaved={props.onSaved} />
        )}
        {tab === 'Leave status' && (
          <LeaveStatus
            student={props.student}
            source={props.source}
            today={props.today}
            onChanged={props.onSaved}
          />
        )}
        {tab === 'Danger zone' && (
          <DangerZone student={props.student} onChange={props.onActiveChange} />
        )}
      </div>
    </section>
  );
}
