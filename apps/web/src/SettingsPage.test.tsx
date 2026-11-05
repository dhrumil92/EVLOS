// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { SettingsSource } from './settings-source.js';
import { SettingsPage } from './SettingsPage.js';

const NO_ONE =
  'No one will receive the Review Reminder, Daily Report or Monthly Report. Add an address below.';

// Keeps the list in memory, and refuses an address without an @ as the server would.
function fakeSource(start: string[] = []) {
  const emails = [...start];
  const changes: [string, string][] = [];
  const source: SettingsSource = {
    reportRecipients: () => Promise.resolve([...emails]),
    addReportRecipient: (email) => {
      if (!email.includes('@')) return Promise.resolve('This is not an email address.');
      emails.push(email);
      return Promise.resolve('done');
    },
    removeReportRecipient: (email) => {
      emails.splice(emails.indexOf(email), 1);
      return Promise.resolve('done');
    },
    changePassword: (currentPassword, newPassword) => {
      changes.push([currentPassword, newPassword]);
      return Promise.resolve(
        currentPassword === 'the current password' ? 'done' : 'The current password is wrong.',
      );
    },
  };
  return { source, emails, changes };
}

const listed = () =>
  within(screen.getByRole('list', { name: 'Report Recipients' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);

function typeAndAdd(email: string) {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

function fillPassword(current: string, first: string, again: string) {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: first } });
  fireEvent.change(screen.getByLabelText('New password again'), { target: { value: again } });
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

const passwordBoxes = () =>
  ['Current password', 'New password', 'New password again'].map(
    (label) => screen.getByLabelText<HTMLInputElement>(label).value,
  );

afterEach(cleanup);

describe('Settings page', () => {
  it('lists the Report Recipients', async () => {
    render(<SettingsPage source={fakeSource(['office@example.com']).source} />);

    await screen.findByText('office@example.com');
    expect(listed()).toEqual(['office@example.com']);
    expect(screen.queryByText(NO_ONE)).toBeNull();
  });

  it('warns when there is no Report Recipient', async () => {
    render(<SettingsPage source={fakeSource().source} />);

    expect(await screen.findByText(NO_ONE)).toBeTruthy();
  });

  it('adds the address typed in, then clears the box', async () => {
    const { source, emails } = fakeSource();
    render(<SettingsPage source={source} />);
    await screen.findByText(NO_ONE);

    typeAndAdd('office@example.com');

    await screen.findByText('office@example.com');
    expect(emails).toEqual(['office@example.com']);
    expect(screen.getByLabelText<HTMLInputElement>('Email address').value).toBe('');
  });

  it('shows why an address was refused, and keeps what was typed', async () => {
    render(<SettingsPage source={fakeSource().source} />);
    await screen.findByText(NO_ONE);

    typeAndAdd('office at example');

    expect(await screen.findByText('This is not an email address.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Email address').value).toBe(
      'office at example',
    );
  });

  it('asks before removing, and keeps the address on Cancel', async () => {
    const { source, emails } = fakeSource(['office@example.com']);
    render(<SettingsPage source={source} />);
    await screen.findByText('office@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Remove office@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(emails).toEqual(['office@example.com']);
    expect(screen.queryByRole('group', { name: 'Confirm' })).toBeNull();
  });

  it('removes the address once the Rector says yes', async () => {
    const { source, emails } = fakeSource(['office@example.com', 'rector@example.com']);
    render(<SettingsPage source={source} />);
    await screen.findByText('office@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Remove office@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    await screen.findByText('rector@example.com');
    expect(emails).toEqual(['rector@example.com']);
    expect(screen.queryByText('office@example.com')).toBeNull();
  });

  it('says so when the list cannot load', async () => {
    const source: SettingsSource = {
      ...fakeSource().source,
      reportRecipients: () => Promise.reject(new Error('down')),
    };

    render(<SettingsPage source={source} />);

    expect(
      await screen.findByText('The Report Recipients could not load. Reload the page.'),
    ).toBeTruthy();
  });
});

describe('Change password', () => {
  it('changes the password, says other logins have ended, and empties the boxes', async () => {
    const { source, changes } = fakeSource();
    render(<SettingsPage source={source} />);

    fillPassword('the current password', 'a new long password', 'a new long password');

    expect(
      await screen.findByText('Password changed. Every other login has been ended.'),
    ).toBeTruthy();
    expect(changes).toEqual([['the current password', 'a new long password']]);
    expect(passwordBoxes()).toEqual(['', '', '']);
  });

  it('sends nothing when the two new passwords differ', async () => {
    const { source, changes } = fakeSource();
    render(<SettingsPage source={source} />);

    fillPassword('the current password', 'a new long password', 'a new long passwrod');

    expect(await screen.findByText('The two new passwords are not the same.')).toBeTruthy();
    expect(changes).toEqual([]);
  });

  it('shows why the change was refused, and keeps what was typed', async () => {
    render(<SettingsPage source={fakeSource().source} />);

    fillPassword('not the password', 'a new long password', 'a new long password');

    expect(await screen.findByText('The current password is wrong.')).toBeTruthy();
    expect(passwordBoxes()).toEqual([
      'not the password',
      'a new long password',
      'a new long password',
    ]);
  });
});
