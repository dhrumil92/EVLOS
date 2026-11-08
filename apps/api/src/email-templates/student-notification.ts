import type { Day } from '@evlos/core';
import { dayInWords, dayParts } from '../use-cases/day-in-words.js';
import { escapeHtml } from './html.js';
import {
  ABSENT_BADGE,
  FONT_BODY,
  FONT_DISPLAY,
  INK,
  LINE,
  MUTED,
  paragraph,
  statusBadge,
  tilesPage,
} from './tiles-layout.js';

const CALENDAR_RED = '#D13B35';

// The Day as a small calendar page: the month on red, the date large, the weekday below.
function calendarBlock(day: Day): string {
  const { weekday, dayOfMonth, month } = dayParts(day);
  return `<table role="presentation" width="84" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
<tr><td align="center" style="background:${CALENDAR_RED};padding:5px 0;font:700 14px/18px ${FONT_BODY};color:#FFFFFF;">${month}</td></tr>
<tr><td align="center" style="padding:8px 0 2px;font:800 38px/40px ${FONT_DISPLAY};color:${INK};">${dayOfMonth}</td></tr>
<tr><td align="center" style="padding:0 0 8px;font:400 14px/18px ${FONT_BODY};color:${MUTED};">${weekday}</td></tr></table>`;
}

export interface StudentNotificationFields {
  name: string;
  day: Day;
}

// The Notification to an Absent Student, as HTML. The words are those of the plain-text email.
export function studentNotificationHtml({ name, day }: StudentNotificationFields): string {
  const inWords = escapeHtml(dayInWords(day));
  const content = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>
<td width="96" valign="top">${calendarBlock(day)}</td>
<td valign="middle" style="padding-left:6px;"><div style="font:800 28px/33px ${FONT_DISPLAY};color:${INK};">Pooja missed</div><div style="padding-top:8px;">${statusBadge('Absent', ABSENT_BADGE)}</div></td>
</tr></table>
${paragraph(`Dear ${escapeHtml(name)},`)}
${paragraph(`You did not punch at Pooja on ${inWords}, and you were in the hostel that day.`)}
${paragraph('If you think this is a mistake, please speak to the Rector.', MUTED)}`;
  return tilesPage(`Pooja missed on ${dayInWords(day)}`, content);
}
