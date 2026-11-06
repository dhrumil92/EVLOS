// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthSource, LogInAnswer } from './auth-source.js';
import { endSession } from './auth-source.js';
import { LoginGate } from './LoginGate.js';

function fakeAuth(loggedIn: string | null, answer: LogInAnswer = 'logged-in') {
  const state = {
    email: loggedIn,
    tries: [] as [string, string][],
    loggedOut: 0,
    resetsAskedFor: [] as string[],
  };
  const auth: AuthSource = {
    me: () => Promise.resolve(state.email),
    logIn: (email, password) => {
      state.tries.push([email, password]);
      if (answer === 'logged-in') state.email = email;
      return Promise.resolve(answer);
    },
    logOut: () => {
      state.loggedOut++;
      state.email = null;
      return Promise.resolve();
    },
    requestPasswordReset: (email) => {
      state.resetsAskedFor.push(email);
      return Promise.resolve('sent');
    },
    resetPassword: () => Promise.resolve('done'),
  };
  return { auth, state };
}

const page = (logOut: () => void) => (
  <button type="button" onClick={logOut}>
    Rector page
  </button>
);

const fillAndSend = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
};

afterEach(cleanup);

describe('LoginGate', () => {
  it('shows the login page when nobody is logged in', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByText('Rector page')).toBeNull();
  });

  it('shows the pages straight away when the Rector is still logged in', async () => {
    render(<LoginGate auth={fakeAuth('rector@example.com').auth}>{page}</LoginGate>);

    expect(await screen.findByText('Rector page')).toBeTruthy();
  });

  it('logs in with the email and password typed', async () => {
    const { auth, state } = fakeAuth(null);
    render(<LoginGate auth={auth}>{page}</LoginGate>);
    await screen.findByRole('button', { name: 'Log in' });

    fillAndSend('rector@example.com', 'right password');

    expect(await screen.findByText('Rector page')).toBeTruthy();
    expect(state.tries).toEqual([['rector@example.com', 'right password']]);
  });

  it('says the email or password is wrong and keeps the email', async () => {
    render(<LoginGate auth={fakeAuth(null, 'refused').auth}>{page}</LoginGate>);
    await screen.findByRole('button', { name: 'Log in' });

    fillAndSend('rector@example.com', 'wrong password');

    expect(await screen.findByText('Email or password is wrong.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('rector@example.com');
    expect(screen.getByLabelText<HTMLInputElement>('Password').value).toBe('');
  });

  it('says when to try again after too many tries', async () => {
    render(<LoginGate auth={fakeAuth(null, 'too-many').auth}>{page}</LoginGate>);
    await screen.findByRole('button', { name: 'Log in' });

    fillAndSend('rector@example.com', 'wrong password');

    expect(await screen.findByText(/Too many tries. Wait 15 minutes/)).toBeTruthy();
  });

  it('goes back to the login page after log out', async () => {
    const { auth, state } = fakeAuth('rector@example.com');
    render(<LoginGate auth={auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByText('Rector page'));

    expect(await screen.findByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(state.loggedOut).toBe(1);
  });

  it('goes back to the login page, and says why, when the session ends', async () => {
    render(<LoginGate auth={fakeAuth('rector@example.com').auth}>{page}</LoginGate>);
    await screen.findByText('Rector page');

    act(() => {
      endSession();
    });

    expect(await screen.findByText('Your session has ended. Log in again.')).toBeTruthy();
  });
});

describe('forgotten password', () => {
  const SENT =
    "If this is the Rector's email, a link to set a new password has been sent to it. " +
    'The link works once, for 30 minutes.';

  it('asks for a link by email from the login page', async () => {
    const { auth, state } = fakeAuth(null);
    render(<LoginGate auth={auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'rector@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

    expect(await screen.findByText(SENT)).toBeTruthy();
    expect(state.resetsAskedFor).toEqual(['rector@example.com']);
  });

  it('goes back to the login form', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to log in' }));

    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
  });
});
