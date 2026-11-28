import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JD_OPTIMIZATION_TIER,
  JD_OPTIMIZATION_TIERS,
  getJdOptimizationPackage,
  getJdOptimizationTier,
  getTierTargetScore,
} from './jdOptimizationTiers';

describe('JD optimization quality tiers', () => {
  it('keeps Smart Optimize as the recommended default', () => {
    expect(DEFAULT_JD_OPTIMIZATION_TIER).toBe('smart');
    expect(getJdOptimizationTier('smart').badge).toBe('Recommended');
  });

  it('uses the approved regular rates, credit costs, and models', () => {
    expect(JD_OPTIMIZATION_TIERS.map(({ id, regularRate, creditCost, modelLabel, modelId }) => ({
      id,
      regularRate,
      creditCost,
      modelLabel,
      modelId,
    }))).toEqual([
      {
        id: 'quick',
        regularRate: 49,
        creditCost: 1,
        modelLabel: 'GPT-6 Luna',
        modelId: 'openai/gpt-6-luna',
      },
      {
        id: 'smart',
        regularRate: 99,
        creditCost: 1,
        modelLabel: 'GPT-6.1 Terra',
        modelId: 'openai/gpt-6.1-terra',
      },
      {
        id: 'deep',
        regularRate: 199,
        creditCost: 1,
        modelLabel: 'Claude Sonnet 5.5',
        modelId: 'anthropic/claude-sonnet-5.5',
      },
    ]);
  });

  it('has the approved package prices and grants the advertised number of runs', () => {
    expect(JD_OPTIMIZATION_TIERS.map((tier) => ({
      id: tier.id,
      packages: tier.packages.map(({ size, regularValue, offerPrice, perOptimization, discountPercentage }) => ({
        size,
        regularValue,
        offerPrice,
        perOptimization,
        discountPercentage,
      })),
    }))).toEqual([
      { id: 'quick', packages: [
        { size: 1, regularValue: 49, offerPrice: 19, perOptimization: 19, discountPercentage: 61 },
        { size: 5, regularValue: 245, offerPrice: 89, perOptimization: 17.8, discountPercentage: 64 },
        { size: 10, regularValue: 490, offerPrice: 169, perOptimization: 16.9, discountPercentage: 66 },
        { size: 25, regularValue: 1225, offerPrice: 399, perOptimization: 15.96, discountPercentage: 67 },
        { size: 50, regularValue: 2450, offerPrice: 749, perOptimization: 14.98, discountPercentage: 69 },
      ] },
      { id: 'smart', packages: [
        { size: 1, regularValue: 99, offerPrice: 49, perOptimization: 49, discountPercentage: 51 },
        { size: 5, regularValue: 495, offerPrice: 239, perOptimization: 47.8, discountPercentage: 52 },
        { size: 10, regularValue: 990, offerPrice: 469, perOptimization: 46.9, discountPercentage: 53 },
        { size: 25, regularValue: 2475, offerPrice: 999, perOptimization: 39.96, discountPercentage: 60 },
        { size: 50, regularValue: 4950, offerPrice: 1889, perOptimization: 37.78, discountPercentage: 62 },
      ] },
      { id: 'deep', packages: [
        { size: 1, regularValue: 199, offerPrice: 99, perOptimization: 99, discountPercentage: 50 },
        { size: 5, regularValue: 995, offerPrice: 489, perOptimization: 97.8, discountPercentage: 51 },
        { size: 10, regularValue: 1990, offerPrice: 899, perOptimization: 89.9, discountPercentage: 55 },
        { size: 25, regularValue: 4975, offerPrice: 1999, perOptimization: 79.96, discountPercentage: 60 },
        { size: 50, regularValue: 9950, offerPrice: 3899, perOptimization: 77.98, discountPercentage: 61 },
      ] },
    ]);

    const addOnIds = JD_OPTIMIZATION_TIERS.flatMap((tier) => tier.packages.map((item) => item.addOnId));
    expect(new Set(addOnIds).size).toBe(15);
    for (const tier of JD_OPTIMIZATION_TIERS) {
      for (const optimizationPackage of tier.packages) {
        expect(optimizationPackage.credits).toBe(optimizationPackage.size);
      }
    }
    expect(getJdOptimizationPackage('deep', 25).offerPrice).toBe(1999);
    expect(getJdOptimizationPackage('smart', 1).offerPrice).toBe(49);
  });

  it('sets loops, targets, refinement work and Boost limits per tier', () => {
    expect(JD_OPTIMIZATION_TIERS.map(({ id, maxLoops, target, refinementSections, boostLimits }) => ({
      id, maxLoops, target, refinementSections, boostLimits,
    }))).toEqual([
      { id: 'quick', maxLoops: 1, target: { kind: 'gain', points: 20 }, refinementSections: ['summary'], boostLimits: { skills: 12, metrics: 4 } },
      { id: 'smart', maxLoops: 3, target: { kind: 'score', points: 80 }, refinementSections: ['summary', 'bullets'], boostLimits: { skills: 12, metrics: 6 } },
      { id: 'deep', maxLoops: 8, target: { kind: 'score', points: 90 }, refinementSections: ['summary', 'bullets'], boostLimits: { skills: null, metrics: 8 } },
    ]);
  });

  it('computes Quick target as before + 20 (capped at 100) and fixed targets for Smart and Deep', () => {
    expect(getTierTargetScore('quick', 60)).toBe(80);
    expect(getTierTargetScore('quick', 92)).toBe(100);
    expect(getTierTargetScore('smart', 60)).toBe(80);
    expect(getTierTargetScore('deep', 40)).toBe(90);
  });

  it('makes Quick a full rewrite plus one refinement pass, without the separate project-analysis step', () => {
    const quick = getJdOptimizationTier('quick');
    expect(quick.maxLoops).toBe(1);
    expect(quick.summaryRewriting).toBe(true);
    expect(quick.experienceRewriting).toBe(true);
    expect(quick.projectRewriting).toBe(true);
    expect(quick.projectAnalysis).toBe(false);

    expect(getJdOptimizationTier('smart').projectAnalysis).toBe(true);
    expect(getJdOptimizationTier('deep').projectAnalysis).toBe(true);
  });

  it('refines with the tier model and falls back to the cheapest model on error', () => {
    for (const tier of JD_OPTIMIZATION_TIERS) {
      expect(tier.refinementModel).toBe(tier.modelId);
      expect(tier.refinementFallbackModel).toBe('openai/gpt-6-luna');
    }
  });

  it('keeps Quick, Smart, and Deep on three distinct models', () => {
    // Regression guard: commit cd6c63f briefly collapsed Smart and Deep onto the
    // same free-tier model, so a ₹99 Deep purchase bought exactly what a ₹49
    // Smart purchase did. This must fail loudly if that ever happens again,
    // regardless of which specific model IDs are in play.
    const modelIds = JD_OPTIMIZATION_TIERS.map((tier) => tier.modelId);
    expect(new Set(modelIds).size).toBe(JD_OPTIMIZATION_TIERS.length);
  });
});
