import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { lengthCheck, matchCheck, MIN_LENGTH } from './password-check.js';

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

// A password box with a Show and Hide button inside it. Used for the login password too.
export function ShowHideInput(props: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  describedBy?: string | undefined;
  isInvalid?: boolean;
}) {
  const [isShown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={props.id}
        className={`field min-h-12 w-full pr-24 ${props.isInvalid === true ? 'border-danger' : ''}`}
        type={isShown ? 'text' : 'password'}
        autoComplete={props.autoComplete}
        aria-invalid={props.isInvalid}
        aria-describedby={props.describedBy}
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
  );
}

// The new password: a Show and Hide button, a bar that fills as it is typed, and how many
// characters are still needed. Never a guess at "strength": only the length is checked.
export function NewPasswordField(props: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const length = lengthCheck(props.value);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-bold">
        New password
      </label>
      <ShowHideInput
        id={id}
        value={props.value}
        onChange={props.onChange}
        autoComplete="new-password"
        describedBy={`${id}-help`}
      />
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

// The second box: says live whether it is the same as the first, once something is typed.
export function PasswordAgain(props: {
  first: string;
  value: string;
  onChange: (value: string) => void;
}) {
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
