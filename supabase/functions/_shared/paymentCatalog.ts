export interface PaymentPlanConfig {
  id: string;
  name: string;
  price: number;
  mrp: number;
  discountPercentage: number;
  duration: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  sessions: number;
  durationInHours: number;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
  optimizationTier?: 'quick' | 'smart' | 'deep';
}

export const LIFETIME_PLAN_END_DATE_ISO = '9999-12-31T23:59:59.999Z';

export const resolveSubscriptionEndDateIso = (
  plan: Pick<PaymentPlanConfig, 'durationInHours'>,
  startDate: Date = new Date(),
): string => {
  const durationInHours = Number(plan.durationInHours || 0);

  if (!Number.isFinite(durationInHours) || durationInHours <= 0) {
    return LIFETIME_PLAN_END_DATE_ISO;
  }

  return new Date(startDate.getTime() + durationInHours * 60 * 60 * 1000).toISOString();
};

export interface PaymentAddOnConfig {
  id: string;
  name: string;
  price: number;
  type: 'optimization' | 'score_check' | 'guided_build' | 'linkedin_messages';
  quantity: number;
  optimizationTier?: 'quick' | 'smart' | 'deep';
}

const jdOptimizationPaymentPlans: PaymentPlanConfig[] = [
  ['quick', 'Quick', 5, 89, 245, 17.80, 64, 5],
  ['quick', 'Quick', 10, 169, 490, 16.90, 66, 10],
  ['quick', 'Quick', 25, 399, 1225, 15.96, 67, 25],
  ['quick', 'Quick', 50, 749, 2450, 14.98, 69, 50],
  ['smart', 'Smart', 5, 239, 495, 47.80, 52, 5],
  ['smart', 'Smart', 10, 469, 990, 46.90, 53, 10],
  ['smart', 'Smart', 25, 999, 2475, 39.96, 60, 25],
  ['smart', 'Smart', 50, 1889, 4950, 37.78, 62, 50],
  ['deep', 'Deep', 5, 489, 995, 97.80, 51, 5],
  ['deep', 'Deep', 10, 899, 1990, 89.90, 55, 10],
  ['deep', 'Deep', 25, 1999, 4975, 79.96, 60, 25],
  ['deep', 'Deep', 50, 3899, 9950, 77.98, 61, 50],
].map(([tierId, tierName, size, price, mrp, perUnit, discountPercentage, credits]) => ({
  id: `jd_${tierId}_${size}`,
  name: `${tierName} ${size}`,
  price: Number(price),
  mrp: Number(mrp),
  discountPercentage: Number(discountPercentage),
  duration: 'Lifetime Access',
  optimizations: Number(credits),
  scoreChecks: 0,
  linkedinMessages: 0,
  guidedBuilds: 0,
  sessions: 0,
  tag: tierId === 'smart' ? 'Recommended' : tierId === 'deep' ? 'Premium' : 'Fastest',
  tagColor: tierId === 'smart' ? 'text-emerald-800 bg-emerald-100' : '',
  gradient: tierId === 'quick'
    ? 'from-cyan-500 to-sky-500'
    : tierId === 'smart'
      ? 'from-emerald-500 to-cyan-500'
      : 'from-violet-500 to-blue-500',
  icon: 'target',
  features: [`${size} ${tierName} ${tierId === 'quick' ? 'Scans' : 'Optimize runs'}`, `₹${Number(perUnit).toFixed(2)} per ${tierId === 'quick' ? 'scan' : 'optimization'}`],
  popular: tierId === 'smart' && size === 25,
  durationInHours: 0,
  optimizationTier: tierId as 'quick' | 'smart' | 'deep',
}));

export const paymentPlans: PaymentPlanConfig[] = [
  {
    id: 'career_boost',
    name: 'Career Boost Plan',
    price: 1999,
    mrp: 3925,
    discountPercentage: 49,
    duration: 'Lifetime Access',
    optimizations: 50,
    scoreChecks: 25,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 1,
    tag: 'Premium',
    tagColor: 'text-emerald-800 bg-emerald-100',
    gradient: 'from-emerald-500 to-cyan-500',
    icon: 'zap',
    features: ['50 JD-Based Resume Optimizations', '25 Resume Score Checks', '1 Resume Review Session'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'career_pro',
    name: 'Career Pro Plan',
    price: 2999,
    mrp: 6850,
    discountPercentage: 56,
    duration: 'Lifetime Access',
    optimizations: 100,
    scoreChecks: 50,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 1,
    tag: 'Most Popular',
    tagColor: 'text-amber-800 bg-amber-100',
    gradient: 'from-amber-500 to-orange-500',
    icon: 'crown',
    features: ['100 JD-Based Resume Optimizations', '50 Resume Score Checks', '1 Resume Review Session'],
    popular: true,
    durationInHours: 0,
  },
  ...jdOptimizationPaymentPlans,
  // Legacy JD plan IDs remain server-side so pre-existing orders can still be verified.
  {
    id: 'jd_starter',
    name: 'JD Starter',
    price: 89,
    mrp: 245,
    discountPercentage: 64,
    duration: 'Lifetime Access',
    optimizations: 5,
    scoreChecks: 0,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-teal-500 to-emerald-500',
    icon: 'target',
    features: ['5 JD-Based Resume Optimizations'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'jd_basic',
    name: 'JD Basic',
    price: 169,
    mrp: 490,
    discountPercentage: 65,
    duration: 'Lifetime Access',
    optimizations: 10,
    scoreChecks: 0,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-teal-500 to-emerald-500',
    icon: 'target',
    features: ['10 JD-Based Resume Optimizations'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'jd_advanced',
    name: 'JD Advanced',
    price: 799,
    mrp: 2450,
    discountPercentage: 67,
    duration: 'Lifetime Access',
    optimizations: 50,
    scoreChecks: 0,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-teal-500 to-emerald-500',
    icon: 'target',
    features: ['50 JD-Based Resume Optimizations'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'jd_pro',
    name: 'JD Pro',
    price: 1499,
    mrp: 4900,
    discountPercentage: 69,
    duration: 'Lifetime Access',
    optimizations: 100,
    scoreChecks: 0,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-teal-500 to-emerald-500',
    icon: 'target',
    features: ['100 JD-Based Resume Optimizations'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'score_starter',
    name: 'Score Starter',
    price: 39,
    mrp: 95,
    discountPercentage: 59,
    duration: 'Lifetime Access',
    optimizations: 0,
    scoreChecks: 5,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-blue-500 to-cyan-500',
    icon: 'check_circle',
    features: ['5 Resume Score Checks'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'score_basic',
    name: 'Score Basic',
    price: 79,
    mrp: 190,
    discountPercentage: 58,
    duration: 'Lifetime Access',
    optimizations: 0,
    scoreChecks: 10,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-blue-500 to-cyan-500',
    icon: 'check_circle',
    features: ['10 Resume Score Checks'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'score_advanced',
    name: 'Score Advanced',
    price: 349,
    mrp: 950,
    discountPercentage: 63,
    duration: 'Lifetime Access',
    optimizations: 0,
    scoreChecks: 50,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-blue-500 to-cyan-500',
    icon: 'check_circle',
    features: ['50 Resume Score Checks'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'combo_starter',
    name: 'Combo Starter',
    price: 999,
    mrp: 3400,
    discountPercentage: 71,
    duration: 'Lifetime Access',
    optimizations: 50,
    scoreChecks: 50,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-sky-500 to-blue-500',
    icon: 'briefcase',
    features: ['50 JD-Based Resume Optimizations', '50 Resume Score Checks'],
    popular: false,
    durationInHours: 0,
  },
  {
    id: 'combo_pro',
    name: 'Combo Pro',
    price: 1899,
    mrp: 6800,
    discountPercentage: 72,
    duration: 'Lifetime Access',
    optimizations: 100,
    scoreChecks: 100,
    linkedinMessages: 0,
    guidedBuilds: 0,
    sessions: 0,
    tag: '',
    tagColor: '',
    gradient: 'from-sky-500 to-blue-500',
    icon: 'briefcase',
    features: ['100 JD-Based Resume Optimizations', '100 Resume Score Checks'],
    popular: false,
    durationInHours: 0,
  },
];

export const paymentAddOns: PaymentAddOnConfig[] = [
  { id: 'jd_optimization_quick_5', name: 'Quick 5', price: 89, type: 'optimization', quantity: 5, optimizationTier: 'quick' },
  { id: 'jd_optimization_quick_10', name: 'Quick 10', price: 169, type: 'optimization', quantity: 10, optimizationTier: 'quick' },
  { id: 'jd_optimization_quick_25', name: 'Quick 25', price: 399, type: 'optimization', quantity: 25, optimizationTier: 'quick' },
  { id: 'jd_optimization_quick_50', name: 'Quick 50', price: 749, type: 'optimization', quantity: 50, optimizationTier: 'quick' },
  { id: 'jd_optimization_smart_5', name: 'Smart 5', price: 239, type: 'optimization', quantity: 5, optimizationTier: 'smart' },
  { id: 'jd_optimization_smart_10', name: 'Smart 10', price: 469, type: 'optimization', quantity: 10, optimizationTier: 'smart' },
  { id: 'jd_optimization_smart_25', name: 'Smart 25', price: 999, type: 'optimization', quantity: 25, optimizationTier: 'smart' },
  { id: 'jd_optimization_smart_50', name: 'Smart 50', price: 1889, type: 'optimization', quantity: 50, optimizationTier: 'smart' },
  { id: 'jd_optimization_deep_5', name: 'Deep 5', price: 489, type: 'optimization', quantity: 5, optimizationTier: 'deep' },
  { id: 'jd_optimization_deep_10', name: 'Deep 10', price: 899, type: 'optimization', quantity: 10, optimizationTier: 'deep' },
  { id: 'jd_optimization_deep_25', name: 'Deep 25', price: 1999, type: 'optimization', quantity: 25, optimizationTier: 'deep' },
  { id: 'jd_optimization_deep_50', name: 'Deep 50', price: 3899, type: 'optimization', quantity: 50, optimizationTier: 'deep' },
  // Legacy products retained for pending orders created by older clients.
  { id: 'jd_optimization_quick', name: 'Quick Scan', price: 19, type: 'optimization', quantity: 1, optimizationTier: 'quick' },
  { id: 'jd_optimization_smart', name: 'Smart Optimize', price: 49, type: 'optimization', quantity: 1, optimizationTier: 'smart' },
  { id: 'jd_optimization_deep', name: 'Deep Optimize', price: 99, type: 'optimization', quantity: 1, optimizationTier: 'deep' },
  { id: 'jd_optimization_single_purchase', name: 'JD-Based Optimization (1 Use)', price: 19, type: 'optimization', quantity: 1, optimizationTier: 'quick' },
  { id: 'resume_score_check_single_purchase', name: 'Resume Score Check (1 Use)', price: 9, type: 'score_check', quantity: 1 },
  { id: 'guided_resume_build_single_purchase', name: 'Guided Resume Build (1 Use)', price: 29, type: 'guided_build', quantity: 1 },
  { id: 'linkedin_messages_50_purchase', name: 'LinkedIn Messages (50 Uses)', price: 29, type: 'linkedin_messages', quantity: 50 },
];

export const findSubscriptionPlan = (planId?: string | null): PaymentPlanConfig | undefined =>
  paymentPlans.find((plan) => plan.id === planId);

export const findPaymentAddOn = (addOnId?: string | null): PaymentAddOnConfig | undefined =>
  paymentAddOns.find((addOn) => addOn.id === addOnId);

export const getAddOnBundleCount = (
  addOn: PaymentAddOnConfig,
  requestedQuantity: number,
): number => {
  const safeRequestedQuantity = Number(requestedQuantity || 0);
  const bundleSize = Math.max(1, Number(addOn.quantity || 1));
  if (
    !Number.isInteger(safeRequestedQuantity) ||
    safeRequestedQuantity <= 0 ||
    safeRequestedQuantity % bundleSize !== 0
  ) {
    return 0;
  }

  return safeRequestedQuantity / bundleSize;
};

export const calculateSelectedAddOnsTotal = (
  selectedAddOns: Record<string, number> | undefined | null,
): number => {
  if (!selectedAddOns) {
    return 0;
  }

  return Object.entries(selectedAddOns).reduce((sum, [addOnId, requestedQuantity]) => {
    const addOn = findPaymentAddOn(addOnId);
    if (!addOn) {
      return sum;
    }

    return sum + getAddOnBundleCount(addOn, requestedQuantity) * addOn.price * 100;
  }, 0);
};
