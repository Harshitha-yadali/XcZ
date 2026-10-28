// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isProviderLoginHost, providerName } from './applyForm.ts';

// A job hosted on a Google Form sends the applicant to accounts.google.com.
// The job link is itself a google.com address, so the chain of trust counts
// that as the job's own site and the password would be asked for and typed on
// Google's real login page. This list is what stops that, so it is checked
// here rather than through the browser, which cannot reach these hosts.
describe('identity provider sign-in pages', () => {
  it('refuses the hosts that hold a user\'s whole identity', () => {
    for (const host of [
      'accounts.google.com',
      'accounts.youtube.com',
      'appleid.apple.com',
      'login.microsoftonline.com',
      'login.live.com',
      'login.yahoo.com',
      'github.com',
      'www.facebook.com',
      'linkedin.com',
      'www.linkedin.com',
    ]) {
      expect(isProviderLoginHost(host), host).toBe(true);
    }
  });

  it('leaves employers and their hiring systems alone', () => {
    for (const host of [
      'boards.greenhouse.io',
      'jobs.lever.co',
      'morningstar.wd5.myworkdayjobs.com',
      'app.joinsuperset.com',
      'careers.google.com',
      'docs.google.com',
      'www.amazon.jobs',
    ]) {
      expect(isProviderLoginHost(host), host).toBe(false);
    }
  });

  // A look-alike host is the whole point of the check, so anchor both ends.
  it('is not fooled by a host that merely contains a provider name', () => {
    for (const host of [
      'accounts.google.com.evil.test',
      'notaccounts.google.com',
      'linkedin.com.jobs.example',
      'mygithub.com',
    ]) {
      expect(isProviderLoginHost(host), host).toBe(false);
    }
  });

  it('names the provider for the message shown to the user', () => {
    expect(providerName('accounts.google.com')).toBe('Google');
    expect(providerName('accounts.youtube.com')).toBe('Google');
    expect(providerName('login.microsoftonline.com')).toBe('Microsoft');
    expect(providerName('login.live.com')).toBe('Microsoft');
    expect(providerName('appleid.apple.com')).toBe('Apple');
    expect(providerName('www.linkedin.com')).toBe('Linkedin');
  });
});
