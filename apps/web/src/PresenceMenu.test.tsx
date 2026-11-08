// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PresenceMenu } from './PresenceMenu.js';

const TODAY = '2026-11-08';

const open = () => {
  render(<PresenceMenu today={TODAY} />);
  fireEvent.click(screen.getByRole('button', { name: 'Vidyalaya Presence' }));
  return screen.getByRole('group', { name: 'Vidyalaya Presence' });
};

const download = () => screen.getByRole('link', { name: 'Download Vidyalaya Presence as Excel' });

afterEach(cleanup);

describe('the Vidyalaya Presence menu', () => {
  it('is a button named Vidyalaya Presence, closed at first', () => {
    render(<PresenceMenu today={TODAY} />);

    const button = screen.getByRole('button', { name: 'Vidyalaya Presence' });

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('group', { name: 'Vidyalaya Presence' })).toBeNull();
  });

  it('offers a Day or a Month, and no range of dates', () => {
    const panel = open();

    const choices = within(within(panel).getByRole('group', { name: 'Period' })).getAllByRole(
      'button',
    );

    expect(choices.map((one) => one.textContent)).toEqual(['Day', 'Month']);
    expect(within(panel).queryByText('Pick dates')).toBeNull();
    expect(within(panel).queryByLabelText('From')).toBeNull();
  });

  it('starts on the Day, with today filled in and no later date allowed', () => {
    const panel = open();

    const field = within(panel).getByLabelText<HTMLInputElement>('Day');

    expect(field.type).toBe('date');
    expect(field.value).toBe(TODAY);
    expect(field.max).toBe(TODAY);
    expect(within(panel).getByRole('button', { name: 'Day' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('downloads Excel for the Day in one press', () => {
    open();

    expect(download().getAttribute('href')).toBe(
      '/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-08',
    );
    expect(download().hasAttribute('download')).toBe(true);
  });

  it('follows the Day the Rector picks', () => {
    const panel = open();

    fireEvent.change(within(panel).getByLabelText('Day'), { target: { value: '2026-11-03' } });

    expect(download().getAttribute('href')).toBe(
      '/api/vidyalaya-presence/xlsx?view=Day&day=2026-11-03',
    );
  });

  it('keeps the last Day when the box is emptied', () => {
    const panel = open();

    fireEvent.change(within(panel).getByLabelText('Day'), { target: { value: '' } });

    expect(download().getAttribute('href')).toContain('day=2026-11-08');
  });

  it('shows a month field, this month filled in, when Month is chosen', () => {
    const panel = open();

    fireEvent.click(within(panel).getByRole('button', { name: 'Month' }));

    const field = within(panel).getByLabelText<HTMLInputElement>('Month');
    expect(field.type).toBe('month');
    expect(field.value).toBe('2026-11');
    expect(field.max).toBe('2026-11');
    expect(within(panel).queryByLabelText('Day')).toBeNull();
  });

  it('downloads the month the Rector picks', () => {
    const panel = open();
    fireEvent.click(within(panel).getByRole('button', { name: 'Month' }));

    fireEvent.change(within(panel).getByLabelText('Month'), { target: { value: '2026-10' } });

    expect(download().getAttribute('href')).toBe(
      '/api/vidyalaya-presence/xlsx?view=Month&month=2026-10',
    );
  });

  it('remembers the Day when the Rector goes to Month and back', () => {
    const panel = open();
    fireEvent.change(within(panel).getByLabelText('Day'), { target: { value: '2026-11-03' } });

    fireEvent.click(within(panel).getByRole('button', { name: 'Month' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Day' }));

    expect(within(panel).getByLabelText<HTMLInputElement>('Day').value).toBe('2026-11-03');
  });

  it('closes after the download is pressed', () => {
    open();
    // jsdom cannot follow a download link, so the click is stopped before it tries.
    download().addEventListener('click', (event) => {
      event.preventDefault();
    });

    fireEvent.click(download());

    expect(screen.queryByRole('group', { name: 'Vidyalaya Presence' })).toBeNull();
  });

  it('closes with Escape, and when the page is pressed outside it', () => {
    const panel = open();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Vidyalaya Presence' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Vidyalaya Presence' }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('group', { name: 'Vidyalaya Presence' })).toBeNull();
  });

  it('says what the file holds: who was In hostel and who was Away', () => {
    const panel = open();

    expect(within(panel).getByText(/In hostel or Away/)).toBeTruthy();
  });
});
