import { resetLinkExpiresAt } from '@evlos/core';
import { passwordResetHtml } from '../email-templates/password-reset.js';
import type { Notifier } from '../ports/notifier.js';
import { cleanEmail, MIN_PASSWORD_LENGTH } from './rector-login.js';
import type { RectorLoginDeps } from './rector-login.js';

export type PasswordResetDeps = RectorLoginDeps & {
  notifier: Notifier;
  // The page the emailed link opens, from PUBLIC_URL. Null when PUBLIC_URL is not set.
  resetPageUrl: string | null;
};

export type ResetRequestResult = 'sent' | 'no-account' | 'no-public-url';
export type ResetPasswordResult = 'reset' | 'password-too-short' | 'link-not-valid';

function bodyOf(link: string): string {
  return [
    'Someone asked to reset the EVLOS password for this email address.',
    `To choose a new password, open this link. It works once, within 30 minutes.\n${link}`,
    'If you did not ask for this, ignore this email. The password stays as it is.',
    'EVLOS, hostel Pooja attendance',
  ].join('\n\n');
}

// A Rector who forgot the password asks for a link by email. The page always gives the same
// answer, so it never tells anyone which emails have an account. Only a hash of the link's
// token is kept, and the email is sent at once rather than through the outbox, so the link
// is never stored where it could be read back.
export async function requestPasswordReset(
  email: string,
  deps: PasswordResetDeps,
): Promise<ResetRequestResult> {
  if (deps.resetPageUrl === null) return 'no-public-url';
  const account = await deps.rectors.findByEmail(cleanEmail(email));
  if (account === null) return 'no-account';
  const token = deps.tokens.create();
  const expiresAt = resetLinkExpiresAt(deps.clock.now());
  await deps.rectors.addPasswordReset(deps.tokens.hashOf(token), account.rector.id, expiresAt);
  const link = `${deps.resetPageUrl}?token=${encodeURIComponent(token)}`;
  await deps.notifier.send({
    recipient: account.rector.email,
    subject: 'EVLOS password reset',
    body: bodyOf(link),
    html: passwordResetHtml({ link }),
    attachments: [],
  });
  return 'sent';
}

// The link sets a new password once. Every login of the Rector ends, and every other link
// stops working, so the Rector logs in again with the new password.
export async function resetPassword(
  token: string,
  newPassword: string,
  deps: RectorLoginDeps,
): Promise<ResetPasswordResult> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return 'password-too-short';
  const isReset = await deps.rectors.resetPassword(
    deps.tokens.hashOf(token),
    await deps.passwords.hash(newPassword),
    deps.clock.now(),
  );
  return isReset ? 'reset' : 'link-not-valid';
}
