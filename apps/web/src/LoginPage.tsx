import { useId, useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { AuthSource, LogInAnswer } from './auth-source.js';
import { AuthAlert, AuthShell, AuthTitle } from './AuthShell.js';
import { ShowHideInput } from './PasswordFields.js';

interface Problem {
  title: string;
  hint?: string;
  // The password is what was wrong, so its box is marked.
  isWrong?: boolean;
}

const REFUSALS: Record<Exclude<LogInAnswer, 'logged-in'>, Problem> = {
  refused: {
    title: 'Email or password is wrong.',
    hint: 'Check Caps Lock, then try again. After too many tries you wait 15 minutes.',
    isWrong: true,
  },
  'too-many': { title: 'Too many tries. Wait 15 minutes, then log in again.' },
};
const UNREACHABLE: Problem = {
  title: 'The EVLOS server cannot be reached. Start it with npm run dev, then try again.',
};
// The same answer whether or not the email has an account (see the server's auth routes).
const LINK_SENT =
  "If this is the Rector's email, a link to set a new password has been sent to it. " +
  'The link works once, for 30 minutes.';

function EmailField(props: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-bold">
        Email
      </label>
      <input
        id={id}
        className="field min-h-12 text-[1.05rem]"
        type="email"
        inputMode="email"
        autoComplete="username"
        required
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </div>
  );
}

function LogInForm(props: {
  auth: AuthSource;
  note: string;
  onLoggedIn: () => void;
  onForgot: () => void;
}) {
  const passwordId = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sending, setSending] = useState(false);

  const logIn = async (event: SyntheticEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const answer = await props.auth.logIn(email, password);
      if (answer === 'logged-in') {
        props.onLoggedIn();
        return;
      }
      setProblem(REFUSALS[answer]);
      setPassword('');
    } catch {
      setProblem(UNREACHABLE);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="grid gap-5" aria-label="Log in" onSubmit={(event) => void logIn(event)}>
      <AuthTitle title="Log in" line="Use the email and password set up for the Rector." />
      {props.note && (
        <p className="notice" role="status">
          {props.note}
        </p>
      )}
      {problem && <AuthAlert isProblem title={problem.title} hint={problem.hint} />}
      <EmailField value={email} onChange={setEmail} />
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className="font-bold">
            Password
          </label>
          <button
            type="button"
            className="font-bold text-primary hover:underline"
            onClick={props.onForgot}
          >
            Forgot password?
          </button>
        </div>
        <ShowHideInput
          id={passwordId}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          isInvalid={problem?.isWrong === true}
        />
      </div>
      <button className="btn min-h-13 text-lg" type="submit" disabled={sending}>
        Log in
      </button>
    </form>
  );
}

// A Rector who forgot the password asks for a one-time link to the login email.
function ForgotPasswordForm(props: { auth: AuthSource; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState<{ isSent: boolean; title: string; hint?: string } | null>(
    null,
  );

  const send = async (event: SyntheticEvent) => {
    event.preventDefault();
    try {
      const reply = await props.auth.requestPasswordReset(email);
      setAnswer(
        reply === 'sent'
          ? { isSent: true, title: 'Check your email.', hint: LINK_SENT }
          : { isSent: false, title: 'Too many requests. Wait 15 minutes, then try again.' },
      );
    } catch {
      setAnswer({ isSent: false, title: UNREACHABLE.title });
    }
  };

  const isSent = answer?.isSent === true;
  return (
    <form
      className="grid gap-5"
      aria-label="Forgot password"
      onSubmit={(event) => void send(event)}
    >
      <AuthTitle
        title="Forgot password"
        line="Type the email you log in with. A link to set a new password will be sent to it."
      />
      <EmailField value={email} onChange={setEmail} />
      {answer && <AuthAlert isProblem={!answer.isSent} title={answer.title} hint={answer.hint} />}
      <button className={`min-h-13 text-lg ${isSent ? 'btn-quiet' : 'btn'}`} type="submit">
        {isSent ? 'Send the link again' : 'Send link'}
      </button>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-bold text-primary hover:underline"
        onClick={props.onBack}
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
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to Log in
      </button>
    </form>
  );
}

export function LoginPage(props: { auth: AuthSource; note: string; onLoggedIn: () => void }) {
  const [isForgot, setIsForgot] = useState(false);
  return (
    <AuthShell>
      {isForgot ? (
        <ForgotPasswordForm
          auth={props.auth}
          onBack={() => {
            setIsForgot(false);
          }}
        />
      ) : (
        <LogInForm
          {...props}
          onForgot={() => {
            setIsForgot(true);
          }}
        />
      )}
    </AuthShell>
  );
}
