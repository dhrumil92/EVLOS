import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Altar } from './Altar.js';
import type { AuthSource, LogInAnswer } from './auth-source.js';

const REFUSALS: Record<Exclude<LogInAnswer, 'logged-in'>, string> = {
  refused: 'Email or password is wrong.',
  'too-many': 'Too many tries. Wait 15 minutes, then log in again.',
};

export function LoginPage(props: { auth: AuthSource; note: string; onLoggedIn: () => void }) {
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
      setProblem('The EVLOS server cannot be reached. Start it with npm run dev, then try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="screen">
      <main className="gutter relative z-10 grid min-h-[70vh] place-items-center pt-10">
        <form
          className="login-card grid w-full max-w-[24rem] gap-4"
          aria-label="Log in"
          onSubmit={(event) => void logIn(event)}
        >
          <div>
            <h1 className="font-display text-5xl font-bold text-gold">EVLOS</h1>
            <p className="text-mist">Log in to see today's Pooja.</p>
          </div>
          {props.note && (
            <p className="notice" role="status">
              {props.note}
            </p>
          )}
          <label className="grid gap-1 text-mist">
            Email
            <input
              className="field"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
            />
          </label>
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
          <button className="btn justify-self-start" type="submit" disabled={sending}>
            Log in
          </button>
        </form>
      </main>
      <Altar flareKey={null} />
    </div>
  );
}
