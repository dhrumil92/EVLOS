import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { AuthSource } from './auth-source.js';
import { AuthScreen, CardHeading } from './LoginPage.js';

const CHANGED =
  'Your password has been changed and every login has ended. Log in with the new password.';
const SERVER_FAILED = 'The server could not finish this. Try the link again in a moment.';

function PasswordBox(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-muted">
      {props.label}
      <input
        className="field"
        type="password"
        autoComplete="new-password"
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      />
    </label>
  );
}

function NewPasswordForm({ auth, token }: { auth: AuthSource; token: string }) {
  const [first, setFirst] = useState('');
  const [again, setAgain] = useState('');
  const [problem, setProblem] = useState('');
  const [isDone, setIsDone] = useState(false);

  const save = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (first !== again) {
      setProblem('The two new passwords are not the same.');
      return;
    }
    const answer = await auth.resetPassword(token, first).catch(() => SERVER_FAILED);
    setIsDone(answer === 'done');
    setProblem(answer === 'done' ? '' : answer);
  };

  if (isDone) {
    return (
      <>
        <p className="notice" role="status">
          {CHANGED}
        </p>
        <a className="btn justify-self-start" href="/">
          Go to log in
        </a>
      </>
    );
  }
  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void save(event)}>
      <PasswordBox label="New password" value={first} onChange={setFirst} />
      <PasswordBox label="New password again" value={again} onChange={setAgain} />
      {problem && (
        <p className="field-error" role="alert">
          {problem}
        </p>
      )}
      <button className="btn justify-self-start" type="submit">
        Set new password
      </button>
    </form>
  );
}

// Opened from the link in a password reset email: /reset-password?token=...
export function ResetPasswordPage({ auth, token }: { auth: AuthSource; token: string }) {
  return (
    <AuthScreen>
      <section className="login-card grid w-full max-w-[24rem] gap-4" aria-label="Reset password">
        <CardHeading line="Choose a new password of at least 12 characters." />
        {token === '' ? (
          <p className="field-error" role="alert">
            This link is not complete. Ask for a new one from the login page.
          </p>
        ) : (
          <NewPasswordForm auth={auth} token={token} />
        )}
      </section>
    </AuthScreen>
  );
}
