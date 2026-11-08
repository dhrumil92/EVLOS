import { escapeHtml } from './html.js';
import { heading, MUTED, paragraph, tilesPage } from './tiles-layout.js';

export interface TestEmailFields {
  // The mail server and port it was sent through, such as "localhost:1025".
  where: string;
  from: string;
}

// The test email of `npm run email:test`, in the same design as the real emails, so the
// design can be checked in Mailpit or an inbox. The words are those of the plain-text email.
export function testEmailHtml({ where, from }: TestEmailFields): string {
  const content = `${heading('Test email')}
<div style="height:14px;font-size:0;line-height:0;">&nbsp;</div>
${paragraph(`This is a test email from EVLOS, sent through ${escapeHtml(where)} as ${escapeHtml(from)}.`)}
${paragraph('If it arrived, the email settings work.', MUTED)}`;
  return tilesPage('EVLOS test email', content);
}
