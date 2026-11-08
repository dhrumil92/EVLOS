import { escapeHtml } from './html.js';
import { LOGO_CID, WORDMARK_CID } from './email-images.js';

// The "Tiles" design: an indigo header with the logo and the evlos wordmark, a white card, and
// a soft indigo background. Email programs ignore most CSS, so the page is built from tables
// with every style written on the element itself.

export const INK = '#1B1F3B';
export const MUTED = '#4A4F72';
export const PRIMARY = '#2D3A8C';
export const LINE = '#DDE0F0';
export const BACKGROUND = '#DDE2F5';
const ON_PRIMARY_MUTED = '#DDE0F7';

// Bricolage Grotesque and Atkinson Hyperlegible are the web app's fonts. An email program that
// does not have them falls back to the next one.
export const FONT_DISPLAY = "'Bricolage Grotesque','Segoe UI',Arial,sans-serif";
export const FONT_BODY = "'Atkinson Hyperlegible','Segoe UI',Arial,sans-serif";

export interface Badge {
  background: string;
  ink: string;
}

// The colours of the Pooja Statuses, as in the web app. A badge also says the Pooja Status in
// words, so it still reads without colour.
export const ABSENT_BADGE: Badge = { background: '#F9E3E3', ink: '#A12A2A' };

export const statusBadge = (name: string, colours: Badge): string =>
  `<span style="display:inline-block;padding:3px 11px;border-radius:999px;background:${colours.background};` +
  `color:${colours.ink};font:700 13px/18px ${FONT_BODY};">${escapeHtml(name)}</span>`;

export const paragraph = (text: string, colour = INK): string =>
  `<p style="margin:0 0 14px;font:400 16px/25px ${FONT_BODY};color:${colour};">${text}</p>`;

const header = `<tr><td style="background:${PRIMARY};border-radius:16px 16px 0 0;padding:22px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="64" style="padding-right:16px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#FFFFFF;border-radius:12px;padding:6px;"><img src="cid:${LOGO_CID}" width="52" height="52" alt="Hostel logo" style="display:block;border:0;"></td></tr></table></td>
<td valign="middle"><img src="cid:${WORDMARK_CID}" width="96" height="30" alt="evlos" style="display:block;border:0;"><div style="font:400 13px/18px ${FONT_BODY};color:${ON_PRIMARY_MUTED};padding-top:4px;">Hostel Pooja attendance</div></td>
</tr></table></td></tr>`;

const footer = `<tr><td style="background:#FFFFFF;border-radius:0 0 16px 16px;padding:0 28px 22px;font:400 13px/20px ${FONT_BODY};color:${MUTED};">EVLOS, hostel Pooja attendance</td></tr>`;

// The whole email page. `content` is the HTML for inside the white card; the caller must have
// escaped any text from a person.
export const tilesPage = (title: string, content: string): string =>
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BACKGROUND};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BACKGROUND};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
${header}
<tr><td style="background:#FFFFFF;padding:26px 28px 18px;">${content}</td></tr>
${footer}
</table>
</td></tr></table>
</body>
</html>`;
