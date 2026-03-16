import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  calculateSelectedAddOnsTotal,
  findPaymentAddOn,
  findSubscriptionPlan,
  resolveSubscriptionEndDateIso,
} from '../_shared/paymentCatalog.ts';
import {
  applyPricingPlanCoupon,
  getPricingPlanCouponPendingHoldSinceIso,
  normalizePricingPlanCouponCode,
  pricingPlanCouponAppliesToPlan,
} from '../_shared/planCoupon.ts';
import { sendPurchaseConfirmationEmail } from '../_shared/purchaseNotifications.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FreeSubscriptionRequest {
  planId: string;
  userId: string;
  couponCode?: string;
  selectedAddOns?: { [key: string]: number };
  walletDeduction?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      planId,
      userId,
      couponCode,
      selectedAddOns = {},
      walletDeduction = 0,
    }: FreeSubscriptionRequest = await req.json();

    if (!planId || !userId) {
      throw new Error('Missing planId or userId.');
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing.');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized: Invalid user token.');
    }

    if (user.id !== userId) {
      throw new Error('Unauthorized: User ID mismatch.');
    }

    const purchaseType =
      planId === 'addon_only_purchase'
        ? 'addon_only'
        : Object.keys(selectedAddOns).length > 0
          ? 'plan_with_addons'
          : 'plan';

    const plan = planId === 'addon_only_purchase' ? null : findSubscriptionPlan(planId);
    if (planId !== 'addon_only_purchase' && !plan) {
      throw new Error('Invalid plan selected.');
    }

    const originalPlanAmount = plan ? plan.price * 100 : 0;
    const resolvedAddOnsTotal = calculateSelectedAddOnsTotal(selectedAddOns);

    let appliedCoupon: string | null = null;
    let discountAmount = 0;
    let discountedPlanAmount = originalPlanAmount;

    if (couponCode) {
      if (!plan) {
        throw new Error('Coupons are only supported for pricing plans.');
      }

      const normalizedCoupon = normalizePricingPlanCouponCode(couponCode);
      const { data: couponRow, error: couponError } = await supabase
        .from('pricing_plan_coupons')
        .select('code, discount_percentage, applicable_plan_ids, is_active')
        .ilike('code', normalizedCoupon)
        .maybeSingle();

      if (couponError) {
        throw new Error('Failed to validate coupon.');
      }

      if (!couponRow || !couponRow.is_active || !pricingPlanCouponAppliesToPlan(couponRow, plan.id)) {
        throw new Error('Invalid coupon code or not applicable to selected plan.');
      }

      const pendingHoldSince = getPricingPlanCouponPendingHoldSinceIso();
      const [successfulUsageResult, pendingUsageResult] = await Promise.all([
        supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('purchase_type', ['plan', 'plan_with_addons'])
          .eq('status', 'success')
          .ilike('coupon_code', normalizedCoupon),
        supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('purchase_type', ['plan', 'plan_with_addons'])
          .eq('status', 'pending')
          .gte('created_at', pendingHoldSince)
          .ilike('coupon_code', normalizedCoupon),
      ]);

      if (successfulUsageResult.error || pendingUsageResult.error) {
        throw new Error('Failed to verify coupon usage.');
      }

      if ((successfulUsageResult.count || 0) > 0 || (pendingUsageResult.count || 0) > 0) {
        throw new Error(`Coupon "${normalizedCoupon}" has already been used by this account.`);
      }

      const couponTotals = applyPricingPlanCoupon(originalPlanAmount, couponRow);
      appliedCoupon = normalizePricingPlanCouponCode(couponRow.code);
      discountAmount = couponTotals.discountAmount;
      discountedPlanAmount = couponTotals.finalAmount;
    }

    const requestedWalletDeduction = Math.max(0, Math.round(Number(walletDeduction || 0)));
    const appliedWalletDeduction = Math.min(requestedWalletDeduction, discountedPlanAmount);

    if (appliedWalletDeduction > 0) {
      const { data: walletRows, error: walletBalanceError } = await supabase
        .from('wallet_transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (walletBalanceError) {
        throw new Error('Failed to verify wallet balance.');
      }

      const currentBalance = (walletRows || []).reduce(
        (sum: number, row: { amount: number | string | null }) => sum + Number(row.amount || 0),
        0,
      );

      if (currentBalance < appliedWalletDeduction / 100) {
        throw new Error('Insufficient wallet balance.');
      }
    }

    const finalAmount = Math.max(0, discountedPlanAmount - appliedWalletDeduction) + resolvedAddOnsTotal;
    if (finalAmount !== 0) {
      throw new Error('This checkout still has a payable balance. Use the paid checkout flow instead.');
    }

    const transactionInsert = await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        plan_id: plan ? plan.id : null,
        status: 'success',
        amount: originalPlanAmount + resolvedAddOnsTotal,
        currency: 'INR',
        coupon_code: appliedCoupon,
        discount_amount: discountAmount,
        final_amount: 0,
        purchase_type: purchaseType,
        wallet_deduction_amount: appliedWalletDeduction,
        payment_id: 'FREE_PLAN_ACTIVATION',
        order_id: `FREE_PLAN_ORDER_${Date.now()}`,
      })
      .select('id')
      .single();

    if (transactionInsert.error || !transactionInsert.data) {
      throw new Error('Failed to record free checkout transaction.');
    }

    const transactionId = transactionInsert.data.id;

    for (const [addOnId, quantityValue] of Object.entries(selectedAddOns)) {
      const requestedQuantity = Math.max(0, Number(quantityValue || 0));
      if (!requestedQuantity) {
        continue;
      }

      const addOn = findPaymentAddOn(addOnId);
      if (!addOn) {
        throw new Error(`Unsupported add-on selected: ${addOnId}`);
      }

      let { data: addonType, error: addonTypeError } = await supabase
        .from('addon_types')
        .select('id')
        .eq('type_key', addOn.type)
        .maybeSingle();

      if (addonTypeError || !addonType) {
        const createAddonTypeResult = await supabase
          .from('addon_types')
          .insert({
            name: addOn.name,
            type_key: addOn.type,
            unit_price: addOn.price * 100,
            description: `${addOn.name} credit`,
          })
          .select('id')
          .single();

        if (createAddonTypeResult.error || !createAddonTypeResult.data) {
          throw new Error(`Failed to prepare add-on credits for ${addOn.name}.`);
        }

        addonType = createAddonTypeResult.data;
      }

      const addOnCreditInsert = await supabase
        .from('user_addon_credits')
        .insert({
          user_id: user.id,
          addon_type_id: addonType.id,
          quantity_purchased: requestedQuantity,
          quantity_remaining: requestedQuantity,
          payment_transaction_id: transactionId,
        });

      if (addOnCreditInsert.error) {
        throw new Error(`Failed to grant add-on credits for ${addOn.name}.`);
      }
    }

    let subscriptionId: string | null = null;

    if (plan) {
      const subscriptionStartDate = new Date();

      const { data: existingSubscription } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSubscription?.id) {
        await supabase
          .from('subscriptions')
          .update({ status: 'upgraded', updated_at: new Date().toISOString() })
          .eq('id', existingSubscription.id);
      }

      const subscriptionInsert = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'active',
          start_date: subscriptionStartDate.toISOString(),
          end_date: resolveSubscriptionEndDateIso(plan, subscriptionStartDate),
          optimizations_used: 0,
          optimizations_total: plan.optimizations,
          score_checks_used: 0,
          score_checks_total: plan.scoreChecks,
          linkedin_messages_used: 0,
          linkedin_messages_total: plan.linkedinMessages,
          guided_builds_used: 0,
          guided_builds_total: plan.guidedBuilds,
          payment_id: 'FREE_PLAN_ACTIVATION',
          coupon_used: appliedCoupon,
        })
        .select('id')
        .single();

      if (subscriptionInsert.error || !subscriptionInsert.data) {
        throw new Error('Failed to create subscription for free checkout.');
      }

      subscriptionId = subscriptionInsert.data.id;

      await supabase
        .from('payment_transactions')
        .update({ subscription_id: subscriptionId })
        .eq('id', transactionId);
    }

    if (appliedWalletDeduction > 0) {
      const walletInsert = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          type: 'purchase_use',
          amount: -(appliedWalletDeduction / 100),
          status: 'completed',
          transaction_ref: `free_plan_${transactionId}`,
          redeem_details: {
            subscription_id: subscriptionId,
            plan_id: planId,
            addons_purchased: selectedAddOns,
          },
        });

      if (walletInsert.error) {
        throw new Error('Failed to record wallet deduction.');
      }
    }

    let suggestionMessage: string | undefined;
    try {
      const notificationResult = await sendPurchaseConfirmationEmail({
        supabase,
        userId: user.id,
        transactionId,
        userEmail: user.email || undefined,
        userName:
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.display_name ||
          undefined,
      });

      suggestionMessage = notificationResult.suggestionMessage;
      if (!notificationResult.emailSent && notificationResult.error) {
        console.error('Purchase confirmation email failed:', notificationResult.error);
      }
    } catch (notificationError) {
      console.error('Unexpected purchase confirmation email error:', notificationError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        subscriptionId,
        suggestionMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
