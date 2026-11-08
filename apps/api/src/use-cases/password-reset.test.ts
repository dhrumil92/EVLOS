import { describe, expect, it } from 'vitest';
import type { Email } from '../ports/notifier.js';
import { fakeLogin } from './fake-rector-repository.js';
import { requestPasswordReset, resetPassword } from './password-reset.js';
import { createRector, logIn, rectorOfSession } from './rector-login.js';

const MINUTE = 60 * 1000;
const NOW = Date.UTC(2026, 10, 5, 10, 0, 0);
const EMAIL = 'rector@example.com';
const PASSWORD = 'a long enough password';
const NEW_PASSWORD = 'another long password';
const RESET_PAGE = 'https://evlos.example.com/reset-password';

// A Rector logged in on two devices (token-1 and token-2), and a mailbox that keeps what is
// sent. The link's token is token-3, the next one made.
async function setUp(resetPageUrl: string | null = RESET_PAGE) {
  const fake = fakeLogin();
  const sent: Email[] = [];
  const notifier = {
    send: (email: Email) => {
      sent.push(email);
      return Promise.resolve();
    },
  };
  const deps = { ...fake, clock: { now: () => NOW }, notifier, resetPageUrl };
  await createRector(EMAIL, PASSWORD, deps);
  await logIn(EMAIL, PASSWORD, deps);
  await logIn(EMAIL, PASSWORD, deps);
  return { ...fake, deps, sent };
}

const at = (deps: Awaited<ReturnType<typeof setUp>>['deps'], now: number) => ({
  ...deps,
  clock: { now: () => now },
});

describe('requestPasswordReset', () => {
  it("emails a one-time link to the Rector's login address", async () => {
    const { deps, sent } = await setUp();

    const result = await requestPasswordReset(EMAIL, deps);

    expect(result).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      recipient: EMAIL,
      subject: 'EVLOS password reset',
      attachments: [],
    });
    expect(sent[0]?.body).toContain(`${RESET_PAGE}?token=token-3`);
    expect(sent[0]?.body).toContain('It works once, within 30 minutes.');
  });

  it('sends the same link in a formatted version, as a button', async () => {
    const { deps, sent } = await setUp();

    await requestPasswordReset(EMAIL, deps);

    expect(sent[0]?.html).toContain(`href="${RESET_PAGE}?token=token-3"`);
  });

  it('keeps only a hash of the link, which works for 30 minutes', async () => {
    const { deps, resets } = await setUp();

    await requestPasswordReset(EMAIL, deps);

    expect([...resets]).toEqual([
      ['hash-of-token-3', { rectorId: 1, expiresAt: NOW + 30 * MINUTE, isUsed: false }],
    ]);
  });

  it('accepts the email in any case and with spaces around it', async () => {
    const { deps, sent } = await setUp();

    await requestPasswordReset('  Rector@Example.COM ', deps);

    expect(sent[0]?.recipient).toBe(EMAIL);
  });

  it('sends nothing for an email with no account', async () => {
    const { deps, sent, resets } = await setUp();

    const result = await requestPasswordReset('stranger@example.com', deps);

    expect(result).toBe('no-account');
    expect(sent).toEqual([]);
    expect(resets.size).toBe(0);
  });

  it('sends nothing when PUBLIC_URL is not set, since the link would lead nowhere', async () => {
    const { deps, sent } = await setUp(null);

    const result = await requestPasswordReset(EMAIL, deps);

    expect(result).toBe('no-public-url');
    expect(sent).toEqual([]);
  });
});

describe('resetPassword', () => {
  it('sets the new password, so only it logs in, and ends every login', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);

    const result = await resetPassword('token-3', NEW_PASSWORD, deps);

    expect(result).toBe('reset');
    expect(await rectorOfSession('token-1', deps)).toBeNull();
    expect(await rectorOfSession('token-2', deps)).toBeNull();
    expect((await logIn(EMAIL, NEW_PASSWORD, deps)).outcome).toBe('logged-in');
    expect((await logIn(EMAIL, PASSWORD, deps)).outcome).toBe('refused');
  });

  it('records the reset for the Rector, never the password', async () => {
    const { deps, audit } = await setUp();
    await requestPasswordReset(EMAIL, deps);

    await resetPassword('token-3', NEW_PASSWORD, deps);

    expect(audit).toEqual([{ action: 'Reset Password', doneAt: NOW, doneBy: EMAIL }]);
  });

  it('works only once', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);
    await resetPassword('token-3', NEW_PASSWORD, deps);

    const again = await resetPassword('token-3', 'a third long password', deps);

    expect(again).toBe('link-not-valid');
    expect((await logIn(EMAIL, NEW_PASSWORD, deps)).outcome).toBe('logged-in');
  });

  it('no longer works 30 minutes after it was asked for', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);

    const result = await resetPassword('token-3', NEW_PASSWORD, at(deps, NOW + 30 * MINUTE));

    expect(result).toBe('link-not-valid');
  });

  it('still works just before the 30 minutes are up', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);

    const result = await resetPassword('token-3', NEW_PASSWORD, at(deps, NOW + 30 * MINUTE - 1));

    expect(result).toBe('reset');
  });

  it('refuses a link that was never sent', async () => {
    const { deps } = await setUp();

    expect(await resetPassword('made-up', NEW_PASSWORD, deps)).toBe('link-not-valid');
  });

  it('refuses a new password shorter than 12 characters, and the link still works', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);

    const short = await resetPassword('token-3', 'short', deps);
    const longEnough = await resetPassword('token-3', NEW_PASSWORD, deps);

    expect([short, longEnough]).toEqual(['password-too-short', 'reset']);
  });

  it('closes older links once one of them is used', async () => {
    const { deps } = await setUp();
    await requestPasswordReset(EMAIL, deps);
    await requestPasswordReset(EMAIL, deps);

    await resetPassword('token-4', NEW_PASSWORD, deps);

    expect(await resetPassword('token-3', 'a third long password', deps)).toBe('link-not-valid');
  });
});
