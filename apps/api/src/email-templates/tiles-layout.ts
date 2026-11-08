import { escapeHtml } from './html.js';
import { LOGO_CID, WORDMARK_CID } from './email-images.js';

// The "Tiles" design: an indigo header with the logo and the evlos wordmark on a white card
// that fills the width, with no colour around it, so it takes little room on a phone. Email
// programs ignore most CSS, so the page is built from tables with every style written on the
// element itself.

export const INK = '#1B1F3B';
export const MUTED = '#4A4F72';
export const PRIMARY = '#2D3A8C';
export const LINE = '#DDE0F0';
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
export const NEEDS_REVIEW_BADGE: Badge = { background: '#FFF6E5', ink: '#7A4F00' };

export const statusBadge = (name: string, colours: Badge): string =>
  `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${colours.background};` +
  `color:${colours.ink};font:700 12px/16px ${FONT_BODY};">${escapeHtml(name)}</span>`;

// `html` is already safe HTML: escape any text from a person before it comes here.
export const paragraph = (html: string, colour = INK): string =>
  `<p style="margin:0 0 12px;font:400 14px/22px ${FONT_BODY};color:${colour};">${html}</p>`;

export const heading = (text: string): string =>
  `<div style="font:800 25px/30px ${FONT_DISPLAY};color:${INK};margin:0 0 2px;">${escapeHtml(text)}</div>`;

export const subheading = (text: string): string =>
  `<div style="font:400 12px/18px ${FONT_BODY};color:${MUTED};margin:0 0 16px;">${escapeHtml(text)}</div>`;

// The names of the files that came with the email, one under the other.
export const fileList = (names: readonly string[]): string =>
  names.length === 0
    ? ''
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${names
        .map(
          (name) =>
            `<tr><td style="padding:8px 12px;border:1px solid ${LINE};border-radius:8px;background:#FFFFFF;font:400 13px/18px ${FONT_BODY};color:${INK};">` +
            `<span style="color:${PRIMARY};font-weight:700;">&#9632;</span>&nbsp; ${escapeHtml(name)}</td></tr>` +
            '<tr><td height="6" style="font-size:0;line-height:0;">&nbsp;</td></tr>',
        )
        .join('')}</table>`;

const header = `<tr><td style="background:${PRIMARY};padding:18px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="56" style="padding-right:12px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#FFFFFF;border-radius:10px;padding:5px;"><img src="cid:${LOGO_CID}" width="44" height="44" alt="Hostel logo" style="display:block;border:0;"></td></tr></table></td>
<td valign="middle"><img src="cid:${WORDMARK_CID}" width="84" height="26" alt="evlos" style="display:block;border:0;"><div style="font:400 12px/16px ${FONT_BODY};color:${ON_PRIMARY_MUTED};padding-top:3px;">Hostel Pooja attendance</div></td>
</tr></table></td></tr>`;

const footer = `<tr><td style="background:#FFFFFF;border-top:1px solid ${LINE};padding:12px 20px 16px;font:400 12px/18px ${FONT_BODY};color:${MUTED};">EVLOS, hostel Pooja attendance</td></tr>`;

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
<body style="margin:0;padding:0;background:#FFFFFF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
${header}
<tr><td style="background:#FFFFFF;padding:22px 20px 12px;">${content}</td></tr>
${footer}
</table>
</td></tr></table>
</body>
</html>`;
