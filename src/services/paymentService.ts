// src/services/paymentService.ts
import { supabase } from '../lib/supabaseClient';
import { fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';
import { LIFETIME_PLAN_END_DATE_ISO } from '../utils/subscriptionLifetime';

// ---------- Types ----------
export type { PlanCategory } from '../types/payment';
export type { SubscriptionPlan } from '../types/payment';
import type { SubscriptionPlan, PlanCategory } from '../types/payment';

export interface PaymentData {
  planId: string;
  amount: number;
  currency: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface PurchaseProcessResult {
  success: boolean;
  error?: string;
  suggestionMessage?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string;
  optimizationsUsed: number;
  optimizationsTotal: number;
  paymentId: string | null;
  couponUsed: string | null;
  scoreChecksUsed: number;
  scoreChecksTotal: number;
  linkedinMessagesUsed: number;
  linkedinMessagesTotal: number;
  guidedBuildsUsed: number;
  guidedBuildsTotal: number;
}

// Credit types map 1:1 with addon_types.type_key and with our internal useCredit API
type CreditType = 'optimization' | 'score_check' | 'linkedin_messages' | 'guided_build';
const OUTDATED_PRICING_PLAN_COUPON_FUNCTIONS_LOG_MESSAGE =
  'Pricing plan coupon support is incomplete on the server. Apply migration 20260312160000_add_pricing_plan_coupons.sql and deploy the latest validate-coupon, create-order, and create-free-subscription functions in Supabase.';
const TEMPORARY_PRICING_PLAN_COUPON_MESSAGE =
  "Coupon system isn't fully configured right now. Please contact support or try again later.";
const EXPIRED_SESSION_MESSAGE =
  'Your session has expired. Please sign in again.';

// ---------- Service ----------
class PaymentService {
  // ----- Plans (static catalog) -----
  private plans: SubscriptionPlan[] = [
    // COMBINED PREMIUM PLANS
    {
      id: 'career_boost',
      name: 'Career Boost Plan',
      price: 1999,
      mrp: 3925,
      discountPercentage: Math.round((1 - 1999 / 3925) * 100),
      duration: 'Lifetime Access',
      optimizations: 50,
      scoreChecks: 25,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 1,
      category: 'combined',
      tag: 'Premium',
      tagColor: 'text-emerald-800 bg-emerald-100',
      gradient: 'from-emerald-500 to-cyan-500',
      icon: 'zap',
      features: [
        '50 JD-Based Resume Optimizations',
        '25 Resume Score Checks',
        '1 Resume Review Session',
      ],
      popular: false,
      durationInHours: 0,
    },
    {
      id: 'career_pro',
      name: 'Career Pro Plan',
      price: 2999,
      mrp: 6850,
      discountPercentage: Math.round((1 - 2999 / 6850) * 100),
      duration: 'Lifetime Access',
      optimizations: 100,
      scoreChecks: 50,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 1,
      category: 'combined',
      tag: 'Most Popular',
      tagColor: 'text-amber-800 bg-amber-100',
      gradient: 'from-amber-500 to-orange-500',
      icon: 'crown',
      features: [
        '100 JD-Based Resume Optimizations',
        '50 Resume Score Checks',
        '1 Resume Review Session',
      ],
      popular: true,
      durationInHours: 0,
    },
    // JD-BASED OPTIMIZER ONLY
    {
      id: 'jd_starter',
      name: 'JD Starter',
      price: 89,
      mrp: 245,
      discountPercentage: Math.round((1 - 89 / 245) * 100),
      duration: 'Lifetime Access',
      optimizations: 5,
      scoreChecks: 0,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'jd_only',
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
      discountPercentage: Math.round((1 - 169 / 490) * 100),
      duration: 'Lifetime Access',
      optimizations: 10,
      scoreChecks: 0,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'jd_only',
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
      discountPercentage: Math.round((1 - 799 / 2450) * 100),
      duration: 'Lifetime Access',
      optimizations: 50,
      scoreChecks: 0,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'jd_only',
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
      discountPercentage: Math.round((1 - 1499 / 4900) * 100),
      duration: 'Lifetime Access',
      optimizations: 100,
      scoreChecks: 0,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'jd_only',
      tag: '',
      tagColor: '',
      gradient: 'from-teal-500 to-emerald-500',
      icon: 'target',
      features: ['100 JD-Based Resume Optimizations'],
      popular: false,
      durationInHours: 0,
    },
    // RESUME SCORE CHECKER ONLY
    {
      id: 'score_starter',
      name: 'Score Starter',
      price: 39,
      mrp: 95,
      discountPercentage: Math.round((1 - 39 / 95) * 100),
      duration: 'Lifetime Access',
      optimizations: 0,
      scoreChecks: 5,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'score_only',
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
      discountPercentage: Math.round((1 - 79 / 190) * 100),
      duration: 'Lifetime Access',
      optimizations: 0,
      scoreChecks: 10,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'score_only',
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
      discountPercentage: Math.round((1 - 349 / 950) * 100),
      duration: 'Lifetime Access',
      optimizations: 0,
      scoreChecks: 50,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'score_only',
      tag: '',
      tagColor: '',
      gradient: 'from-blue-500 to-cyan-500',
      icon: 'check_circle',
      features: ['50 Resume Score Checks'],
      popular: false,
      durationInHours: 0,
    },
    // JD + RESUME SCORE (NO SESSION)
    {
      id: 'combo_starter',
      name: 'Combo Starter',
      price: 999,
      mrp: 3400,
      discountPercentage: Math.round((1 - 999 / 3400) * 100),
      duration: 'Lifetime Access',
      optimizations: 50,
      scoreChecks: 50,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'combo',
      tag: '',
      tagColor: '',
      gradient: 'from-sky-500 to-blue-500',
      icon: 'briefcase',
      features: [
        '50 JD-Based Resume Optimizations',
        '50 Resume Score Checks',
      ],
      popular: false,
      durationInHours: 0,
    },
    {
      id: 'combo_pro',
      name: 'Combo Pro',
      price: 1899,
      mrp: 6800,
      discountPercentage: Math.round((1 - 1899 / 6800) * 100),
      duration: 'Lifetime Access',
      optimizations: 100,
      scoreChecks: 100,
      linkedinMessages: 0,
      guidedBuilds: 0,
      sessions: 0,
      category: 'combo',
      tag: '',
      tagColor: '',
      gradient: 'from-sky-500 to-blue-500',
      icon: 'briefcase',
      features: [
        '100 JD-Based Resume Optimizations',
        '100 Resume Score Checks',
      ],
      popular: false,
      durationInHours: 0,
    },
  ];

  // ----- Add-ons (static catalog) -----
  private addOns = [
    // Purchasable singles
    { id: 'jd_optimization_single_purchase',   name: 'JD-Based Optimization (1 Use)',     price: 19,  type: 'optimization',      quantity: 1 },
    { id: 'resume_score_check_single_purchase',  name: 'Resume Score Check (1 Use)',      price: 9,   type: 'score_check',       quantity: 1 },
    { id: 'guided_resume_build_single_purchase', name: 'Guided Resume Build (1 Use)',     price: 29,  type: 'guided_build',      quantity: 1 },
    { id: 'linkedin_messages_50_purchase',       name: 'LinkedIn Messages (50 Uses)',     price: 29,  type: 'linkedin_messages', quantity: 50 },
  ];

  // ---------- Catalog helpers ----------
  getPlans(): SubscriptionPlan[] {
    return this.plans;
  }
  getPlansByCategory(category: PlanCategory): SubscriptionPlan[] {
    return this.plans.filter((p) => p.category === category);
  }
  getAddOns(): any[] {
    return this.addOns;
  }
  getPlanById(id: string): SubscriptionPlan | undefined {
    return this.plans.find((p) => p.id === id);
  }
  getAddOnById(id: string): any | undefined {
    // Match by the requested add-on id; the previous self-comparison always returned the first add-on
    return this.addOns.find((a) => a.id === id);
  }

  private getPostPurchaseSuggestion(
    planId: string,
    selectedAddOns?: { [key: string]: number }
  ): string {
    const plan = planId !== 'addon_only_purchase' ? this.getPlanById(planId) : undefined;
    const capabilities = new Set<string>();

    if (plan?.optimizations) capabilities.add('optimization');
    if (plan?.scoreChecks) capabilities.add('score_check');
    if (plan?.guidedBuilds) capabilities.add('guided_build');
    if (plan?.linkedinMessages) capabilities.add('linkedin_messages');

    for (const addOnId of Object.keys(selectedAddOns || {})) {
      const addOn = this.getAddOnById(addOnId);
      if (addOn?.type) capabilities.add(addOn.type);
    }

    if (capabilities.has('optimization') && capabilities.has('score_check')) {
      return 'Suggested next step: open Resume Optimizer, tailor your resume to a target JD, then validate the updated version in Score Checker.';
    }
    if (capabilities.has('optimization')) {
      return 'Suggested next step: open Resume Optimizer and run your first JD-based optimization.';
    }
    if (capabilities.has('score_check')) {
      return 'Suggested next step: open Score Checker and run your first resume analysis.';
    }
    if (capabilities.has('guided_build')) {
      return 'Suggested next step: open Guided Builder and start your guided resume build.';
    }
    if (capabilities.has('linkedin_messages')) {
      return 'Suggested next step: open LinkedIn Generator and create your first outreach message.';
    }

    return 'Suggested next step: open your dashboard and start using your new access right away.';
  }

  // ---------- Core subscription fetch (combined with add-ons) ----------
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    console.log('PaymentService: Fetching user subscription for userId:', userId);
    try {
      // All active subscriptions
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('PaymentService: Error fetching user subscriptions:', error.message, error.details);
        return null;
      }

      // Cumulate credits across *all* active subscriptions
      let cumulativeOptimizationsUsed = 0;
      let cumulativeOptimizationsTotal = 0;
      let cumulativeScoreChecksUsed = 0;
      let cumulativeScoreChecksTotal = 0;
      let cumulativeLinkedinMessagesUsed = 0;
      let cumulativeLinkedinMessagesTotal = 0;
      let cumulativeGuidedBuildsUsed = 0;
      let cumulativeGuidedBuildsTotal = 0;

      let latestSubscriptionId: string | null = null;
      let latestPlanId: string | null = null;
      let latestStatus = 'inactive';
      let latestStartDate = '';
      let latestEndDate = '';
      let latestPaymentId: string | null = null;
      let latestCouponUsed: string | null = null;

      if (subscriptions && subscriptions.length > 0) {
        subscriptions.forEach((sub: any) => {
          cumulativeOptimizationsUsed  += Number(sub.optimizations_used  ?? 0);
          cumulativeOptimizationsTotal += Number(sub.optimizations_total ?? 0);
          cumulativeScoreChecksUsed    += Number(sub.score_checks_used   ?? 0);
          cumulativeScoreChecksTotal   += Number(sub.score_checks_total  ?? 0);
          cumulativeLinkedinMessagesUsed  += Number(sub.linkedin_messages_used  ?? 0);
          cumulativeLinkedinMessagesTotal += Number(sub.linkedin_messages_total ?? 0);
          cumulativeGuidedBuildsUsed   += Number(sub.guided_builds_used  ?? 0);
          cumulativeGuidedBuildsTotal  += Number(sub.guided_builds_total ?? 0);
        });

        const latestSub = subscriptions[0];
        latestSubscriptionId = latestSub.id;
        latestPlanId = latestSub.plan_id;
        latestStatus = latestSub.status;
        latestStartDate = latestSub.start_date;
        latestEndDate = latestSub.end_date;
        latestPaymentId = latestSub.payment_id;
        latestCouponUsed = latestSub.coupon_used;
      }

      // Include ALL user add-on credits (used + remaining), for accurate "used" derivation
      const { data: addonCreditsData, error: addonCreditsError } = await supabase
        .from('user_addon_credits')
        .select(`
          id,
          user_id,
          addon_type_id,
          quantity_purchased,
          quantity_remaining,
          addon_types(type_key)
        `)
        .eq('user_id', userId); // IMPORTANT: scope to user

      console.log('PaymentService: Fetched raw add-on credits data:', addonCreditsData);

      if (addonCreditsError) {
        console.error('PaymentService: Error fetching add-on credits:', addonCreditsError.message, addonCreditsError.details);
      }

      // Aggregate add-on totals/used by type_key
      const aggregatedAddonCredits: Record<string, { total: number; used: number }> = {
        optimization: { total: 0, used: 0 },
        score_check: { total: 0, used: 0 },
        linkedin_messages: { total: 0, used: 0 },
        guided_build: { total: 0, used: 0 },
      };

      (addonCreditsData || []).forEach((credit: any) => {
        const typeKey = (credit.addon_types as { type_key: string })?.type_key;
        const purchased = Number(credit.quantity_purchased ?? 0);
        const remaining = Number(credit.quantity_remaining ?? 0);
        if (aggregatedAddonCredits[typeKey]) {
          aggregatedAddonCredits[typeKey].total += purchased;
          aggregatedAddonCredits[typeKey].used  += Math.max(0, purchased - remaining);
        }
        console.log(
          `PaymentService: Processing add-on credit - typeKey: ${typeKey}, purchased: ${purchased}, remaining: ${remaining}`
        );
      });

      console.log('PaymentService: Aggregated add-on credits:', aggregatedAddonCredits);

      const finalOptimizationsTotal   = cumulativeOptimizationsTotal   + aggregatedAddonCredits.optimization.total;
      const finalScoreChecksTotal     = cumulativeScoreChecksTotal     + aggregatedAddonCredits.score_check.total;
      const finalLinkedinMessagesTotal= cumulativeLinkedinMessagesTotal+ aggregatedAddonCredits.linkedin_messages.total;
      const finalGuidedBuildsTotal    = cumulativeGuidedBuildsTotal    + aggregatedAddonCredits.guided_build.total;

      const finalOptimizationsUsed    = cumulativeOptimizationsUsed    + aggregatedAddonCredits.optimization.used;
      const finalScoreChecksUsed      = cumulativeScoreChecksUsed      + aggregatedAddonCredits.score_check.used;
      const finalLinkedinMessagesUsed = cumulativeLinkedinMessagesUsed + aggregatedAddonCredits.linkedin_messages.used;
      const finalGuidedBuildsUsed     = cumulativeGuidedBuildsUsed     + aggregatedAddonCredits.guided_build.used;

      // If no plan and no add-ons → no credits
      const hasAnyCredits =
        finalOptimizationsTotal > 0 ||
        finalScoreChecksTotal > 0 ||
        finalLinkedinMessagesTotal > 0 ||
        finalGuidedBuildsTotal > 0;

      if (!hasAnyCredits) {
        console.log('PaymentService: No active subscription or add-on credits found for user:', userId);
        return null;
      }

      const currentSubscription: Subscription = {
        id: latestSubscriptionId || 'virtual-addon-subscription',
        userId,
        planId: latestPlanId || 'addon_only',
        status: latestStatus,
        startDate: latestStartDate || new Date().toISOString(),
        endDate: latestEndDate || LIFETIME_PLAN_END_DATE_ISO,
        paymentId: latestPaymentId,
        couponUsed: latestCouponUsed,

        optimizationsUsed: finalOptimizationsUsed,
        optimizationsTotal: finalOptimizationsTotal,

        scoreChecksUsed: finalScoreChecksUsed,
        scoreChecksTotal: finalScoreChecksTotal,

        linkedinMessagesUsed: finalLinkedinMessagesUsed,
        linkedinMessagesTotal: finalLinkedinMessagesTotal,

        guidedBuildsUsed: finalGuidedBuildsUsed,
        guidedBuildsTotal: finalGuidedBuildsTotal,
      };

      if ((subscriptions?.length ?? 0) === 0 && hasAnyCredits) {
        currentSubscription.status = 'active';
        currentSubscription.endDate = LIFETIME_PLAN_END_DATE_ISO;
      }

      console.log('PaymentService: Final combined subscription and add-on credits object:', currentSubscription);
      console.log('PaymentService: Successfully fetched combined subscription and add-on credits:', currentSubscription);
      return currentSubscription;
    } catch (err: any) {
      console.error('PaymentService: Unexpected error in getUserSubscription:', err.message);
      return null;
    }
  }

  // ---------- Helper: authoritative remaining calculation from tables ----------
  private async computeRemainingFromTables(userId: string, creditField: CreditType): Promise<number> {
    const dbFieldMap: Record<CreditType, string> = {
      optimization: 'optimizations',
      score_check: 'score_checks',
      linkedin_messages: 'linkedin_messages',
      guided_build: 'guided_builds',
    };
    const base = dbFieldMap[creditField];
    const totalField = `${base}_total`;
    const usedField = `${base}_used`;

    // Plan remaining
    const { data: subs, error: subsErr } = await supabase
      .from('subscriptions')
      .select(`id, ${totalField}, ${usedField}`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (subsErr) {
      console.error('computeRemainingFromTables: subsErr', subsErr.message, subsErr.details);
    }

    const planRemaining = (subs || []).reduce((sum, s: any) => {
      const t = Number(s[totalField] ?? 0);
      const u = Number(s[usedField] ?? 0);
      return sum + Math.max(0, t - u);
    }, 0);

    // Add-on remaining
    const { data: addons, error: addErr } = await supabase
      .from('user_addon_credits')
      .select(`quantity_remaining, addon_types(type_key)`)
      .eq('user_id', userId);

    if (addErr) {
      console.error('computeRemainingFromTables: addErr', addErr.message, addErr.details);
    }

    const addonRemaining = (addons || []).reduce((sum, r: any) => {
      const key = (r.addon_types as { type_key: string })?.type_key;
      if (key === creditField) {
        return sum + Number(r.quantity_remaining ?? 0);
      }
      return sum;
    }, 0);

    return planRemaining + addonRemaining;
  }

  // ---------- Generic credit use (prefers add-ons) ----------
  private async useCredit(
    userId: string,
    creditField: CreditType
  ): Promise<{ success: boolean; remaining?: number; error?: string }> {
    const dbCreditFieldMap: Record<CreditType, string> = {
      optimization: 'optimizations',
      score_check: 'score_checks',
      linkedin_messages: 'linkedin_messages',
      guided_build: 'guided_builds',
    };
    const dbCreditFieldName = dbCreditFieldMap[creditField];
    if (!dbCreditFieldName) {
      console.error(`PaymentService: Invalid creditField provided: ${creditField}`);
      return { success: false, error: 'Invalid credit type.' };
    }

    const totalField = `${dbCreditFieldName}_total`;
    const usedField = `${dbCreditFieldName}_used`;

    console.log(`PaymentService: Attempting to use ${creditField} (DB field: ${dbCreditFieldName}) for userId:`, userId);

    try {
      // --- Prefer add-on credits first ---
      const { data: addonCredits, error: addonError } = await supabase
        .from('user_addon_credits')
        .select(`id, user_id, quantity_remaining, quantity_purchased, addon_types(type_key)`)
        .eq('user_id', userId)
        .order('purchased_at', { ascending: true });

      if (addonError) {
        console.error(`PaymentService: Error fetching add-on credits for ${creditField}:`, addonError.message, addonError.details);
        // fall through to plan credits even on error
      }

      const relevantAddon = addonCredits?.find(
        (c: any) =>
          (c.addon_types as { type_key: string })?.type_key === creditField &&
          Number(c.quantity_remaining ?? 0) > 0
      );

      if (relevantAddon && Number(relevantAddon.quantity_remaining) > 0) {
        const newRemaining = Number(relevantAddon.quantity_remaining) - 1;

        console.log(`PaymentService: Found add-on credit ${relevantAddon.id}. Current remaining: ${relevantAddon.quantity_remaining}. New remaining: ${newRemaining}`);
        console.log(`PaymentService: Attempting to update add-on credit with ID: ${relevantAddon.id} for user: ${userId}`);
        console.log(`PaymentService: Relevant Addon details for update:`, JSON.stringify(relevantAddon, null, 2));
        console.log(`PaymentService: User ID for update: ${userId}`);

        // Atomic update + return the updated row from writer
        const { data: updated, error: updateAddonError } = await supabase
          .from('user_addon_credits')
          .update({ quantity_remaining: newRemaining })
          .eq('id', relevantAddon.id)
          .eq('user_id', userId) // required for RLS
          // REMOVED: .gt('quantity_remaining', 0) // This line was causing the issue
          .select('id, quantity_remaining'); // Removed .maybeSingle()

        if (updateAddonError) { // Check for error object directly
          console.error(`PaymentService: CRITICAL ERROR updating add-on credit usage for ${creditField}:`, updateAddonError.message, updateAddonError.details);
          return { success: false, error: 'Failed to update add-on credit usage.' };
        }

        if (!updated || updated.length === 0) { // Check if no rows were actually updated
          console.warn(`PaymentService: Add-on credit update returned 0 rows for ID ${relevantAddon.id}. It might have been consumed or updated by another process.`);
          // If no row was updated, it means the credit was already consumed or didn't meet the criteria.
          // In this case, we should fall back to subscription credits or report failure.
          // For now, let's proceed to subscription check if this fails.
        } else {
          console.log(`PaymentService: Successfully updated add-on credit ${relevantAddon.id} to ${newRemaining} remaining.`);
          // Diagnostic delay: Wait a bit to ensure DB update propagates
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

          // Re-calculate total remaining across all subscriptions and add-ons for the return value
          const updatedSubscriptionState = await this.getUserSubscription(userId);
          
          let totalPropName: keyof Subscription;
          let usedPropName: keyof Subscription;

          switch (creditField) {
            case 'optimization':
              totalPropName = 'optimizationsTotal';
              usedPropName = 'optimizationsUsed';
              break;
            case 'score_check':
              totalPropName = 'scoreChecksTotal';
              usedPropName = 'scoreChecksUsed';
              break;
            case 'linkedin_messages':
              totalPropName = 'linkedinMessagesTotal';
              usedPropName = 'linkedinMessagesUsed';
              break;
            case 'guided_build':
              totalPropName = 'guidedBuildsTotal';
              usedPropName = 'guidedBuildsUsed';
              break;
            default:
              throw new Error('Unknown credit type for total/used property names.');
          }

          const totalRemaining = updatedSubscriptionState ? updatedSubscriptionState[totalPropName] - updatedSubscriptionState[usedPropName] : 0;
          console.log(`PaymentService: After update, calculated total remaining: ${totalRemaining}`);
          return { success: true, remaining: totalRemaining };
        }
      }

      // --- Fallback: use plan credits if add-ons are exhausted/not present ---
      const { data: activeSubscriptions, error: fetchError } = await supabase
        .from('subscriptions')
        .select(`id, ${usedField}, ${totalField}`)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error(`PaymentService: Error fetching active subscriptions for ${creditField}:`, fetchError.message, fetchError.details);
        return { success: false, error: 'Failed to fetch active subscriptions.' };
      }

      let usedFromSubscription = false;
      for (const sub of activeSubscriptions || []) {
        const currentUsed = Number(sub[usedField] ?? 0);
        const currentTotal = Number(sub[totalField] ?? 0);
        if (currentUsed < currentTotal) {
          const newUsed = currentUsed + 1;

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ [usedField]: newUsed, updated_at: new Date().toISOString() })
            .eq('id', sub.id);

          if (updateError) {
            console.error(`PaymentService: Error updating ${usedField} for subscription ${sub.id}:`, updateError.message, updateError.details);
            return { success: false, error: 'Failed to update credit usage in subscription.' };
          }

          const updatedRemaining = await this.computeRemainingFromTables(userId, creditField);
          console.log(`PaymentService: Used 1 ${creditField} plan credit. Remaining total (plan + add-ons): ${updatedRemaining}`);
          usedFromSubscription = true;
          break;
        }
      }

      if (usedFromSubscription) {
        // Re-calculate total remaining across all subscriptions and add-ons for the return value
        const updatedSubscriptionState = await this.getUserSubscription(userId);
        
        let totalPropName: keyof Subscription;
        let usedPropName: keyof Subscription;

        switch (creditField) {
          case 'optimization':
            totalPropName = 'optimizationsTotal';
            usedPropName = 'optimizationsUsed';
            break;
          case 'score_check':
            totalPropName = 'scoreChecksTotal';
            usedPropName = 'scoreChecksUsed';
            break;
          case 'linkedin_messages':
            totalPropName = 'linkedinMessagesTotal';
            usedPropName = 'linkedinMessagesUsed';
            break;
          case 'guided_build':
            totalPropName = 'guidedBuildsTotal';
            usedPropName = 'guidedBuildsUsed';
            break;
          default:
            throw new Error('Unknown credit type for total/used property names.');
        }

        const totalRemaining = updatedSubscriptionState ? updatedSubscriptionState[totalPropName] - updatedSubscriptionState[usedPropName] : 0;
        return { success: true, remaining: totalRemaining };
      }

      console.warn(`PaymentService: No active subscription or add-on credits found for ${creditField} for userId:`, userId);
      return { success: false, error: 'No active subscription or add-on credits found.' };
    } catch (err: any) {
      console.error(`PaymentService: Unexpected error in useCredit (${creditField}):`, err.message);
      return { success: false, error: 'An unexpected error occurred while using credits.' };
    }
  }

  // ---------- Public credit-usage APIs ----------
  async useOptimization(userId: string) {
    return this.useCredit(userId, 'optimization');
  }
  async useScoreCheck(userId: string) {
    return this.useCredit(userId, 'score_check');
  }
  async useLinkedInMessage(userId: string) {
    return this.useCredit(userId, 'linkedin_messages');
  }
  async useGuidedBuild(userId: string) {
    return this.useCredit(userId, 'guided_build');
  }

  // ---------- Free trial ----------
  async activateFreeTrial(userId: string): Promise<void> {
    console.log('PaymentService: Attempting to activate free trial for userId:', userId);
    try {
      const { data: existingTrial, error: fetchError } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('plan_id', 'lite_check')
        .maybeSingle();

      if (fetchError) {
        console.error('PaymentService: Error checking for existing free trial:', fetchError.message, fetchError.details);
        throw new Error('Failed to check for existing free trial.');
      }
      if (existingTrial) {
        console.log('PaymentService: User already has a free trial, skipping activation.');
        return;
      }

      const freePlan = this.getPlanById('lite_check');
      if (!freePlan) throw new Error('Free trial plan configuration not found.');
      if (typeof freePlan.durationInHours !== 'number' || !isFinite(freePlan.durationInHours)) {
        console.error('PaymentService: Invalid durationInHours detected for plan:', freePlan);
        throw new Error('Invalid plan duration configuration. Please contact support.');
      }

      const { error: insertError } = await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: freePlan.id,
        status: 'active',
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + freePlan.durationInHours * 60 * 60 * 1000).toISOString(),
        optimizations_used: 0,
        optimizations_total: freePlan.optimizations,
        score_checks_used: 0,
        score_checks_total: freePlan.scoreChecks,
        linkedin_messages_used: 0,
        linkedin_messages_total: freePlan.linkedinMessages,
        guided_builds_used: 0,
        guided_builds_total: freePlan.guidedBuilds,
        payment_id: null,
        coupon_used: 'free_trial',
      });

      if (insertError) {
        console.error('PaymentService: Error activating free trial:', insertError.message, insertError.details);
        throw new Error('Failed to activate free trial.');
      }
      console.log('PaymentService: Free trial activated successfully for userId:', userId);
    } catch (error: any) {
      console.error('PaymentService: Unexpected error in activateFreeTrial:', error.message);
      throw error;
    }
  }

  // ---------- Coupon helpers ----------
  private async getVerifiedAccessToken(preferredAccessToken?: string): Promise<string> {
    const validateToken = async (token?: string | null): Promise<string | null> => {
      if (!token) {
        return null;
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        console.warn('PaymentService: Access token validation failed.', error?.message || 'User not found.');
        return null;
      }

      return token;
    };

    const preferredToken = await validateToken(preferredAccessToken);
    if (preferredToken) {
      return preferredToken;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('PaymentService: Failed to read current session.', sessionError.message);
    }

    const currentSessionToken = await validateToken(session?.access_token);
    if (currentSessionToken) {
      return currentSessionToken;
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session?.access_token) {
      console.error('PaymentService: Session refresh failed for authenticated request.', refreshError?.message || 'Missing refreshed session.');
      throw new Error(EXPIRED_SESSION_MESSAGE);
    }

    const refreshedToken = await validateToken(refreshData.session.access_token);
    if (refreshedToken) {
      return refreshedToken;
    }

    throw new Error(EXPIRED_SESSION_MESSAGE);
  }

  private async validateCouponServer(
    couponCode: string,
    planId: string,
    userId: string,
    accessToken: string
  ) {
    try {
      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('validate-coupon'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ couponCode, userId, planId, purchaseType: 'subscription' }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('Error from validate-coupon Edge Function:', result.message || response.statusText);
        return {
          isValid: false,
          message: result.message || 'Failed to validate coupon on server.',
          couponApplied: null,
          discountPercentage: 0,
          discountAmount: 0,
          finalAmount: 0,
        };
      }
      return result as {
        isValid: boolean;
        message: string;
        couponApplied?: string | null;
        discountPercentage?: number;
        discountAmount?: number;
        finalAmount?: number;
      };
    } catch (error: any) {
      console.error('Network error during coupon validation:', error.message);
      return {
        isValid: false,
        message: 'Network error during coupon validation. Please try again.',
        couponApplied: null,
        discountPercentage: 0,
        discountAmount: 0,
        finalAmount: 0,
      };
    }
  }

  async applyCoupon(
    planId: string,
    couponCode: string,
    userId: string | null
  ): Promise<{ couponApplied: string | null; discountAmount: number; finalAmount: number; error?: string; isValid: boolean; message: string }> {
    const plan = this.getPlanById(planId);
    if (!plan && planId !== 'addon_only_purchase') {
      return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: 'Invalid plan selected', isValid: false, message: 'Invalid plan selected' };
    }

    if (userId) {
      let accessToken: string;
      try {
        accessToken = await this.getVerifiedAccessToken();
      } catch (error: any) {
        const message = error?.message || EXPIRED_SESSION_MESSAGE;
        return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: message, isValid: false, message };
      }

      const serverValidation = await this.validateCouponServer(couponCode, planId, userId, accessToken);
      if (!serverValidation.isValid) {
        return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: serverValidation.message, isValid: false, message: serverValidation.message };
      }

      const originalPrice = (plan?.price || 0) * 100;
      const rawDiscountPercentage = Number(serverValidation.discountPercentage);
      const rawDiscountAmount = Number(serverValidation.discountAmount);
      const rawFinalAmount = Number(serverValidation.finalAmount);
      const hasCompleteServerTotals =
        Number.isFinite(rawDiscountPercentage) &&
        Number.isFinite(rawDiscountAmount) &&
        Number.isFinite(rawFinalAmount);

      if (!hasCompleteServerTotals) {
        console.warn(OUTDATED_PRICING_PLAN_COUPON_FUNCTIONS_LOG_MESSAGE, {
          couponCode: couponCode.trim().toUpperCase(),
          planId,
          serverValidation,
        });
        return {
          couponApplied: null,
          discountAmount: 0,
          finalAmount: originalPrice,
          error: TEMPORARY_PRICING_PLAN_COUPON_MESSAGE,
          isValid: false,
          message: TEMPORARY_PRICING_PLAN_COUPON_MESSAGE,
        };
      }

      const discountPercentage = Math.max(0, Math.min(100, Math.round(rawDiscountPercentage)));
      const discountAmount = Math.max(0, Math.min(originalPrice, Math.round(rawDiscountAmount)));
      const finalAmount = Math.max(0, Math.min(originalPrice, Math.round(rawFinalAmount)));

      if (discountPercentage === 0 && discountAmount === 0 && finalAmount === originalPrice) {
        console.warn(OUTDATED_PRICING_PLAN_COUPON_FUNCTIONS_LOG_MESSAGE, {
          couponCode: couponCode.trim().toUpperCase(),
          planId,
          serverValidation,
        });
        return {
          couponApplied: null,
          discountAmount: 0,
          finalAmount: originalPrice,
          error: TEMPORARY_PRICING_PLAN_COUPON_MESSAGE,
          isValid: false,
          message: TEMPORARY_PRICING_PLAN_COUPON_MESSAGE,
        };
      }

      return {
        couponApplied: serverValidation.couponApplied || couponCode.trim().toUpperCase(),
        discountAmount,
        finalAmount,
        isValid: true,
        message: serverValidation.message,
      };
    }

    return { couponApplied: null, discountAmount: 0, finalAmount: 0, error: 'Authentication required for coupon validation', isValid: false, message: 'Authentication required for coupon validation' };
  }

  private async cancelPendingTransaction(transactionId: string, accessToken: string): Promise<void> {
    try {
      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('cancel-payment-transaction'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ transactionId }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        console.error('PaymentService: Failed to cancel pending transaction:', result.error || response.statusText);
      }
    } catch (error: any) {
      console.error('PaymentService: Error cancelling pending transaction:', error.message);
    }
  }

  // ---------- Payment / free subscription flows ----------
  async processPayment(
    paymentData: { planId: string; amount: number; currency: string },
    userEmail: string,
    userName: string,
    accessToken: string,
    couponCode?: string,
    walletDeduction?: number,
    addOnsTotal?: number,
    selectedAddOns?: { [key: string]: number }
  ): Promise<PurchaseProcessResult> {
    try {
      const verifiedAccessToken = await this.getVerifiedAccessToken(accessToken);

      console.log('PaymentService: Calling create-order Edge Function...');
      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('create-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${verifiedAccessToken}` },
        body: JSON.stringify({
          planId: paymentData.planId,
          amount: paymentData.amount, // paise
          couponCode,
          walletDeduction,
          addOnsTotal,
          selectedAddOns,
        }),
      });

      const orderResult = await response.json();
      if (!response.ok) {
        console.error('PaymentService: Error from create-order:', orderResult.error || response.statusText);
        return { success: false, error: orderResult.error || 'Failed to create order.' };
      }

      const { orderId, amount, keyId, currency, transactionId } = orderResult;

      return new Promise((resolve) => {
        const options = {
          key: keyId,
          amount,
          currency,
          name: 'PrimoBoost AI',
          description: 'Resume Optimization Plan',
          order_id: orderId,
          handler: async (rzpRes: any) => {
            try {
                console.log('PaymentService: Calling verify-payment Edge Function...');
                const verifyResponse = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('verify-payment'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${verifiedAccessToken}` },
                  body: JSON.stringify({
                    razorpay_order_id: rzpRes.razorpay_order_id,
                    razorpay_payment_id: rzpRes.razorpay_payment_id,
                  razorpay_signature: rzpRes.razorpay_signature,
                  transactionId,
                }),
              });

              const verifyResult = await verifyResponse.json();
              if (verifyResponse.ok && verifyResult.success) {
                resolve({
                  success: true,
                  suggestionMessage:
                    verifyResult.suggestionMessage ||
                    this.getPostPurchaseSuggestion(paymentData.planId, selectedAddOns),
                });
              } else {
                console.error('PaymentService: Error from verify-payment:', verifyResult.error || verifyResponse.statusText);
                resolve({ success: false, error: verifyResult.error || 'Payment verification failed.' });
              }
            } catch (error: any) {
              console.error('PaymentService: Error during payment verification:', error.message);
              resolve({ success: false, error: 'An error occurred during payment verification.' });
            }
          },
          prefill: { name: userName, email: userEmail },
          theme: { color: '#4F46E5' },
          modal: {
            ondismiss: async () => {
              console.log('PaymentService: Payment modal dismissed.');
              await this.cancelPendingTransaction(transactionId, verifiedAccessToken);
              resolve({ success: false, error: 'Payment cancelled by user.' });
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      });
    } catch (error: any) {
      console.error('PaymentService: Error in processPayment:', error.message);
      return { success: false, error: error.message || 'Failed to process payment.' };
    }
  }

  async processFreeSubscription(
    planId: string,
    userId: string,
    couponCode?: string,
    addOnsTotal?: number,
    selectedAddOns?: { [key: string]: number },
    originalPlanAmount?: number, // paise
    walletDeduction?: number     // paise
  ): Promise<PurchaseProcessResult> {
    try {
      console.log('PaymentService: Processing free subscription...');
      const verifiedAccessToken = await this.getVerifiedAccessToken();

      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('create-free-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${verifiedAccessToken}` },
        body: JSON.stringify({
          planId,
          userId,
          couponCode,
          selectedAddOns,
          walletDeduction,
          addOnsTotal,
          originalPlanAmount,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        return {
          success: false,
          error: result?.error || 'Failed to activate free subscription.',
        };
      }

      return {
        success: true,
        suggestionMessage:
          result?.suggestionMessage || this.getPostPurchaseSuggestion(planId, selectedAddOns),
      };
    } catch (error: any) {
      console.error('PaymentService: Unexpected error in processFreeSubscription:', error.message);
      return { success: false, error: error.message || 'Failed to activate free subscription.' };
    }
  }

  async getAddOnCreditsByType(userId: string, creditType: CreditType): Promise<number> {
    console.log(`PaymentService: Fetching add-on credits for userId: ${userId}, creditType: ${creditType}`);
    try {
      const { data: addonType, error: addonTypeError } = await supabase
        .from('addon_types')
        .select('id')
        .eq('type_key', creditType)
        .maybeSingle();

      if (addonTypeError) {
        console.error('PaymentService: Error fetching addon_type:', addonTypeError.message);
        return 0;
      }

      if (!addonType) {
        console.warn(`PaymentService: No addon_type found for type_key: ${creditType}`);
        return 0;
      }

      const { data: credits, error: creditsError } = await supabase
        .from('user_addon_credits')
        .select('quantity_remaining')
        .eq('user_id', userId)
        .eq('addon_type_id', addonType.id)
        .gt('quantity_remaining', 0);

      if (creditsError) {
        console.error('PaymentService: Error fetching user add-on credits:', creditsError.message);
        return 0;
      }

      const totalCredits = credits?.reduce((sum, credit) => sum + credit.quantity_remaining, 0) || 0;
      console.log(`PaymentService: Total add-on credits for ${creditType}: ${totalCredits}`);
      return totalCredits;
    } catch (error: any) {
      console.error('PaymentService: Unexpected error in getAddOnCreditsByType:', error.message);
      return 0;
    }
  }

  async consumeAddOnCredit(userId: string, creditType: CreditType): Promise<{ success: boolean; error?: string }> {
    console.log(`PaymentService: Attempting to consume add-on credit for userId: ${userId}, creditType: ${creditType}`);
    try {
      const { data: addonType, error: addonTypeError } = await supabase
        .from('addon_types')
        .select('id')
        .eq('type_key', creditType)
        .maybeSingle();

      if (addonTypeError || !addonType) {
        const errorMsg = `Addon type not found for: ${creditType}`;
        console.error('PaymentService:', errorMsg);
        return { success: false, error: errorMsg };
      }

      const { data: creditRecord, error: fetchError } = await supabase
        .from('user_addon_credits')
        .select('*')
        .eq('user_id', userId)
        .eq('addon_type_id', addonType.id)
        .gt('quantity_remaining', 0)
        .order('purchased_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('PaymentService: Error fetching credit record:', fetchError.message);
        return { success: false, error: fetchError.message };
      }

      if (!creditRecord) {
        return { success: false, error: 'No add-on credits available' };
      }

      const { error: updateError } = await supabase
        .from('user_addon_credits')
        .update({ quantity_remaining: creditRecord.quantity_remaining - 1 })
        .eq('id', creditRecord.id);

      if (updateError) {
        console.error('PaymentService: Error updating credit:', updateError.message);
        return { success: false, error: updateError.message };
      }

      console.log(`PaymentService: Successfully consumed 1 ${creditType} credit`);
      return { success: true };
    } catch (error: any) {
      console.error('PaymentService: Unexpected error in consumeAddOnCredit:', error.message);
      return { success: false, error: error.message };
    }
  }

  async getTotalCreditsAvailable(userId: string, creditType: CreditType): Promise<{
    subscription: number;
    addOn: number;
    total: number;
  }> {
    console.log(`PaymentService: Calculating total credits for userId: ${userId}, creditType: ${creditType}`);

    const subscription = await this.getUserSubscription(userId);
    let subscriptionCredits = 0;

    if (subscription) {
      switch (creditType) {
        case 'score_check':
          subscriptionCredits = subscription.scoreChecksTotal - subscription.scoreChecksUsed;
          break;
        case 'optimization':
          subscriptionCredits = subscription.optimizationsTotal - subscription.optimizationsUsed;
          break;
        case 'linkedin_messages':
          subscriptionCredits = subscription.linkedinMessagesTotal - subscription.linkedinMessagesUsed;
          break;
        case 'guided_build':
          subscriptionCredits = subscription.guidedBuildsTotal - subscription.guidedBuildsUsed;
          break;
      }
    }

    subscriptionCredits = Math.max(0, subscriptionCredits);
    const addOnCredits = await this.getAddOnCreditsByType(userId, creditType);
    const total = subscriptionCredits + addOnCredits;

    console.log(`PaymentService: Credits breakdown - Subscription: ${subscriptionCredits}, Add-on: ${addOnCredits}, Total: ${total}`);

    return {
      subscription: subscriptionCredits,
      addOn: addOnCredits,
      total
    };
  }
}

export const paymentService = new PaymentService();
