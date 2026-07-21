import { describe, expect, it } from 'vitest';
import { getOptimizationTierRemaining, paymentService, type Subscription } from './paymentService';

const subscription: Subscription = {
  id: 'test',
  userId: 'user',
  planId: 'addon_only',
  status: 'active',
  startDate: '2026-07-18T00:00:00.000Z',
  endDate: '9999-12-31T23:59:59.999Z',
  optimizationsUsed: 5,
  optimizationsTotal: 18,
  paymentId: null,
  couponUsed: null,
  scoreChecksUsed: 0,
  scoreChecksTotal: 0,
  linkedinMessagesUsed: 0,
  linkedinMessagesTotal: 0,
  guidedBuildsUsed: 0,
  guidedBuildsTotal: 0,
  quickOptimizationsUsed: 3,
  quickOptimizationsTotal: 12,
  smartOptimizationsUsed: 2,
  smartOptimizationsTotal: 5,
  deepOptimizationsUsed: 0,
  deepOptimizationsTotal: 1,
};

describe('tiered optimization credits', () => {
  it('calculates each category independently', () => {
    expect(getOptimizationTierRemaining(subscription, 'quick')).toBe(9);
    expect(getOptimizationTierRemaining(subscription, 'smart')).toBe(3);
    expect(getOptimizationTierRemaining(subscription, 'deep')).toBe(1);
  });

  it('publishes the 3 single-use options and 12 bundles with their purchased tier and run count', () => {
    const plans = paymentService.getPlansByCategory('jd_only');
    expect(plans).toHaveLength(15);
    expect(plans.map(({ id, optimizationTier, optimizations }) => ({ id, optimizationTier, optimizations }))).toEqual([
      { id: 'jd_quick_1', optimizationTier: 'quick', optimizations: 1 },
      { id: 'jd_quick_5', optimizationTier: 'quick', optimizations: 5 },
      { id: 'jd_quick_10', optimizationTier: 'quick', optimizations: 10 },
      { id: 'jd_quick_25', optimizationTier: 'quick', optimizations: 25 },
      { id: 'jd_quick_50', optimizationTier: 'quick', optimizations: 50 },
      { id: 'jd_smart_1', optimizationTier: 'smart', optimizations: 1 },
      { id: 'jd_smart_5', optimizationTier: 'smart', optimizations: 5 },
      { id: 'jd_smart_10', optimizationTier: 'smart', optimizations: 10 },
      { id: 'jd_smart_25', optimizationTier: 'smart', optimizations: 25 },
      { id: 'jd_smart_50', optimizationTier: 'smart', optimizations: 50 },
      { id: 'jd_deep_1', optimizationTier: 'deep', optimizations: 1 },
      { id: 'jd_deep_5', optimizationTier: 'deep', optimizations: 5 },
      { id: 'jd_deep_10', optimizationTier: 'deep', optimizations: 10 },
      { id: 'jd_deep_25', optimizationTier: 'deep', optimizations: 25 },
      { id: 'jd_deep_50', optimizationTier: 'deep', optimizations: 50 },
    ]);
  });
});
