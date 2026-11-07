import { useId, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { lengthCheck, matchCheck, MIN_LENGTH } from './password-check.js';
import type { SettingsSource } from './settings-source.js';

const SERVER_FAILED = 'The server could not finish this. Reload the page to see what was saved.';
const EMPTY: [string, string, string] = ['', '', ''];

function Hint(props: { id: string; isGood: boolean; icon: ReactNode; children: string }) {
  return (
    <span
      id={props.id}
      className={`flex items-center gap-1.5 text-sm font-bold ${props.isGood ? 'text-ok' : 'text-muted'}`}
    >
      {props.icon}
      {props.children}
    </span>
  );
}

const CHECK = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
);

const WARNING = (
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
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
);

// A segment for each of the 12 characters a new password needs.
function LengthBar(props: { filled: number; isLongEnough: boolean }) {
  return (
    <div data-testid="length-bar" aria-hidden="true" className="grid grid-cols-12 gap-[3px]">
      {Array.from({ length: MIN_LENGTH }, (_, index) => {
        const isFilled = index < props.filled;
        const colour = !isFilled
          ? 'bg-line'
          : props.isLongEnough
            ? 'bg-(--bar-present)'
            : 'bg-warn-line';
        return (
          <span key={index} data-filled={isFilled} className={`h-1.5 rounded-[3px] ${colour}`} />
        );
      })}
    </div>
  );
}

function NewPassword(props: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [isShown, setShown] = useState(false);
  const length = lengthCheck(props.value);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-bold">
        New password
      </label>
      <div className="relative">
        <input
          id={id}
          className="field min-h-12 w-full pr-24"
          type={isShown ? 'text' : 'password'}
          autoComplete="new-password"
          aria-describedby={`${id}-help`}
          value={props.value}
          onChange={(event) => {
            props.onChange(event.target.value);
          }}
        />
        <button
          type="button"
          aria-pressed={isShown}
          className="absolute top-0.5 right-1.5 min-h-11 px-2.5 font-bold text-primary hover:underline"
          onClick={() => {
            setShown((old) => !old);
          }}
        >
          {isShown ? 'Hide' : 'Show'}
        </button>
      </div>
      <LengthBar filled={length.filled} isLongEnough={length.isLongEnough} />
      <Hint
        id={`${id}-help`}
        isGood={length.isLongEnough}
        icon={length.isLongEnough ? CHECK : null}
      >
        {length.text}
      </Hint>
    </div>
  );
}

function PasswordAgain(props: { first: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const match = matchCheck(props.first, props.value);
  const isDifferent = match !== null && !match.isSame;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-bold">
        New password again
      </label>
      <input
        id={id}
        className={`field min-h-12 ${isDifferent ? 'border-danger' : ''}`}
        type="password"
        autoComplete="new-password"
        aria-invalid={isDifferent}
        aria-describedby={match === null ? undefined : `${id}-help`}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
      {match !== null && (
        <Hint id={`${id}-help`} isGood={match.isSame} icon={match.isSame ? CHECK : WARNING}>
          {match.text}
        </Hint>
      )}
    </div>
  );
}

// The logged-in Rector changes the password. The new one is typed twice, and the two are
// compared as they are typed and again here, so a typing slip never becomes the password.
export function PasswordCard({ source }: { source: SettingsSource }) {
  const currentId = useId();
  const [typed, setTyped] = useState(EMPTY);
  const [answer, setAnswer] = useState<{ done: boolean; text: string } | null>(null);
  const [current, first, again] = typed;
  const set = (index: number, value: string) => {
    setTyped((old) => old.map((one, at) => (at === index ? value : one)) as typeof EMPTY);
  };

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (first !== again) {
      setAnswer({ done: false, text: 'The two new passwords are not the same.' });
      return;
    }
    const reply = await source.changePassword(current, first).catch(() => SERVER_FAILED);
    if (reply === 'done') setTyped(EMPTY);
    setAnswer(
      reply === 'done'
        ? { done: true, text: 'Password changed. Every other login has been ended.' }
        : { done: false, text: reply },
    );
  };

  return (
    <section className="report-card flex flex-wrap gap-x-10 gap-y-5 p-6" aria-label="Your password">
      <div className="flex-[1_1_15rem]">
        <h2 className="font-display text-[1.65rem] font-bold">Your password</h2>
        <p className="text-muted">
          Use at least 12 characters. A short sentence you can remember works well.
        </p>
        <p className="mt-3 text-muted">
          After you change it, every other login, on a phone or another computer, is ended. This one
          stays open.
        </p>
      </div>
      <form
        className="grid flex-[2_1_24rem] gap-4"
        noValidate
        onSubmit={(event) => void submit(event)}
      >
        <div className="grid gap-1.5">
          <label htmlFor={currentId} className="font-bold">
            Current password
          </label>
          <input
            id={currentId}
            className="field min-h-12"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(event) => {
              set(0, event.target.value);
            }}
          />
        </div>
        <NewPassword
          value={first}
          onChange={(value) => {
            set(1, value);
          }}
        />
        <PasswordAgain
          first={first}
          value={again}
          onChange={(value) => {
            set(2, value);
          }}
        />
        <button className="btn min-h-13 justify-self-start px-7 text-[1.05rem]" type="submit">
          Change password
        </button>
        {answer && (
          <p
            className={answer.done ? 'notice' : 'field-error'}
            role={answer.done ? 'status' : 'alert'}
          >
            {answer.text}
          </p>
        )}
      </form>
    </section>
  );
}
