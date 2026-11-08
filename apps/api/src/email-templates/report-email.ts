import { escapeHtml } from './html.js';
import {
  FONT_BODY,
  FONT_DISPLAY,
  fileList,
  heading,
  MUTED,
  paragraph,
  subheading,
  tilesPage,
} from './tiles-layout.js';

export type StatusName = 'Present' | 'Absent' | 'Needs Review' | 'Pending' | 'Not Applicable';

export interface StatusCount {
  name: StatusName;
  count: number;
}

// What the Daily Report and the Monthly Report email say, for the HTML version. The sentences
// are those of the plain-text email, so both versions tell the Rector the same things.
export interface ReportEmailFields {
  // "Daily Report" or "Monthly Report".
  title: string;
  // The Day or month it is for, such as "Wednesday 4 November 2026".
  about: string;
  // A line above the counts, or null.
  intro: string | null;
  // The Pooja Statuses that have a count; one a Student has none of is not in the list.
  counts: readonly StatusCount[];
  // Said instead of the counts when there are none.
  emptyText: string;
  paragraphs: readonly string[];
  // The names of the attached files.
  files: readonly string[];
}

interface Colours {
  wash: string;
  ink: string;
  solid: string;
}

// As in the web app: green for Present, red for Absent, amber for Needs Review.
const COLOURS: Record<StatusName, Colours> = {
  Present: { wash: '#DDF0E3', ink: '#1E6B3A', solid: '#2E8B3E' },
  Absent: { wash: '#F9E3E3', ink: '#A12A2A', solid: '#D13B35' },
  'Needs Review': { wash: '#FFF6E5', ink: '#7A4F00', solid: '#E9B44C' },
  Pending: { wash: '#E8EBF8', ink: '#2D3A8C', solid: '#8A93D0' },
  'Not Applicable': { wash: '#ECEDF3', ink: '#4A4F72', solid: '#8A8FB0' },
};

const PER_ROW = 3;
const GAP = '<td width="8" style="font-size:0;line-height:0;">&nbsp;</td>';
const EMPTY_TILE = '<td width="33%" style="font-size:0;line-height:0;">&nbsp;</td>';

function tile({ name, count }: StatusCount): string {
  const { wash, ink, solid } = COLOURS[name];
  return (
    `<td width="33%" valign="top" style="background:${wash};border-top:4px solid ${solid};border-radius:8px;padding:12px 10px 10px;">` +
    `<div style="font:800 36px/40px ${FONT_DISPLAY};color:${ink};">${String(count)}</div>` +
    `<div style="font:700 12px/16px ${FONT_BODY};color:${ink};padding-top:2px;">${name}</div></td>`
  );
}

// Three tiles to a row; a short last row is padded so its tiles are as wide as the others.
function tileRows(counts: readonly StatusCount[]): string {
  const rows: string[] = [];
  for (let start = 0; start < counts.length; start += PER_ROW) {
    const cells = counts.slice(start, start + PER_ROW).map(tile);
    while (cells.length < PER_ROW) cells.push(EMPTY_TILE);
    rows.push(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>${cells.join(GAP)}</tr></table>`,
    );
  }
  return rows.join('');
}

function countsBlock({ counts, emptyText, intro }: ReportEmailFields): string {
  if (counts.length === 0) return paragraph(escapeHtml(emptyText));
  const lead = intro === null ? '' : paragraph(escapeHtml(intro), MUTED);
  return `${lead}${tileRows(counts)}<div style="height:10px;font-size:0;line-height:0;">&nbsp;</div>`;
}

export function reportEmailHtml(fields: ReportEmailFields): string {
  const content = `${heading(fields.title)}
${subheading(fields.about)}
${countsBlock(fields)}
${fields.paragraphs.map((text) => paragraph(escapeHtml(text))).join('\n')}
${fileList(fields.files)}`;
  return tilesPage(`${fields.title}: ${fields.about}`, content);
}
