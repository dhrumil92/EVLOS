import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSource } from './auth-source.js';
import { SESSION_ENDED } from './auth-source.js';
import { LoginPage } from './LoginPage.js';

type Gate = 'checking' | 'logged-out' | 'logged-in';

// Shows the Rector's pages only after login, and the login page again when the session ends.
export function LoginGate(props: {
  auth: AuthSource;
  children: (logOut: () => void) => ReactNode;
}) {
  const { auth } = props;
  const [gate, setGate] = useState<Gate>('checking');
  const [note, setNote] = useState('');

  useEffect(() => {
    auth.me().then(
      (email) => {
        setGate(email === null ? 'logged-out' : 'logged-in');
      },
      () => {
        setGate('logged-out');
      },
    );
  }, [auth]);

  useEffect(() => {
    const ended = () => {
      setNote('Your session has ended. Log in again.');
      setGate('logged-out');
    };
    window.addEventListener(SESSION_ENDED, ended);
    return () => {
      window.removeEventListener(SESSION_ENDED, ended);
    };
  }, []);

  const logOut = useCallback(() => {
    void auth.logOut().finally(() => {
      setNote('');
      setGate('logged-out');
    });
  }, [auth]);

  if (gate === 'checking') return null;
  if (gate === 'logged-out') {
    return (
      <LoginPage
        auth={auth}
        note={note}
        onLoggedIn={() => {
          setNote('');
          setGate('logged-in');
        }}
      />
    );
  }
  return <>{props.children(logOut)}</>;
}
