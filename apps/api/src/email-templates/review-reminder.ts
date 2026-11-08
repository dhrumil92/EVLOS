import type { Day } from '@evlos/core';
import { dayInWords } from '../use-cases/day-in-words.js';
import { escapeHtml } from './html.js';
import {
  FONT_BODY,
  heading,
  INK,
  LINE,
  MUTED,
  NEEDS_REVIEW_BADGE,
  paragraph,
  statusBadge,
  tilesPage,
} from './tiles-layout.js';

export interface ReminderStudent {
  room: string;
  name: string;
  studentId: string;
}

export interface ReviewReminderFields {
  day: Day;
  // Already in the order they are written, by room and then name.
  students: readonly ReminderStudent[];
}

const cell = (text: string, style = '') =>
  `<td style="padding:8px 10px;border-bottom:1px solid ${LINE};font:400 13px/18px ${FONT_BODY};color:${INK};${style}">${escapeHtml(text)}</td>`;

function studentRows(students: readonly ReminderStudent[]): string {
  const rows = students.map(
    (one) => `<tr>${cell(one.room)}${cell(one.name)}${cell(one.studentId, `color:${MUTED};`)}</tr>`,
  );
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border-top:1px solid ${LINE};">${rows.join('')}</table>`;
}

// The Review Reminder to a Report Recipient, as HTML. The words are those of the plain-text email.
export function reviewReminderHtml({ day, students }: ReviewReminderFields): string {
  const content = `${heading('Review Reminder')}
<div style="padding:4px 0 16px;">${statusBadge('Needs Review', NEEDS_REVIEW_BADGE)}</div>
${paragraph(`${escapeHtml(dayInWords(day))} is not Finalized yet.`)}
${paragraph('These Students had no Punch and were in the hostel for the whole Pooja Window, so they are on Needs Review:')}
${studentRows(students)}
${paragraph('Check the Leave Notes and both books, record any missing Leaves and Returns, then Finalize the Day on the Review page.')}`;
  return tilesPage(`Review Reminder: ${dayInWords(day)}`, content);
}
