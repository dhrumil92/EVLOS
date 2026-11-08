import { describe, expect, it } from 'vitest';
import { LOGO_CID } from './email-images.js';
import { passwordResetHtml } from './password-reset.js';

const LINK = 'https://evlos.example.org/reset?token=abc123';

describe('passwordResetHtml', () => {
  it('has a button that opens the link', () => {
    const html = passwordResetHtml({ link: LINK });

    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('>Choose a new password<');
  });

  it('also writes the link out, for a program that does not show buttons', () => {
    const html = passwordResetHtml({ link: LINK });

    expect(html).toContain(`>${LINK}<`);
  });

  it('keeps the words of the plain-text email', () => {
    const html = passwordResetHtml({ link: LINK });

    expect(html).toContain('Someone asked to reset the EVLOS password for this email address.');
    expect(html).toContain('It works once, within 30 minutes.');
    expect(html).toContain('If you did not ask for this, ignore this email.');
  });

  it('keeps an & in the link safe inside the HTML', () => {
    const html = passwordResetHtml({ link: 'https://evlos.example.org/reset?token=a&b="x"' });

    expect(html).toContain('token=a&amp;b=&quot;x&quot;');
    expect(html).not.toContain('b="x"');
  });

  it('is in the same design as every other email', () => {
    expect(passwordResetHtml({ link: LINK })).toContain(`cid:${LOGO_CID}`);
  });
});
