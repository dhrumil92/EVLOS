import { describe, expect, it } from 'vitest';
import { afterFailedSend } from './outbox.js';

const FAILED_AT = Date.UTC(2026, 10, 4, 17, 30);
const FIVE_MINUTES = 5 * 60 * 1000;

describe('an email the email provider refused', () => {
  it('is tried again five minutes later after the first attempt', () => {
    expect(afterFailedSend(1, FAILED_AT)).toEqual({
      status: 'queued',
      sendAfter: FAILED_AT + FIVE_MINUTES,
    });
  });

  it('is tried again after the second attempt', () => {
    expect(afterFailedSend(2, FAILED_AT)).toEqual({
      status: 'queued',
      sendAfter: FAILED_AT + FIVE_MINUTES,
    });
  });

  it('is given up after the third attempt', () => {
    expect(afterFailedSend(3, FAILED_AT)).toEqual({ status: 'failed' });
  });
});
