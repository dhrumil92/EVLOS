// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AuthSource } from './auth-source.js';
import { ResetPasswordPage } from './ResetPasswordPage.js';

// Accepts the link token 'the-token' once.
function fakeAuth() {
  const used: [string, string][] = [];
  const auth: AuthSource = {
    me: () => Promise.resolve(null),
    logIn: () => Promise.resolve('refused'),
    logOut: () => Promise.resolve(),
    requestPasswordReset: () => Promise.resolve('sent'),
    resetPassword: (token, newPassword) => {
      if (token !== 'the-token' || used.length > 0) {
        return Promise.resolve('This link has expired or was already used. Ask for a new one.');
      }
      used.push([token, newPassword]);
      return Promise.resolve('done');
    },
  };
  return { auth, used };
}

function typeTwice(first: string, again: string) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: first } });
  fireEvent.change(screen.getByLabelText('New password again'), { target: { value: again } });
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
}

afterEach(cleanup);

describe('Reset password page', () => {
  it('sets the new password from the link and points to the login page', async () => {
    const { auth, used } = fakeAuth();
    render(<ResetPasswordPage auth={auth} token="the-token" />);

    typeTwice('a new long password', 'a new long password');

    expect(
      await screen.findByText(
        'Your password has been changed and every login has ended. Log in with the new password.',
      ),
    ).toBeTruthy();
    expect(used).toEqual([['the-token', 'a new long password']]);
    expect(screen.getByRole('link', { name: 'Go to log in' }).getAttribute('href')).toBe('/');
  });

  it('sends nothing when the two new passwords differ', async () => {
    const { auth, used } = fakeAuth();
    render(<ResetPasswordPage auth={auth} token="the-token" />);

    typeTwice('a new long password', 'a new long passwrod');

    expect(await screen.findByText('The two new passwords are not the same.')).toBeTruthy();
    expect(used).toEqual([]);
  });

  it('says why a link cannot be used', async () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="an-old-token" />);

    typeTwice('a new long password', 'a new long password');

    expect(
      await screen.findByText('This link has expired or was already used. Ask for a new one.'),
    ).toBeTruthy();
  });

  it('asks for a new link when the link has no token', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="" />);

    expect(
      screen.getByText('This link is not complete. Ask for a new one from the login page.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set new password' })).toBeNull();
  });
});
