import { escapeHtml } from './html.js';
import { FONT_BODY, heading, MUTED, paragraph, PRIMARY, tilesPage } from './tiles-layout.js';

export interface PasswordResetFields {
  // The page the emailed link opens, with the one-time token on the end.
  link: string;
}

// The password-reset email to a Rector, as HTML. The words are those of the plain-text email.
// The link is also written out under the button, for a program that does not show buttons.
export function passwordResetHtml({ link }: PasswordResetFields): string {
  const safe = escapeHtml(link);
  const content = `${heading('Reset your password')}
<div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
${paragraph('Someone asked to reset the EVLOS password for this email address.')}
${paragraph('To choose a new password, open the button below. It works once, within 30 minutes.')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;"><tr><td style="background:${PRIMARY};border-radius:10px;"><a href="${safe}" style="display:inline-block;padding:12px 22px;font:700 14px/20px ${FONT_BODY};color:#FFFFFF;text-decoration:none;">Choose a new password</a></td></tr></table>
${paragraph('Or copy this link into your browser:', MUTED)}
<p style="margin:0 0 14px;font:400 12px/18px ${FONT_BODY};word-break:break-all;"><a href="${safe}" style="color:${PRIMARY};">${safe}</a></p>
${paragraph('If you did not ask for this, ignore this email. The password stays as it is.', MUTED)}`;
  return tilesPage('EVLOS password reset', content);
}
