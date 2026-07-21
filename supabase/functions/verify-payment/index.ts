import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { findPaymentAddOn, findSubscriptionPlan, getAddOnBundleCount, resolveSubscriptionEndDateIso } from "../_shared/paymentCatalog.ts";
import { sendPurchaseConfirmationEmail } from "../_shared/purchaseNotifications.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let transactionIdFromRequest: string | null = null;

  try {
    const requestBody = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, transactionId, metadata } = requestBody;
    transactionIdFromRequest = transactionId;
    const isWebinarPayment = metadata?.type === 'webinar';

    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error("Invalid user token");

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) throw new Error("Razorpay secret not configured");

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", razorpayKeySecret).update(body).digest("hex");
    if (expectedSignature !== razorpay_signature) throw new Error("Invalid payment signature");

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
      headers: { "Authorization": `Basic ${auth}` },
    });
    if (!orderResponse.ok) throw new Error("Failed to fetch order details from Razorpay");

    const orderData = await orderResponse.json();
    const planId = orderData.notes.planId;
    const couponCode = orderData.notes.couponCode;
    const discountAmount = parseFloat(orderData.notes.discountAmount || "0");
    const walletDeduction = parseFloat(orderData.notes.walletDeduction || "0");
    const selectedAddOns = JSON.parse(orderData.notes.selectedAddOns || "{}");
    const paymentType = orderData.notes.paymentType || 'subscription';
    const webinarId = orderData.notes.webinarId || metadata?.webinarId;
    const registrationId = orderData.notes.registrationId || metadata?.registrationId;

    const { data: existingTx, error: existingTxError } = await supabase
      .from("payment_transactions")
      .select("id, status, payment_id, order_id")
      .eq("id", transactionId)
      .eq("user_id", user.id)
      .single();

    if (existingTxError || !existingTx) throw new Error("Transaction not found.");
    if (existingTx.order_id && existingTx.order_id !== razorpay_order_id) {
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
        .eq("user_id", user.id)
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
        .from("wallet_transactions").select("amount").eq("user_id", user.id).eq("status", "completed");
      if (walletBalanceError) throw new Error("Failed to verify wallet balance.");
      const currentBalance = (walletRows || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      if (currentBalance < walletDeduction) throw new Error("Insufficient wallet balance for deduction.");
    }

    if (!transactionAlreadySuccessful) {
      const { error: updateTransactionError } = await supabase
        .from("payment_transactions")
        .update({ payment_id: razorpay_payment_id, status: "success", order_id: razorpay_order_id, wallet_deduction_amount: walletDeduction, coupon_code: couponCode, discount_amount: discountAmount })
        .eq("id", transactionId)
        .eq("status", "pending");

      if (updateTransactionError) throw new Error("Failed to update payment transaction status.");
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
          .eq("user_id", user.id)
          .eq("addon_type_id", addonType.id)
          .eq("payment_transaction_id", transactionId)
          .maybeSingle();
        if (existingCreditError) throw new Error(`Failed to verify ${addOn.name} credit fulfillment.`);

        if (!existingCredit) {
          const { error: creditInsertError } = await supabase.from("user_addon_credits").insert({
            user_id: user.id, addon_type_id: addonType.id, quantity_purchased: quantity, quantity_remaining: quantity,
            optimization_tier: addOn.type === 'optimization' ? (addOn.optimizationTier || 'quick') : null,
            payment_transaction_id: transactionId,
          });
          if (creditInsertError) throw new Error(`Failed to grant ${addOn.name} credits.`);
        }
      }
    }

    if (transactionAlreadySuccessful) {
      return new Response(
        JSON.stringify({ success: true, verified: true, transactionId, message: "Payment already verified and credits confirmed." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
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
          user_id: user.id, plan_id: planId, status: "active",
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
          payment_id: razorpay_payment_id, coupon_used: couponCode,
        })
        .select().single();

      if (subscriptionError) throw new Error("Failed to create subscription");
      subscriptionId = subscription.id;

      await supabase.from("payment_transactions").update({ subscription_id: subscription.id }).eq("id", transactionId);
    }

    if (walletDeduction > 0) {
      await supabase.from("wallet_transactions").insert({
        user_id: user.id, type: "purchase_use", amount: -(walletDeduction), status: "completed",
        transaction_ref: razorpay_payment_id,
        redeem_details: { subscription_id: subscriptionId, plan_id: planId, original_amount: orderData.amount / 100, addons_included: selectedAddOns },
      });
    }

    try {
      const { data: userProfile } = await supabase
        .from("user_profiles").select("referred_by").eq("id", user.id).maybeSingle();

      if (userProfile?.referred_by) {
        const { data: referrerProfile } = await supabase
          .from("user_profiles").select("id").eq("referral_code", userProfile.referred_by).maybeSingle();

        if (referrerProfile) {
          const totalPurchaseAmount = orderData.amount / 100;
          const commissionAmount = Math.floor(totalPurchaseAmount * 0.1);
          if (commissionAmount > 0) {
            await supabase.from("wallet_transactions").insert({
              user_id: referrerProfile.id, source_user_id: user.id, type: "referral", amount: commissionAmount, status: "completed",
              transaction_ref: `referral_${razorpay_payment_id}`,
              redeem_details: { referred_user_id: user.id, plan_purchased: planId, total_purchase_amount: totalPurchaseAmount, commission_rate: 0.1, addons_included: selectedAddOns },
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
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        subscriptionId,
        transactionId,
        suggestionMessage,
        message:
          isWebinarPayment
            ? "Webinar payment verified successfully"
            : paymentType === 'referral_booking'
              ? "Referral payment verified successfully"
              : "Payment verified and credits granted successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    if (transactionIdFromRequest) {
      await supabase.from("payment_transactions").update({ status: "failed" }).eq("id", transactionIdFromRequest);
    }
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
