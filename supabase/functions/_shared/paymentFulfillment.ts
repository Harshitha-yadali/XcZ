import { findPaymentAddOn, findSubscriptionPlan, getAddOnBundleCount, resolveSubscriptionEndDateIso } from "./paymentCatalog.ts";
import { sendPurchaseConfirmationEmail } from "./purchaseNotifications.ts";

export interface RazorpayOrderData {
  amount: number;
  notes: {
    planId?: string;
    couponCode?: string | null;
    discountAmount?: string;
    walletDeduction?: string;
    selectedAddOns?: string;
    paymentType?: string;
    webinarId?: string;
    registrationId?: string;
  };
}

export interface FulfillPaymentOrderParams {
  supabase: any;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  orderData: RazorpayOrderData;
  metadata?: { webinarId?: string; registrationId?: string };
}

export interface FulfillPaymentOrderResult {
  alreadyFulfilled: boolean;
  subscriptionId: string | null;
  suggestionMessage?: string;
}

/**
 * Grants the credits/subscription/wallet effects for a verified Razorpay payment
 * and marks the transaction as successful. Idempotent: safe to call more than
 * once for the same transactionId (e.g. once from the client-side verify-payment
 * call and again from the server-side razorpay-webhook safety net) — every
 * mutation is guarded by an existence/status check first.
 */
export async function fulfillPaymentOrder(params: FulfillPaymentOrderParams): Promise<FulfillPaymentOrderResult> {
  const { supabase, userId, userEmail, userName, transactionId, razorpayOrderId, razorpayPaymentId, orderData, metadata } = params;

  const planId = orderData.notes.planId;
  const couponCode = orderData.notes.couponCode;
  const discountAmount = parseFloat(orderData.notes.discountAmount || "0");
  const walletDeduction = parseFloat(orderData.notes.walletDeduction || "0");
  const selectedAddOns = JSON.parse(orderData.notes.selectedAddOns || "{}");
  const paymentType = orderData.notes.paymentType || 'subscription';
  const isWebinarPayment = paymentType === 'webinar';
  const webinarId = orderData.notes.webinarId || metadata?.webinarId;
  const registrationId = orderData.notes.registrationId || metadata?.registrationId;

  const { data: existingTx, error: existingTxError } = await supabase
    .from("payment_transactions")
    .select("id, status, payment_id, order_id")
    .eq("id", transactionId)
    .eq("user_id", userId)
    .single();

  if (existingTxError || !existingTx) throw new Error("Transaction not found.");
  if (existingTx.order_id && existingTx.order_id !== razorpayOrderId) {
    throw new Error("Payment order does not match this transaction.");
  }

  const transactionAlreadySuccessful = existingTx.status === "success";
  if (!transactionAlreadySuccessful && existingTx.status !== "pending") {
    throw new Error("Transaction is not in a verifiable state.");
  }

  if (
    !transactionAlreadySuccessful &&
    couponCode &&
    paymentType !== 'webinar' &&
    paymentType !== 'session_booking' &&
    paymentType !== 'referral_booking'
  ) {
    const { count: couponSuccessCount, error: couponSuccessError } = await supabase
      .from("payment_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("purchase_type", ["plan", "plan_with_addons"])
      .eq("status", "success")
      .neq("id", transactionId)
      .ilike("coupon_code", couponCode);

    if (couponSuccessError) {
      throw new Error("Failed to verify coupon redemption state.");
    }

    if ((couponSuccessCount || 0) > 0) {
      throw new Error(`Coupon "${couponCode}" has already been used by this account.`);
    }
  }

  if (!transactionAlreadySuccessful && walletDeduction > 0) {
    const { data: walletRows, error: walletBalanceError } = await supabase
      .from("wallet_transactions").select("amount").eq("user_id", userId).eq("status", "completed");
    if (walletBalanceError) throw new Error("Failed to verify wallet balance.");
    const currentBalance = (walletRows || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    if (currentBalance < walletDeduction) throw new Error("Insufficient wallet balance for deduction.");
  }

  if (!transactionAlreadySuccessful) {
    const { data: claimedRows, error: updateTransactionError } = await supabase
      .from("payment_transactions")
      .update({ payment_id: razorpayPaymentId, status: "success", order_id: razorpayOrderId, wallet_deduction_amount: walletDeduction, coupon_code: couponCode, discount_amount: discountAmount })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select("id");

    if (updateTransactionError) throw new Error("Failed to update payment transaction status.");

    // The pending -> success flip is the claim. If a concurrent call (client
    // verify vs. webhook, or a replay) flipped it first, that call grants
    // everything; granting here too would double the subscription and wallet rows.
    if (!claimedRows || claimedRows.length === 0) {
      return { alreadyFulfilled: true, subscriptionId: null };
    }
  }

  if (Object.keys(selectedAddOns).length > 0) {
    for (const addOnKey in selectedAddOns) {
      const requestedQuantity = Number(selectedAddOns[addOnKey]);
      const addOn = findPaymentAddOn(addOnKey);
      if (!addOn) throw new Error(`Unsupported add-on in verified order: ${addOnKey}`);
      const bundleCount = getAddOnBundleCount(addOn, requestedQuantity);
      if (bundleCount <= 0) throw new Error(`Invalid add-on quantity in verified order: ${addOnKey}`);
      const quantity = bundleCount * addOn.quantity;

      let { data: addonType, error: addonTypeError } = await supabase
        .from("addon_types").select("id").eq("type_key", addOn.type).single();

      if (addonTypeError || !addonType) {
        const { data: newAddonType, error: createError } = await supabase
          .from("addon_types")
          .insert({ name: addOn.name, type_key: addOn.type, unit_price: addOn.price * 100, description: `${addOn.name} credit` })
          .select("id").single();
        if (createError) continue;
        addonType = newAddonType;
      }

      const { data: existingCredit, error: existingCreditError } = await supabase
        .from("user_addon_credits")
        .select("id")
        .eq("user_id", userId)
        .eq("addon_type_id", addonType.id)
        .eq("payment_transaction_id", transactionId)
        .maybeSingle();
      if (existingCreditError) throw new Error(`Failed to verify ${addOn.name} credit fulfillment.`);

      if (!existingCredit) {
        const { error: creditInsertError } = await supabase.from("user_addon_credits").insert({
          user_id: userId, addon_type_id: addonType.id, quantity_purchased: quantity, quantity_remaining: quantity,
          optimization_tier: addOn.type === 'optimization' ? (addOn.optimizationTier || 'quick') : null,
          payment_transaction_id: transactionId,
        });
        if (creditInsertError) throw new Error(`Failed to grant ${addOn.name} credits.`);
      }
    }
  }

  if (transactionAlreadySuccessful) {
    return { alreadyFulfilled: true, subscriptionId: null };
  }

  if (isWebinarPayment && webinarId && registrationId) {
    await supabase.from("webinar_registrations").update({
      payment_status: 'completed', registration_status: 'confirmed', payment_transaction_id: transactionId, updated_at: new Date().toISOString(),
    }).eq("id", registrationId);
  }

  let subscriptionId: string | null = null;
  let suggestionMessage: string | undefined;

  if (
    planId &&
    planId !== "addon_only_purchase" &&
    !isWebinarPayment &&
    paymentType !== 'session_booking' &&
    paymentType !== 'referral_booking'
  ) {
    const plan = findSubscriptionPlan(planId);
    if (!plan) throw new Error("Invalid plan");
    const optimizationTier = plan.optimizations > 0 ? (plan.optimizationTier || 'quick') : null;

    const subscriptionStartDate = new Date();

    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId, plan_id: planId, status: "active",
        start_date: subscriptionStartDate.toISOString(),
        end_date: resolveSubscriptionEndDateIso(plan, subscriptionStartDate),
        optimizations_used: 0, optimizations_total: plan.optimizations,
        quick_optimizations_used: 0,
        quick_optimizations_total: optimizationTier === 'quick' ? plan.optimizations : 0,
        smart_optimizations_used: 0,
        smart_optimizations_total: optimizationTier === 'smart' ? plan.optimizations : 0,
        deep_optimizations_used: 0,
        deep_optimizations_total: optimizationTier === 'deep' ? plan.optimizations : 0,
        score_checks_used: 0, score_checks_total: plan.scoreChecks,
        linkedin_messages_used: 0, linkedin_messages_total: plan.linkedinMessages,
        guided_builds_used: 0, guided_builds_total: plan.guidedBuilds,
        payment_id: razorpayPaymentId, coupon_used: couponCode,
      })
      .select().single();

    if (subscriptionError) throw new Error("Failed to create subscription");
    subscriptionId = subscription.id;

    await supabase.from("payment_transactions").update({ subscription_id: subscription.id }).eq("id", transactionId);
  }

  if (walletDeduction > 0) {
    await supabase.from("wallet_transactions").insert({
      user_id: userId, type: "purchase_use", amount: -(walletDeduction), status: "completed",
      transaction_ref: razorpayPaymentId,
      redeem_details: { subscription_id: subscriptionId, plan_id: planId, original_amount: orderData.amount / 100, addons_included: selectedAddOns },
    });
  }

  try {
    const { data: userProfile } = await supabase
      .from("user_profiles").select("referred_by").eq("id", userId).maybeSingle();

    if (userProfile?.referred_by) {
      const { data: referrerProfile } = await supabase
        .from("user_profiles").select("id").eq("referral_code", userProfile.referred_by).maybeSingle();

      if (referrerProfile) {
        const totalPurchaseAmount = orderData.amount / 100;
        const commissionAmount = Math.floor(totalPurchaseAmount * 0.1);
        if (commissionAmount > 0) {
          await supabase.from("wallet_transactions").insert({
            user_id: referrerProfile.id, source_user_id: userId, type: "referral", amount: commissionAmount, status: "completed",
            transaction_ref: `referral_${razorpayPaymentId}`,
            redeem_details: { referred_user_id: userId, plan_purchased: planId, total_purchase_amount: totalPurchaseAmount, commission_rate: 0.1, addons_included: selectedAddOns },
          });
        }
      }
    }
  } catch (_referralError) {}

  const shouldSendGenericPurchaseEmail =
    !isWebinarPayment &&
    paymentType !== 'session_booking' &&
    paymentType !== 'referral_booking';

  if (shouldSendGenericPurchaseEmail) {
    try {
      const notificationResult = await sendPurchaseConfirmationEmail({
        supabase,
        userId,
        transactionId,
        userEmail: userEmail || undefined,
        userName: userName || undefined,
      });

      suggestionMessage = notificationResult.suggestionMessage;
      if (!notificationResult.emailSent && notificationResult.error) {
        console.error('Purchase confirmation email failed:', notificationResult.error);
      }
    } catch (notificationError) {
      console.error('Unexpected purchase confirmation email error:', notificationError);
    }
  }

  return { alreadyFulfilled: false, subscriptionId, suggestionMessage };
}
