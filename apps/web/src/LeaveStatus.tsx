import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { LeaveAnswer, LeaveForm, ListedStudent, StudentSource } from './student-source.js';

// Plain words for each reason the server gives for refusing (FR-4, FR-5).
export const REFUSALS: Record<string, string> = {
  'invalid-time': 'Enter a full date and time.',
  'unknown-student': 'No Student has this Student ID.',
  'not-active': 'He is Deactivated. Activate him first to record a Leave.',
  'out-time-in-future':
    'The Out Time is later than now. A Leave Note is filled only when leaving, so it cannot be in the future.',
  'expected-return-before-out': 'The Expected Return is earlier than the Out Time.',
  'already-away': 'He is already Away. Record his Return first.',
  'overlaps-earlier-leave': 'The Out Time is before he returned from his last Leave.',
  'no-open-leave': 'He has no open Leave. Reload the page to see his current state.',
  'return-time-in-future': 'The Return Time is later than now.',
  'return-before-out': 'The Return Time is earlier than his Out Time.',
};
export const refusalText = (answer: LeaveAnswer) =>
  REFUSALS[answer] ?? 'Nothing was saved. Reload the page and try again.';

const IST = { timeZone: 'Asia/Kolkata' } as const;
const istDay = new Intl.DateTimeFormat('en-CA', IST);
const istTime = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const istWords = new Intl.DateTimeFormat('en-GB', {
  ...IST,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
export const inWords = (instant: number) =>
  `${istWords.format(instant).replace(',', '')} at ${istTime.format(instant)}`;

const STATE_CLASSES = {
  'In hostel': 'status-in-hostel',
  Away: 'status-away',
  'Due Back': 'status-due-back',
};

export function LeaveStateLabel({ state }: { state: ListedStudent['leaveState'] }) {
  return <span className={`status ${STATE_CLASSES[state]}`}>{state}</span>;
}

function DateTime(props: {
  label: string;
  day: string;
  time: string;
  max?: string;
  onDay: (day: string) => void;
  onTime: (time: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-muted">
        {props.label} date
        <input
          className="field"
          type="date"
          required
          max={props.max}
          value={props.day}
          onChange={(event) => {
            props.onDay(event.target.value);
          }}
        />
      </label>
      <label className="grid gap-1 text-muted">
        {props.label} time
        <input
          className="field"
          type="time"
          required
          value={props.time}
          onChange={(event) => {
            props.onTime(event.target.value);
          }}
        />
      </label>
    </div>
  );
}

// The Out date cannot be in the future; the Expected Return date can (FR-4).
function LeaveFields(props: {
  form: LeaveForm;
  today: string;
  onChange: (form: LeaveForm) => void;
}) {
  const set = (field: keyof LeaveForm) => (value: string) => {
    props.onChange({ ...props.form, [field]: value });
  };
  return (
    <>
      <DateTime
        label="Out"
        day={props.form.outDay}
        time={props.form.outTime}
        max={props.today}
        onDay={set('outDay')}
        onTime={set('outTime')}
      />
      <DateTime
        label="Expected Return"
        day={props.form.expectedReturnDay}
        time={props.form.expectedReturnTime}
        onDay={set('expectedReturnDay')}
        onTime={set('expectedReturnTime')}
      />
    </>
  );
}

function SaveForm(props: {
  button: string;
  onSave: () => Promise<void>;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const save = (event: SyntheticEvent) => {
    event.preventDefault();
    void props.onSave();
  };
  return (
    <form className="grid gap-3" noValidate onSubmit={save}>
      {props.children}
      <div className="flex flex-wrap gap-3">
        <button className="btn" type="submit">
          {props.button}
        </button>
        {props.extra}
      </div>
    </form>
  );
}

type View = 'main' | 'edit' | 'confirm-cancel';

function savedTimes(student: ListedStudent): LeaveForm {
  const leave = student.openLeave;
  if (leave === null)
    return { outDay: '', outTime: '', expectedReturnDay: '', expectedReturnTime: '' };
  return {
    outDay: istDay.format(leave.outAt),
    outTime: istTime.format(leave.outAt),
    expectedReturnDay: istDay.format(leave.expectedReturnAt),
    expectedReturnTime: istTime.format(leave.expectedReturnAt),
  };
}

function AwayActions(props: {
  student: ListedStudent;
  today: string;
  run: (action: () => Promise<LeaveAnswer>, done: string) => Promise<void>;
  source: StudentSource;
}) {
  const { student, source, run } = props;
  const [view, setView] = useState<View>('main');
  const [leave, setLeave] = useState(() => savedTimes(student));
  const [returnDay, setReturnDay] = useState(props.today);
  const [returnTime, setReturnTime] = useState('');
  const back = () => {
    setView('main');
  };

  if (view === 'edit') {
    return (
      <SaveForm
        button="Save Leave"
        onSave={() => run(() => source.editLeave(student.studentId, leave), 'Leave saved.')}
        extra={
          <button className="btn-quiet" type="button" onClick={back}>
            Back
          </button>
        }
      >
        <LeaveFields form={leave} today={props.today} onChange={setLeave} />
      </SaveForm>
    );
  }
  if (view === 'confirm-cancel') {
    return (
      <div className="grid gap-3" role="group" aria-label="Confirm Cancel Leave">
        <p>
          Cancel this Leave? Use it only for a Leave entered by mistake. He will be shown in hostel.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-danger"
            type="button"
            onClick={() =>
              void run(
                () => source.cancelLeave(student.studentId),
                'Leave cancelled. He is in hostel.',
              )
            }
          >
            Yes, cancel Leave
          </button>
          <button className="btn-quiet" type="button" onClick={back}>
            Keep Leave
          </button>
        </div>
      </div>
    );
  }
  return (
    <SaveForm
      button="Record Return"
      onSave={() =>
        run(
          () => source.returnLeave(student.studentId, { returnDay, returnTime }),
          'Return recorded. He is in hostel.',
        )
      }
      extra={
        <>
          <button
            className="btn-quiet"
            type="button"
            onClick={() => {
              setView('edit');
            }}
          >
            Edit Leave
          </button>
          <button
            className="btn-outline-danger"
            type="button"
            onClick={() => {
              setView('confirm-cancel');
            }}
          >
            Cancel Leave
          </button>
        </>
      }
    >
      <DateTime
        label="Return"
        day={returnDay}
        time={returnTime}
        max={props.today}
        onDay={setReturnDay}
        onTime={setReturnTime}
      />
    </SaveForm>
  );
}

function RecordLeave(props: {
  student: ListedStudent;
  today: string;
  source: StudentSource;
  run: (action: () => Promise<LeaveAnswer>, done: string) => Promise<void>;
}) {
  const [leave, setLeave] = useState<LeaveForm>({
    outDay: props.today,
    outTime: '',
    expectedReturnDay: props.today,
    expectedReturnTime: '',
  });
  return (
    <SaveForm
      button="Record Leave"
      onSave={() =>
        props.run(
          () => props.source.recordLeave(props.student.studentId, leave),
          'Leave recorded. He is now Away.',
        )
      }
    >
      <LeaveFields form={leave} today={props.today} onChange={setLeave} />
    </SaveForm>
  );
}

// The gear's Leave status tab: his state, then record a Leave or his Return (FR-4, FR-5).
export function LeaveStatus(props: {
  student: ListedStudent;
  source: StudentSource;
  today: string;
  onChanged: () => void;
}) {
  const { student } = props;
  const [note, setNote] = useState({ text: '', isProblem: false });

  const run = async (action: () => Promise<LeaveAnswer>, done: string) => {
    try {
      const answer = await action();
      setNote(
        answer === 'done'
          ? { text: done, isProblem: false }
          : { text: refusalText(answer), isProblem: true },
      );
      if (answer === 'done') props.onChanged();
    } catch {
      setNote({ text: 'Nothing was saved. Check the server.', isProblem: true });
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <div>
          <LeaveStateLabel state={student.leaveState} />
        </div>
        {student.openLeave && (
          <>
            <p>Out {inWords(student.openLeave.outAt)}</p>
            <p>Expected back {inWords(student.openLeave.expectedReturnAt)}</p>
          </>
        )}
      </div>
      {student.openLeave ? (
        <AwayActions
          key={student.openLeave.outAt}
          student={student}
          today={props.today}
          source={props.source}
          run={run}
        />
      ) : (
        <RecordLeave student={student} today={props.today} source={props.source} run={run} />
      )}
      {note.text && (
        <p
          className={note.isProblem ? 'field-error' : ''}
          role={note.isProblem ? 'alert' : 'status'}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
