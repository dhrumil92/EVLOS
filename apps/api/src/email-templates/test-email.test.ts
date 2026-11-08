import { describe, expect, it } from 'vitest';
import { LOGO_CID, WORDMARK_CID } from './email-images.js';
import { testEmailHtml } from './test-email.js';

const FIELDS = { where: 'localhost:1025', from: 'EVLOS <evlos@localhost>' };

describe('testEmailHtml', () => {
  it('says where it was sent through and as whom, and that the settings work if it arrived', () => {
    const html = testEmailHtml(FIELDS);

    expect(html).toContain('sent through localhost:1025 as EVLOS &lt;evlos@localhost&gt;.');
    expect(html).toContain('If it arrived, the email settings work.');
  });

  it('is in the same design as every other email, with the logo and the evlos wordmark', () => {
    const html = testEmailHtml(FIELDS);

    expect(html).toContain(`src="cid:${LOGO_CID}"`);
    expect(html).toContain(`src="cid:${WORDMARK_CID}"`);
  });

  it('cannot be broken by HTML in the sender', () => {
    const html = testEmailHtml({ where: 'localhost:1025', from: '<script>x</script>' });

    expect(html).not.toContain('<script>');
  });
});
