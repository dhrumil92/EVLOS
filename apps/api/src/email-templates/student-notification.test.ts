import { describe, expect, it } from 'vitest';
import { LOGO_CID, WORDMARK_CID } from './email-images.js';
import { studentNotificationHtml } from './student-notification.js';

const DAY = '2026-11-03';

describe('studentNotificationHtml', () => {
  it('names the Student and the Day, and shows the Pooja Status Absent', () => {
    const html = studentNotificationHtml({ name: 'Asha Rao', day: DAY });

    expect(html).toContain('Dear Asha Rao,');
    expect(html).toContain('Tuesday 3 November 2026');
    expect(html).toContain('Absent');
  });

  it('keeps the words of the plain-text email, including the line about the Rector', () => {
    const html = studentNotificationHtml({ name: 'Asha Rao', day: DAY });

    expect(html).toContain('and you were in the hostel that day.');
    expect(html).toContain('If you think this is a mistake, please speak to the Rector.');
  });

  it('shows the Day as a calendar block', () => {
    const html = studentNotificationHtml({ name: 'Asha Rao', day: DAY });

    expect(html).toMatch(/>Nov</);
    expect(html).toMatch(/>3</);
    expect(html).toMatch(/>Tuesday</);
  });

  it('shows the logo and the evlos wordmark from the images inside the email', () => {
    const html = studentNotificationHtml({ name: 'Asha Rao', day: DAY });

    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    expect(html).toContain(`src="cid:${WORDMARK_CID}"`);
  });

  it('cannot be broken by a name with HTML in it', () => {
    const html = studentNotificationHtml({ name: '<b>Asha</b> & Co', day: DAY });

    expect(html).not.toContain('<b>Asha</b>');
    expect(html).toContain('Dear &lt;b&gt;Asha&lt;/b&gt; &amp; Co,');
  });

  it('is a whole page that says what language it is in', () => {
    const html = studentNotificationHtml({ name: 'Asha Rao', day: DAY });

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="en">');
  });
});
