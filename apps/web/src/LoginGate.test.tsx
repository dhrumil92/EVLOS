// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthSource, LogInAnswer } from './auth-source.js';
import { endSession } from './auth-source.js';
import { LoginGate } from './LoginGate.js';

function fakeAuth(loggedIn: string | null, answer: LogInAnswer | 'down' = 'logged-in') {
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
      if (answer === 'down') return Promise.reject(new Error('down'));
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

  it('says how to fix it when the server cannot be reached', async () => {
    render(<LoginGate auth={fakeAuth(null, 'down').auth}>{page}</LoginGate>);
    await screen.findByRole('button', { name: 'Log in' });

    fillAndSend('rector@example.com', 'a password');

    expect(await screen.findByText(/The EVLOS server cannot be reached/)).toBeTruthy();
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

describe('the login screen', () => {
  const open = async (answer: LogInAnswer | 'down' = 'refused') => {
    render(<LoginGate auth={fakeAuth(null, answer).auth}>{page}</LoginGate>);
    await screen.findByRole('button', { name: 'Log in' });
  };

  it('has the title and a line saying which email and password to use', async () => {
    await open();

    expect(screen.getByRole('heading', { name: 'Log in', level: 1 })).toBeTruthy();
    expect(screen.getByText('Use the email and password set up for the Rector.')).toBeTruthy();
  });

  it('has a panel about EVLOS beside the form, with the sun path of the Pooja Window', async () => {
    await open();

    const about = screen.getByRole('complementary', { name: 'About EVLOS' });

    expect(within(about).getByText('Every Pooja Punch, from sunrise to the evening.')).toBeTruthy();
    expect(
      within(about).getByText('For the hostel Rector. Students do not need an account.'),
    ).toBeTruthy();
    expect(
      within(about).getByRole('img', { name: /Pooja Window drawn as the sun's path/ }),
    ).toBeTruthy();
  });

  it('keeps Forgot password? beside the Password label, out of the way of the Log in button', async () => {
    await open();

    const forgot = screen.getByRole('button', { name: 'Forgot password?' });
    const label = screen.getByText('Password', { selector: 'label' });

    expect(label.parentElement?.contains(forgot)).toBe(true);
  });

  it('shows the password only while Show is on, and hides it again', async () => {
    await open();
    const box = screen.getByLabelText<HTMLInputElement>('Password');
    expect(box.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(box.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(box.type).toBe('password');
  });

  it('explains a wrong password in a box, with what to check', async () => {
    await open('refused');

    fillAndSend('rector@example.com', 'wrong password');

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('Email or password is wrong.')).toBeTruthy();
    expect(
      within(alert).getByText(
        'Check Caps Lock, then try again. After too many tries you wait 15 minutes.',
      ),
    ).toBeTruthy();
  });

  it('marks the password box when the password is wrong', async () => {
    await open('refused');

    fillAndSend('rector@example.com', 'wrong password');

    await screen.findByRole('alert');
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).not.toBe('true');
  });

  it('shows no problem before anything is sent', async () => {
    await open();

    expect(screen.queryByRole('alert')).toBeNull();
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

  it('has its own title and says what will be sent', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByRole('heading', { name: 'Forgot password', level: 1 })).toBeTruthy();
    expect(
      screen.getByText(
        'Type the email you log in with. A link to set a new password will be sent to it.',
      ),
    ).toBeTruthy();
  });

  it('says Check your email once the link is asked for, and offers to send it again', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);
    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'rector@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send link' }));

    const status = await screen.findByRole('status');
    expect(within(status).getByText('Check your email.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send the link again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send link' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Email').value).toBe('rector@example.com');
  });

  it('goes back to the login form', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Log in' }));

    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send link' })).toBeNull();
  });

  it('keeps the panel about EVLOS beside the form', async () => {
    render(<LoginGate auth={fakeAuth(null).auth}>{page}</LoginGate>);

    fireEvent.click(await screen.findByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByRole('complementary', { name: 'About EVLOS' })).toBeTruthy();
  });
});
