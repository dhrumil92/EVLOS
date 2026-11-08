import { describe, expect, it } from 'vitest';
import { LOGO_CID } from './email-images.js';
import { reviewReminderHtml } from './review-reminder.js';

const DAY = '2026-11-03';
const STUDENTS = [
  { room: '205', name: 'Bina Rao', studentId: '9002' },
  { room: '310', name: 'Chitra Rao', studentId: '9003' },
];

describe('reviewReminderHtml', () => {
  it('says the Day is not Finalized yet', () => {
    const html = reviewReminderHtml({ day: DAY, students: STUDENTS });

    expect(html).toContain('Tuesday 3 November 2026 is not Finalized yet.');
  });

  it('lists each Student on Needs Review with room, name and Student ID', () => {
    const html = reviewReminderHtml({ day: DAY, students: STUDENTS });

    for (const text of ['205', 'Bina Rao', '9002', '310', 'Chitra Rao', '9003']) {
      expect(html).toContain(`>${text}<`);
    }
    expect(html).toContain('>Needs Review<');
  });

  it('lists the Students in the order given', () => {
    const html = reviewReminderHtml({ day: DAY, students: STUDENTS });

    expect(html.indexOf('Bina Rao')).toBeLessThan(html.indexOf('Chitra Rao'));
  });

  it('keeps the words of the plain-text email, including what the Rector should do', () => {
    const html = reviewReminderHtml({ day: DAY, students: STUDENTS });

    expect(html).toContain('so they are on Needs Review:');
    expect(html).toContain('then Finalize the Day on the Review page.');
  });

  it('cannot be broken by a name with HTML in it', () => {
    const html = reviewReminderHtml({
      day: DAY,
      students: [{ room: '1', name: '<i>Bina</i>', studentId: '9' }],
    });

    expect(html).not.toContain('<i>Bina</i>');
    expect(html).toContain('&lt;i&gt;Bina&lt;/i&gt;');
  });

  it('is in the same design as every other email', () => {
    expect(reviewReminderHtml({ day: DAY, students: STUDENTS })).toContain(`cid:${LOGO_CID}`);
  });
});
