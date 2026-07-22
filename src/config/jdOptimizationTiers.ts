import type { OptimizationMode } from '../types/optimizer';
import {
  DEEP_OPTIMIZATION_MODEL,
  QUICK_OPTIMIZATION_MODEL,
  SMART_OPTIMIZATION_MODEL,
} from '../services/openrouterModelConfig';

export type JdOptimizationTierId = 'quick' | 'smart' | 'deep';
export type JdOptimizationPackageSize = 1 | 5 | 10 | 25 | 50;

export interface JdOptimizationPackage {
  size: JdOptimizationPackageSize;
  offerPrice: number;
  regularValue: number;
  perOptimization: number;
  discountPercentage: number;
  credits: number;
  addOnId: string;
}

export interface JdOptimizationTier {
  id: JdOptimizationTierId;
  name: string;
  badge: string;
  regularRate: number;
  creditCost: number;
  unitLabel: 'scan' | 'optimization';
  packages: readonly JdOptimizationPackage[];
  modelLabel: string;
  modelId: string;
  mode: OptimizationMode;
  aiPasses: number;
  refinementModels: string[];
  sectionSuggestions: boolean;
  summaryRewriting: boolean;
  experienceRewriting: boolean;
  projectRewriting: boolean;
  projectAnalysis: boolean;
  roleStrategy: 'Not included' | 'Basic' | 'Detailed';
  accuracyCheck: string;
  bestFor: string;
  cta: string;
  description: string;
}

export const JD_OPTIMIZATION_TIERS: readonly JdOptimizationTier[] = [
  {
    id: 'quick',
    name: 'Quick Scan',
    badge: 'Fastest',
    regularRate: 49,
    creditCost: 1,
    unitLabel: 'optimization',
    packages: [
      { size: 1, offerPrice: 19, regularValue: 49, perOptimization: 19, discountPercentage: 61, credits: 1, addOnId: 'jd_optimization_quick' },
      { size: 5, offerPrice: 89, regularValue: 245, perOptimization: 17.80, discountPercentage: 64, credits: 5, addOnId: 'jd_optimization_quick_5' },
      { size: 10, offerPrice: 169, regularValue: 490, perOptimization: 16.90, discountPercentage: 66, credits: 10, addOnId: 'jd_optimization_quick_10' },
      { size: 25, offerPrice: 399, regularValue: 1225, perOptimization: 15.96, discountPercentage: 67, credits: 25, addOnId: 'jd_optimization_quick_25' },
      { size: 50, offerPrice: 749, regularValue: 2450, perOptimization: 14.98, discountPercentage: 69, credits: 50, addOnId: 'jd_optimization_quick_50' },
    ],
    modelLabel: 'Gemma 4 26B (Free)',
    modelId: QUICK_OPTIMIZATION_MODEL,
    mode: 'light',
    aiPasses: 1,
    refinementModels: [],
    sectionSuggestions: true,
    summaryRewriting: true,
    experienceRewriting: true,
    projectRewriting: true,
    projectAnalysis: false,
    roleStrategy: 'Not included',
    accuracyCheck: 'Basic',
    bestFor: 'Fast basic rewrite',
    cta: 'Run Quick Scan',
    description: 'A fast one-pass basic rewrite of the full resume for the selected job.',
  },
  {
    id: 'smart',
    name: 'Smart Optimize',
    badge: 'Recommended',
    regularRate: 99,
    creditCost: 1,
    unitLabel: 'optimization',
    packages: [
      { size: 1, offerPrice: 49, regularValue: 99, perOptimization: 49, discountPercentage: 51, credits: 1, addOnId: 'jd_optimization_smart' },
      { size: 5, offerPrice: 239, regularValue: 495, perOptimization: 47.80, discountPercentage: 52, credits: 5, addOnId: 'jd_optimization_smart_5' },
      { size: 10, offerPrice: 469, regularValue: 990, perOptimization: 46.90, discountPercentage: 53, credits: 10, addOnId: 'jd_optimization_smart_10' },
      { size: 25, offerPrice: 999, regularValue: 2475, perOptimization: 39.96, discountPercentage: 60, credits: 25, addOnId: 'jd_optimization_smart_25' },
      { size: 50, offerPrice: 1889, regularValue: 4950, perOptimization: 37.78, discountPercentage: 62, credits: 50, addOnId: 'jd_optimization_smart_50' },
    ],
    modelLabel: 'Nemotron 3 Ultra (Free)',
    modelId: SMART_OPTIMIZATION_MODEL,
    mode: 'standard',
    aiPasses: 2,
    refinementModels: [SMART_OPTIMIZATION_MODEL],
    sectionSuggestions: true,
    summaryRewriting: true,
    experienceRewriting: true,
    projectRewriting: true,
    projectAnalysis: true,
    roleStrategy: 'Basic',
    accuracyCheck: 'Verified',
    bestFor: 'Most job applications',
    cta: 'Optimize My Resume',
    description: 'A complete job-specific rewrite with evidence validation and targeted refinement.',
  },
  {
    id: 'deep',
    name: 'Deep Optimize',
    badge: 'Premium',
    regularRate: 199,
    creditCost: 1,
    unitLabel: 'optimization',
    packages: [
      { size: 1, offerPrice: 99, regularValue: 199, perOptimization: 99, discountPercentage: 50, credits: 1, addOnId: 'jd_optimization_deep' },
      { size: 5, offerPrice: 489, regularValue: 995, perOptimization: 97.80, discountPercentage: 51, credits: 5, addOnId: 'jd_optimization_deep_5' },
      { size: 10, offerPrice: 899, regularValue: 1990, perOptimization: 89.90, discountPercentage: 55, credits: 10, addOnId: 'jd_optimization_deep_10' },
      { size: 25, offerPrice: 1999, regularValue: 4975, perOptimization: 79.96, discountPercentage: 60, credits: 25, addOnId: 'jd_optimization_deep_25' },
      { size: 50, offerPrice: 3899, regularValue: 9950, perOptimization: 77.98, discountPercentage: 61, credits: 50, addOnId: 'jd_optimization_deep_50' },
    ],
    modelLabel: 'Nemotron 3 Ultra (Free)',
    modelId: DEEP_OPTIMIZATION_MODEL,
    mode: 'aggressive',
    aiPasses: 3,
    refinementModels: [DEEP_OPTIMIZATION_MODEL, DEEP_OPTIMIZATION_MODEL],
    sectionSuggestions: true,
    summaryRewriting: true,
    experienceRewriting: true,
    projectRewriting: true,
    projectAnalysis: true,
    roleStrategy: 'Detailed',
    accuracyCheck: 'Enhanced audited',
    bestFor: 'Important applications',
    cta: 'Run Deep Optimize',
    description: 'Our deepest audited review for high-priority applications.',
  },
] as const;

export const DEFAULT_JD_OPTIMIZATION_TIER: JdOptimizationTierId = 'smart';

export const getJdOptimizationTier = (tierId: JdOptimizationTierId): JdOptimizationTier => {
  const tier = JD_OPTIMIZATION_TIERS.find((candidate) => candidate.id === tierId);
  if (!tier) {
    throw new Error(`Unknown JD optimization tier: ${tierId}`);
  }
  return tier;
};

export const getJdOptimizationPackage = (
  tierId: JdOptimizationTierId,
  packageSize: JdOptimizationPackageSize,
): JdOptimizationPackage => {
  const tier = getJdOptimizationTier(tierId);
  const optimizationPackage = tier.packages.find((candidate) => candidate.size === packageSize);
  if (!optimizationPackage) {
    throw new Error(`Unknown JD optimization package: ${tierId} ${packageSize}`);
  }
  return optimizationPackage;
};
