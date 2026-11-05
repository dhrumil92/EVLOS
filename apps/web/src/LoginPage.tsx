import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { Altar } from './Altar.js';
import type { AuthSource, LogInAnswer } from './auth-source.js';

const REFUSALS: Record<Exclude<LogInAnswer, 'logged-in'>, string> = {
  refused: 'Email or password is wrong.',
  'too-many': 'Too many tries. Wait 15 minutes, then log in again.',
};
const UNREACHABLE =
  'The EVLOS server cannot be reached. Start it with npm run dev, then try again.';
// The same answer whether or not the email has an account (see the server's auth routes).
const LINK_SENT =
  "If this is the Rector's email, a link to set a new password has been sent to it. " +
  'The link works once, for 30 minutes.';

// The page around the login card, also used by the reset password page.
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="screen">
      <main className="gutter relative z-10 grid min-h-[70vh] place-items-center pt-10">
        {children}
      </main>
      <Altar flareKey={null} />
    </div>
  );
}

export function CardHeading({ line }: { line: string }) {
  return (
    <div>
      <h1 className="font-display text-5xl font-bold text-gold">EVLOS</h1>
      <p className="text-mist">{line}</p>
    </div>
  );
}

function EmailField(props: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-mist">
      Email
      <input
        className="field"
        type="email"
        autoComplete="username"
        required
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </label>
  );
}

function LogInForm(props: {
  auth: AuthSource;
  note: string;
  onLoggedIn: () => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState('');
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
    <form
      className="login-card grid w-full max-w-[24rem] gap-4"
      aria-label="Log in"
      onSubmit={(event) => void logIn(event)}
    >
      <CardHeading line="Log in to see today's Pooja." />
      {props.note && (
        <p className="notice" role="status">
          {props.note}
        </p>
      )}
      <EmailField value={email} onChange={setEmail} />
      <label className="grid gap-1 text-mist">
        Password
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </label>
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="submit" disabled={sending}>
          Log in
        </button>
        <button className="btn-quiet" type="button" onClick={props.onForgot}>
          Forgot password?
        </button>
      </div>
    </form>
  );
}

// A Rector who forgot the password asks for a one-time link to the login email.
function ForgotPasswordForm(props: { auth: AuthSource; onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [answer, setAnswer] = useState<{ sent: boolean; text: string } | null>(null);

  const send = async (event: SyntheticEvent) => {
    event.preventDefault();
    try {
      const reply = await props.auth.requestPasswordReset(email);
      setAnswer(
        reply === 'sent'
          ? { sent: true, text: LINK_SENT }
          : { sent: false, text: 'Too many requests. Wait 15 minutes, then try again.' },
      );
    } catch {
      setAnswer({ sent: false, text: UNREACHABLE });
    }
  };

  return (
    <form
      className="login-card grid w-full max-w-[24rem] gap-4"
      aria-label="Forgot password"
      onSubmit={(event) => void send(event)}
    >
      <CardHeading line="Type the email you log in with. A link to set a new password will be sent to it." />
      <EmailField value={email} onChange={setEmail} />
      {answer && (
        <p
          className={answer.sent ? 'notice' : 'field-error'}
          role={answer.sent ? 'status' : 'alert'}
        >
          {answer.text}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" type="submit">
          Send link
        </button>
        <button className="btn-quiet" type="button" onClick={props.onBack}>
          Back to log in
        </button>
      </div>
    </form>
  );
}

export function LoginPage(props: { auth: AuthSource; note: string; onLoggedIn: () => void }) {
  const [isForgot, setIsForgot] = useState(false);
  return (
    <AuthScreen>
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
    </AuthScreen>
  );
}
