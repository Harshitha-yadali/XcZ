import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  findSubscriptionPlan,
} from '../_shared/paymentCatalog.ts';
import {
  applySessionPromo,
  findSessionPromo,
  normalizeSessionPromoCode,
} from '../_shared/sessionPromo.ts';
import {
  applyPricingPlanCoupon,
  getPricingPlanCouponPendingHoldSinceIso,
  normalizePricingPlanCouponCode,
  pricingPlanCouponAppliesToPlan,
} from '../_shared/planCoupon.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ValidateCouponRequest {
  couponCode: string;
  userId: string;
  purchaseType?: 'subscription' | 'session_booking';
  serviceId?: string;
  planId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      couponCode,
      userId,
      purchaseType = 'subscription',
      serviceId,
      planId,
    }: ValidateCouponRequest = await req.json();

    if (!couponCode || !userId) {
      throw new Error('Missing couponCode or userId in request body.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing.');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token.');
    }

    if (user.id !== userId) {
      throw new Error('Unauthorized: User ID mismatch.');
    }

    const normalizedCoupon = couponCode.trim();

    if (purchaseType === 'session_booking') {
      const normalizedCouponKey = normalizeSessionPromoCode(normalizedCoupon);

      if (!serviceId) {
        throw new Error('Missing serviceId for session booking promo validation.');
      }

      const { count, error: couponUsageError } = await supabase
        .from('payment_transactions')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('purchase_type', 'session_booking')
        .ilike('coupon_code', normalizedCouponKey)
        .in('status', ['success', 'pending']);

      if (couponUsageError) {
        console.error('Error checking session promo usage:', couponUsageError);
        throw new Error('Failed to verify promo code usage. Please try again.');
      }

      if ((count || 0) > 0) {
        return new Response(
          JSON.stringify({
            isValid: false,
            couponApplied: null,
            discountPercentage: 0,
            discountAmount: 0,
            finalAmount: 0,
            message: `Promo code "${normalizedCoupon.toUpperCase()}" has already been used by this account.`,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );
      }

      const { data: serviceRow, error: serviceError } = await supabase
        .from('session_services')
        .select('price, promo_codes')
        .eq('id', serviceId)
        .maybeSingle();

      if (serviceError || !serviceRow) {
        console.error('Error fetching session service promo config:', serviceError);
        throw new Error('Failed to fetch session promo configuration.');
      }

      const promo = findSessionPromo(serviceRow.promo_codes, normalizedCoupon);
      if (!promo) {
        return new Response(
          JSON.stringify({
            isValid: false,
            couponApplied: null,
            discountPercentage: 0,
            discountAmount: 0,
            finalAmount: Number(serviceRow.price || 0),
            message: 'Invalid promo code for this session.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        );
      }

      const { discountAmount, finalAmount } = applySessionPromo(Number(serviceRow.price || 0), promo);

      return new Response(
        JSON.stringify({
          isValid: true,
          couponApplied: promo.code,
          discountPercentage: promo.discount_percentage,
          discountAmount,
          finalAmount,
          message: `${promo.code} applied successfully.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    if (!planId) {
      throw new Error('Missing planId for subscription coupon validation.');
    }

    const plan = findSubscriptionPlan(planId);
    if (!plan) {
      return new Response(
        JSON.stringify({
          isValid: false,
          couponApplied: null,
          discountPercentage: 0,
          discountAmount: 0,
          finalAmount: 0,
          message: 'Invalid pricing plan selected.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const normalizedCouponKey = normalizePricingPlanCouponCode(normalizedCoupon);

    const { data: couponRow, error: couponError } = await supabase
      .from('pricing_plan_coupons')
      .select('code, description, discount_percentage, applicable_plan_ids, is_active')
      .ilike('code', normalizedCouponKey)
      .maybeSingle();

    if (couponError) {
      console.error('Error fetching pricing plan coupon:', couponError);
      throw new Error('Failed to validate coupon. Please try again.');
    }

    if (!couponRow || !couponRow.is_active) {
      return new Response(
        JSON.stringify({
          isValid: false,
          couponApplied: null,
          discountPercentage: 0,
          discountAmount: 0,
          finalAmount: plan.price * 100,
          message: 'Invalid or inactive coupon code.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    if (!pricingPlanCouponAppliesToPlan(couponRow, plan.id)) {
      return new Response(
        JSON.stringify({
          isValid: false,
          couponApplied: null,
          discountPercentage: 0,
          discountAmount: 0,
          finalAmount: plan.price * 100,
          message: 'This coupon is not valid for the selected pricing plan.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const pendingHoldSince = getPricingPlanCouponPendingHoldSinceIso();
    const [successfulUsageResult, pendingUsageResult] = await Promise.all([
      supabase
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('purchase_type', ['plan', 'plan_with_addons'])
        .eq('status', 'success')
        .ilike('coupon_code', normalizedCouponKey),
      supabase
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('purchase_type', ['plan', 'plan_with_addons'])
        .eq('status', 'pending')
        .gte('created_at', pendingHoldSince)
        .ilike('coupon_code', normalizedCouponKey),
    ]);

    if (successfulUsageResult.error || pendingUsageResult.error) {
      console.error('Error checking pricing plan coupon usage:', successfulUsageResult.error || pendingUsageResult.error);
      throw new Error('Failed to verify coupon usage. Please try again.');
    }

    if ((successfulUsageResult.count || 0) > 0 || (pendingUsageResult.count || 0) > 0) {
      return new Response(
        JSON.stringify({
          isValid: false,
          couponApplied: null,
          discountPercentage: 0,
          discountAmount: 0,
          finalAmount: plan.price * 100,
          message: `Coupon "${normalizedCouponKey}" has already been used by this account.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const couponTotals = applyPricingPlanCoupon(plan.price * 100, couponRow);

    return new Response(
      JSON.stringify({
        isValid: true,
        couponApplied: normalizePricingPlanCouponCode(couponRow.code),
        discountPercentage: couponTotals.discountPercentage,
        discountAmount: couponTotals.discountAmount,
        finalAmount: couponTotals.finalAmount,
        message: `${normalizePricingPlanCouponCode(couponRow.code)} applied successfully.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in validate-coupon function:', message);

    return new Response(
      JSON.stringify({ isValid: false, message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
