import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { AuthSource } from './auth-source.js';
import { AuthAlert, AuthShell, AuthTitle } from './AuthShell.js';
import { NewPasswordField, PasswordAgain } from './PasswordFields.js';

const CHANGED =
  'Your password has been changed and every login has ended. Log in with the new password.';
const SERVER_FAILED = 'The server could not finish this. Try the link again in a moment.';

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
        <a className="btn inline-flex min-h-13 items-center justify-center text-lg" href="/">
          Go to log in
        </a>
      </>
    );
  }
  return (
    <form
      className="grid gap-5"
      aria-label="Set a new password"
      noValidate
      onSubmit={(event) => void save(event)}
    >
      <NewPasswordField value={first} onChange={setFirst} />
      <PasswordAgain first={first} value={again} onChange={setAgain} />
      {problem && <AuthAlert isProblem title={problem} />}
      <button className="btn min-h-13 text-lg" type="submit">
        Save new password
      </button>
    </form>
  );
}

// Opened from the link in a password reset email: /reset-password?token=...
export function ResetPasswordPage({ auth, token }: { auth: AuthSource; token: string }) {
  return (
    <AuthShell>
      <AuthTitle
        title="Set a new password"
        line="At least 12 characters. Saving ends every login, so you log in again with the new one."
      />
      {token === '' ? (
        <AuthAlert
          isProblem
          title="This link is not complete. Ask for a new one from the login page."
        />
      ) : (
        <NewPasswordForm auth={auth} token={token} />
      )}
    </AuthShell>
  );
}
