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
}

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
  { id: 'jd_optimization_single_purchase', name: 'JD-Based Optimization (1 Use)', price: 19, type: 'optimization', quantity: 1 },
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
  const safeRequestedQuantity = Math.max(0, Number(requestedQuantity || 0));
  if (!safeRequestedQuantity) {
    return 0;
  }

  const bundleSize = Math.max(1, Number(addOn.quantity || 1));
  return Math.max(1, Math.round(safeRequestedQuantity / bundleSize));
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
