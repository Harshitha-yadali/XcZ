import { describe, expect, it } from 'vitest';
import {
  DEFAULT_JD_OPTIMIZATION_TIER,
  JD_OPTIMIZATION_TIERS,
  getJdOptimizationPackage,
  getJdOptimizationTier,
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
        modelLabel: 'Gemma 4 26B (Free)',
        modelId: 'google/gemma-4-26b-a4b-it:free',
      },
      {
        id: 'smart',
        regularRate: 99,
        creditCost: 1,
        modelLabel: 'Nemotron 3 Ultra (Free)',
        modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      },
      {
        id: 'deep',
        regularRate: 199,
        creditCost: 1,
        modelLabel: 'Nemotron 3 Ultra (Free)',
        modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free',
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

  it('uses one refinement model per additional pass', () => {
    for (const tier of JD_OPTIMIZATION_TIERS) {
      expect(tier.refinementModels).toHaveLength(Math.max(0, tier.aiPasses - 1));
    }
  });

  it('makes Quick a one-pass full rewrite without the separate project-analysis step', () => {
    const quick = getJdOptimizationTier('quick');
    expect(quick.aiPasses).toBe(1);
    expect(quick.summaryRewriting).toBe(true);
    expect(quick.experienceRewriting).toBe(true);
    expect(quick.projectRewriting).toBe(true);
    expect(quick.projectAnalysis).toBe(false);

    expect(getJdOptimizationTier('smart').projectAnalysis).toBe(true);
    expect(getJdOptimizationTier('deep').projectAnalysis).toBe(true);
  });

  it('keeps every tier on its assigned internal model for all passes', () => {
    for (const tier of JD_OPTIMIZATION_TIERS) {
      expect(tier.refinementModels.every((model) => model === tier.modelId)).toBe(true);
    }
  });
});
