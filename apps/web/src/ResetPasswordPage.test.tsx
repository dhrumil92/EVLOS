// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

function typeTwice(first: string, again: string) {
  type('New password', first);
  type('New password again', again);
  fireEvent.click(screen.getByRole('button', { name: 'Save new password' }));
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
    expect(screen.queryByRole('button', { name: 'Save new password' })).toBeNull();
  });
});

describe('the Set a new password screen', () => {
  it('has the title, and says what saving does', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);

    expect(screen.getByRole('heading', { name: 'Set a new password', level: 1 })).toBeTruthy();
    expect(
      screen.getByText(
        'At least 12 characters. Saving ends every login, so you log in again with the new one.',
      ),
    ).toBeTruthy();
  });

  it('keeps the panel about EVLOS beside the form', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);

    expect(screen.getByRole('complementary', { name: 'About EVLOS' })).toBeTruthy();
  });

  it('says how many more characters are needed, as the new password is typed', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);

    expect(screen.getByText('At least 12 characters.')).toBeTruthy();
    type('New password', 'abcdefghi');

    expect(screen.getByText('3 more characters needed')).toBeTruthy();
  });

  it('says when the new password is long enough, and fills the bar', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);

    type('New password', 'morning pooja at 6');

    expect(screen.getByText('18 characters, long enough')).toBeTruthy();
    const bar = screen.getByTestId('length-bar');
    expect(bar.querySelectorAll('[data-filled="true"]')).toHaveLength(12);
  });

  it('shows the new password only while Show is on', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);
    const box = screen.getByLabelText<HTMLInputElement>('New password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(box.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(box.type).toBe('password');
  });

  it('says the two passwords match, or not yet, as the second is typed', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);
    type('New password', 'a new long password');

    type('New password again', 'a new long');
    expect(screen.getByText('Not the same as the new password yet')).toBeTruthy();
    expect(screen.getByLabelText('New password again').getAttribute('aria-invalid')).toBe('true');

    type('New password again', 'a new long password');
    expect(screen.getByText('The two passwords match')).toBeTruthy();
  });

  it('has one form with both password boxes and the Save new password button', () => {
    render(<ResetPasswordPage auth={fakeAuth().auth} token="the-token" />);

    const form = screen.getByRole('form', { name: 'Set a new password' });

    expect(within(form).getByLabelText('New password')).toBeTruthy();
    expect(within(form).getByLabelText('New password again')).toBeTruthy();
    expect(within(form).getByRole('button', { name: 'Save new password' })).toBeTruthy();
  });
});
