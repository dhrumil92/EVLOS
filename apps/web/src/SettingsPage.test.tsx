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
  };
  return { source, emails };
}

const listed = () =>
  within(screen.getByRole('list', { name: 'Report Recipients' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('span')?.textContent);

function typeAndAdd(email: string) {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

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
