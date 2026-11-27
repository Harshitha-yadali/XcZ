/**
 * Whether an Auto Apply run that ended this way gives the user's Quick credit
 * back. Only the runner's own failures do: the employer's site broke, closed,
 * walled the runner off, or the runner crashed. Anything still waiting on the
 * user (needs_input, needs_login, which is also where a wrong login lands) or
 * anything that went through is not refunded.
 */
export function isRefundableFailure(status: string, message = ''): boolean {
  // The user switched their apply agent off: their choice, not a failure.
  if (/apply agent is off/i.test(message)) return false;
  // needs_manual_action reaches the runner only for a site wall (captcha, bot
  // check, sign-in-with-Google, account needed); Smart Apply rows are never run.
  return status === 'failed' || status === 'needs_manual_action';
}
