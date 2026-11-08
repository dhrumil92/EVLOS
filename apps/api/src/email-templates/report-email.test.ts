import { describe, expect, it } from 'vitest';
import { LOGO_CID, WORDMARK_CID } from './email-images.js';
import { reportEmailHtml } from './report-email.js';
import type { ReportEmailFields } from './report-email.js';

const FIELDS: ReportEmailFields = {
  title: 'Daily Report',
  about: 'Wednesday 4 November 2026',
  intro: null,
  counts: [
    { name: 'Present', count: 112 },
    { name: 'Absent', count: 6 },
    { name: 'Not Applicable', count: 14 },
  ],
  emptyText: 'No Student was Active on this Day.',
  paragraphs: ['The full Report is attached as an Excel file, with each Pooja Status in colour.'],
  files: ['Day Report.xlsx', 'Day Vidyalaya Presence.xlsx'],
};

describe('reportEmailHtml', () => {
  it('shows what the Report is and which Day or month it is for', () => {
    const html = reportEmailHtml(FIELDS);

    expect(html).toContain('>Daily Report<');
    expect(html).toContain('>Wednesday 4 November 2026<');
  });

  it('shows each Pooja Status with its count', () => {
    const html = reportEmailHtml(FIELDS);

    expect(html).toContain('>112<');
    expect(html).toContain('>Present<');
    expect(html).toContain('>6<');
    expect(html).toContain('>Absent<');
    expect(html).toContain('>14<');
    expect(html).toContain('>Not Applicable<');
  });

  it('leaves out a Pooja Status that has no count', () => {
    const html = reportEmailHtml(FIELDS);

    expect(html).not.toContain('>Needs Review<');
    expect(html).not.toContain('>Pending<');
  });

  it('shows every Pooja Status it is given, even when there are more than three', () => {
    const counts = [
      { name: 'Present', count: 1 },
      { name: 'Absent', count: 2 },
      { name: 'Needs Review', count: 3 },
      { name: 'Pending', count: 4 },
      { name: 'Not Applicable', count: 5 },
    ] as const;

    const html = reportEmailHtml({ ...FIELDS, counts: [...counts] });

    for (const { name } of counts) expect(html).toContain(`>${name}<`);
  });

  it('says no Student was Active, and shows no counts, when there are none', () => {
    const html = reportEmailHtml({ ...FIELDS, counts: [] });

    expect(html).toContain('No Student was Active on this Day.');
    expect(html).not.toContain('>Present<');
  });

  it('writes the line above the counts when there is one', () => {
    const html = reportEmailHtml({
      ...FIELDS,
      intro: 'Pooja Statuses in the month, one for each Student on each Day:',
    });

    expect(html).toContain('Pooja Statuses in the month, one for each Student on each Day:');
  });

  it('keeps every sentence of the plain-text email', () => {
    const html = reportEmailHtml(FIELDS);

    expect(html).toContain(
      'The full Report is attached as an Excel file, with each Pooja Status in colour.',
    );
  });

  it('names each attached file, in order', () => {
    const html = reportEmailHtml(FIELDS);

    const first = html.indexOf('Day Report.xlsx');
    const second = html.indexOf('Day Vidyalaya Presence.xlsx');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it('shows no file list when nothing is attached', () => {
    const html = reportEmailHtml({ ...FIELDS, files: [] });

    expect(html).not.toContain('.xlsx');
  });

  it('cannot be broken by HTML in a sentence', () => {
    const html = reportEmailHtml({ ...FIELDS, paragraphs: ['Not Finalized: <b>2026-11-03</b>'] });

    expect(html).not.toContain('<b>2026-11-03</b>');
    expect(html).toContain('Not Finalized: &lt;b&gt;2026-11-03&lt;/b&gt;');
  });

  it('is in the same design as every other email, with the logo and the evlos wordmark', () => {
    const html = reportEmailHtml(FIELDS);

    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    expect(html).toContain(`src="cid:${WORDMARK_CID}"`);
  });
});
