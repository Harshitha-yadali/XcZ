import { describe, expect, it } from 'vitest';
import { isRefundableFailure } from './autoApplyRefund.ts';

describe('isRefundableFailure', () => {
  it('refunds failures on the employer side and runner crashes', () => {
    expect(isRefundableFailure('failed', 'This job link now opens a different page, so the job has probably closed.')).toBe(true);
    expect(isRefundableFailure('failed', 'The browser session failed before the application was sent. Please try again.')).toBe(true);
    expect(isRefundableFailure('needs_manual_action', 'This site puts a captcha in front of its application form')).toBe(true);
    expect(isRefundableFailure('failed')).toBe(true);
  });

  it('keeps the credit when the user caused it, is still needed, or it went through', () => {
    expect(isRefundableFailure('failed', 'Your apply agent is off, so nothing was sent. Turn it on and try again.')).toBe(false);
    for (const status of ['needs_input', 'needs_login', 'submitted', 'submission_uncertain', 'queued']) {
      expect(isRefundableFailure(status, 'anything')).toBe(false);
    }
  });
});
