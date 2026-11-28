import { describe, it, expect } from 'vitest';
import { isAdAllowedPath, isPayingSubscription, shouldShowAd } from './adRules';

describe('isAdAllowedPath', () => {
  it('allows content pages', () => {
    for (const p of ['/blog', '/blog/', '/blog/some-post', '/tutorials', '/tutorials/x', '/jobs', '/jobs/abc-123']) {
      expect(isAdAllowedPath(p), p).toBe(true);
    }
  });
  it('blocks money pages and job sub-pages', () => {
    for (const p of [
      '/', '/score-checker', '/optimizer', '/pricing', '/linkedin-optimizer', '/profile', '/admin', '/admin/blog',
      '/jobs/auto-applied', '/jobs/applications', '/jobs/abc/apply', '/jobs/abc/apply-form', '/jobs/company/tcs',
      '/blogger', '/jobsx',
    ]) {
      expect(isAdAllowedPath(p), p).toBe(false);
    }
  });
});

describe('isPayingSubscription', () => {
  it('treats no subscription and the free trial as not paying', () => {
    expect(isPayingSubscription(null)).toBe(false);
    expect(isPayingSubscription({ planId: 'lite_check', paymentId: null })).toBe(false);
  });
  it('treats paid plans and add-on buyers as paying', () => {
    expect(isPayingSubscription({ planId: 'career_pro_max', paymentId: 'pay_1' })).toBe(true);
    expect(isPayingSubscription({ planId: 'addon_only', paymentId: null })).toBe(true);
    expect(isPayingSubscription({ planId: 'lite_check', paymentId: 'pay_1' })).toBe(true);
  });
});

describe('shouldShowAd', () => {
  const client = 'ca-pub-1234567890123456';
  it('shows only with client, allowed path and a known non-paying user', () => {
    expect(shouldShowAd({ client, pathname: '/blog', paying: false })).toBe(true);
    expect(shouldShowAd({ client: undefined, pathname: '/blog', paying: false })).toBe(false);
    expect(shouldShowAd({ client, pathname: '/blog', paying: true })).toBe(false);
    expect(shouldShowAd({ client, pathname: '/blog', paying: undefined })).toBe(false);
    expect(shouldShowAd({ client, pathname: '/pricing', paying: false })).toBe(false);
  });
});
