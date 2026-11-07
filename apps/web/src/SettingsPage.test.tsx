// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceStatus, DeviceStatusSource } from './device-status-source.js';
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

const SEEN_AT = Date.parse('2026-11-07T19:36:00+05:30');

const deviceWith = (status: DeviceStatus): DeviceStatusSource => ({
  load: () => Promise.resolve(status),
});

function show(
  source: SettingsSource,
  device: DeviceStatus = { lastSeenAt: SEEN_AT, isQuiet: false },
) {
  render(<SettingsPage source={source} device={deviceWith(device)} />);
}

const listed = () =>
  within(screen.getByRole('list', { name: 'Report Recipients' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('strong')?.textContent);

function typeAndAdd(email: string) {
  fireEvent.change(screen.getByLabelText('Add an address'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

function fillPassword(current: string, first: string, again: string) {
  type('Current password', current);
  type('New password', first);
  type('New password again', again);
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
}

const passwordBoxes = () =>
  ['Current password', 'New password', 'New password again'].map(
    (label) => screen.getByLabelText<HTMLInputElement>(label).value,
  );

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(cleanup);

describe('Settings page', () => {
  it('has the title, and the section menu with the three sections', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);

    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeTruthy();
    const menu = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(
      within(menu)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Report Recipients', 'Your password', 'Device and times']);
  });

  it('has a card for each of the three sections', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);

    expect(screen.getByRole('region', { name: 'Report Recipients' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Your password' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Device and times' })).toBeTruthy();
  });

  it('scrolls to a card when its name is pressed in the menu, and marks it as the current one', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);
    const menu = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(
      within(menu).getByRole('button', { name: 'Report Recipients' }).getAttribute('aria-current'),
    ).toBe('true');

    fireEvent.click(within(menu).getByRole('button', { name: 'Your password' }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(
      within(menu).getByRole('button', { name: 'Your password' }).getAttribute('aria-current'),
    ).toBe('true');
    expect(
      within(menu).getByRole('button', { name: 'Report Recipients' }).getAttribute('aria-current'),
    ).toBeNull();
  });

  it('does not change the web address when the menu is used', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);
    const before = window.location.href;

    fireEvent.click(screen.getByRole('button', { name: 'Device and times' }));

    expect(window.location.href).toBe(before);
  });
});

describe('Report Recipients', () => {
  it('says what the addresses receive', async () => {
    show(fakeSource(['office@example.com']).source);
    await screen.findByText('office@example.com');
    const card = screen.getByRole('region', { name: 'Report Recipients' });

    expect(within(card).getByText('Review Reminder')).toBeTruthy();
    expect(within(card).getByText('At 23:00')).toBeTruthy();
    expect(within(card).getByText('Daily Report')).toBeTruthy();
    expect(within(card).getByText('At 23:30, every night')).toBeTruthy();
    expect(within(card).getByText('Monthly Report')).toBeTruthy();
    expect(within(card).getByText('At 09:00 on the 1st')).toBeTruthy();
  });

  it('lists the Report Recipients, and says how many there are', async () => {
    show(fakeSource(['office@example.com', 'rector@example.com']).source);

    await screen.findByText('office@example.com');
    expect(listed()).toEqual(['office@example.com', 'rector@example.com']);
    expect(screen.getByText('Sent to 2 addresses')).toBeTruthy();
    expect(screen.queryByText(NO_ONE)).toBeNull();
  });

  it('says 1 address, not 1 addresses', async () => {
    show(fakeSource(['office@example.com']).source);

    expect(await screen.findByText('Sent to 1 address')).toBeTruthy();
  });

  it('shows the first letter of each address in a circle', async () => {
    show(fakeSource(['rector.office@example.com']).source);
    await screen.findByText('rector.office@example.com');

    expect(
      within(screen.getByRole('list', { name: 'Report Recipients' })).getByText('R'),
    ).toBeTruthy();
  });

  it('warns when there is no Report Recipient', async () => {
    show(fakeSource().source);

    expect(await screen.findByText(NO_ONE)).toBeTruthy();
    expect(screen.queryByText(/^Sent to/)).toBeNull();
  });

  it('adds the address typed in, then clears the box', async () => {
    const { source, emails } = fakeSource();
    show(source);
    await screen.findByText(NO_ONE);

    typeAndAdd('office@example.com');

    await screen.findByText('office@example.com');
    expect(emails).toEqual(['office@example.com']);
    expect(screen.getByLabelText<HTMLInputElement>('Add an address').value).toBe('');
  });

  it('explains the box with a help line', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);

    expect(screen.getByLabelText('Add an address').getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText(/If the list is empty, nobody gets them/)).toBeTruthy();
  });

  it('shows why an address was refused, and keeps what was typed', async () => {
    show(fakeSource().source);
    await screen.findByText(NO_ONE);

    typeAndAdd('office at example');

    expect(await screen.findByText('This is not an email address.')).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>('Add an address').value).toBe(
      'office at example',
    );
  });

  it('asks on the same row before removing, and keeps the address on Keep', async () => {
    const { source, emails } = fakeSource(['office@example.com']);
    show(source);
    await screen.findByText('office@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Remove office@example.com' }));
    expect(screen.getByText('Stop sending the reports to this address?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(emails).toEqual(['office@example.com']);
    expect(screen.queryByText('Stop sending the reports to this address?')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove office@example.com' })).toBeTruthy();
  });

  it('asks about one address at a time', async () => {
    show(fakeSource(['office@example.com', 'rector@example.com']).source);
    await screen.findByText('office@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Remove office@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove rector@example.com' }));

    expect(screen.getAllByText('Stop sending the reports to this address?')).toHaveLength(1);
  });

  it('removes the address once the Rector says yes', async () => {
    const { source, emails } = fakeSource(['office@example.com', 'rector@example.com']);
    show(source);
    await screen.findByText('office@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Remove office@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }));

    await screen.findByText('Sent to 1 address');
    expect(emails).toEqual(['rector@example.com']);
    expect(screen.queryByText('office@example.com')).toBeNull();
  });

  it('says so when the list cannot load', async () => {
    const source: SettingsSource = {
      ...fakeSource().source,
      reportRecipients: () => Promise.reject(new Error('down')),
    };

    show(source);

    expect(
      await screen.findByText('The Report Recipients could not load. Reload the page.'),
    ).toBeTruthy();
  });
});

describe('Your password', () => {
  it('changes the password, says other logins have ended, and empties the boxes', async () => {
    const { source, changes } = fakeSource();
    show(source);

    fillPassword('the current password', 'a new long password', 'a new long password');

    expect(
      await screen.findByText('Password changed. Every other login has been ended.'),
    ).toBeTruthy();
    expect(changes).toEqual([['the current password', 'a new long password']]);
    expect(passwordBoxes()).toEqual(['', '', '']);
  });

  it('sends nothing when the two new passwords differ', async () => {
    const { source, changes } = fakeSource();
    show(source);

    fillPassword('the current password', 'a new long password', 'a new long passwrod');

    expect(await screen.findByText('The two new passwords are not the same.')).toBeTruthy();
    expect(changes).toEqual([]);
  });

  it('shows why the change was refused, and keeps what was typed', async () => {
    show(fakeSource().source);

    fillPassword('not the password', 'a new long password', 'a new long password');

    expect(await screen.findByText('The current password is wrong.')).toBeTruthy();
    expect(passwordBoxes()).toEqual([
      'not the password',
      'a new long password',
      'a new long password',
    ]);
  });

  it('says how many more characters the new password needs, as it is typed', () => {
    show(fakeSource().source);

    expect(screen.getByText('At least 12 characters.')).toBeTruthy();
    type('New password', 'abcd');

    expect(screen.getByText('8 more characters needed')).toBeTruthy();
  });

  it('says when the new password is long enough', () => {
    show(fakeSource().source);

    type('New password', 'morning pooja at 6');

    expect(screen.getByText('18 characters, long enough')).toBeTruthy();
  });

  it('fills a segment of the bar for each character, up to twelve', () => {
    show(fakeSource().source);

    type('New password', 'abcde');

    const bar = screen.getByTestId('length-bar');
    expect(bar.children).toHaveLength(12);
    expect(bar.querySelectorAll('[data-filled="true"]')).toHaveLength(5);

    type('New password', 'morning pooja at 6');
    expect(bar.querySelectorAll('[data-filled="true"]')).toHaveLength(12);
  });

  it('shows the password only while Show is on, and hides it again', () => {
    show(fakeSource().source);
    const box = screen.getByLabelText<HTMLInputElement>('New password');
    expect(box.type).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(box.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(box.type).toBe('password');
  });

  it('says nothing about a match until something is typed in the second box', () => {
    show(fakeSource().source);
    type('New password', 'a new long password');

    expect(screen.queryByText('Not the same as the new password yet')).toBeNull();
    expect(screen.queryByText('The two passwords match')).toBeNull();
  });

  it('says the two are not the same yet while they differ, and marks the box', () => {
    show(fakeSource().source);
    type('New password', 'a new long password');

    type('New password again', 'a new long');

    expect(screen.getByText('Not the same as the new password yet')).toBeTruthy();
    expect(screen.getByLabelText('New password again').getAttribute('aria-invalid')).toBe('true');
  });

  it('says the two match once they do', () => {
    show(fakeSource().source);
    type('New password', 'a new long password');

    type('New password again', 'a new long password');

    expect(screen.getByText('The two passwords match')).toBeTruthy();
    expect(screen.getByLabelText('New password again').getAttribute('aria-invalid')).not.toBe(
      'true',
    );
  });

  it('explains the 12 characters and that other logins end', () => {
    show(fakeSource().source);

    expect(screen.getByText(/Use at least 12 characters/)).toBeTruthy();
    expect(
      screen.getByText(/every other login, on a phone or another computer, is ended/),
    ).toBeTruthy();
  });
});

describe('Device and times', () => {
  it('shows when the Device was last seen', async () => {
    show(fakeSource().source);

    expect(await screen.findByText('Last seen 7 Nov, 19:36')).toBeTruthy();
  });

  it('warns when the Device has gone quiet', async () => {
    show(fakeSource().source, { lastSeenAt: SEEN_AT, isQuiet: true });

    expect(await screen.findByText(/Last seen 7 Nov, 19:36/)).toBeTruthy();
    expect(screen.getByText(/has gone quiet/)).toBeTruthy();
  });

  it('says so when the Device has never been in touch', async () => {
    show(fakeSource().source, { lastSeenAt: null, isQuiet: false });

    expect(await screen.findByText('Not in touch yet')).toBeTruthy();
  });

  it('gives the Pooja Window and the time zone', () => {
    show(fakeSource().source);
    const card = screen.getByRole('region', { name: 'Device and times' });

    expect(within(card).getByText('05:30 to 18:00, both included')).toBeTruthy();
    expect(within(card).getByText('India Standard Time')).toBeTruthy();
  });

  it('has nothing to change: no input and no button inside it', () => {
    show(fakeSource().source);
    const card = screen.getByRole('region', { name: 'Device and times' });

    expect(within(card).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(card).queryAllByRole('button')).toHaveLength(0);
  });
});
