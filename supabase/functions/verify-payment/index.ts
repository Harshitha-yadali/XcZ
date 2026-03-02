import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number;
  guidedBuilds: number;
  sessions: number;
  durationInHours: number;
}

const plans: PlanConfig[] = [
  { id: 'career_boost', name: 'Career Boost Plan', price: 1999, optimizations: 50, scoreChecks: 25, linkedinMessages: 0, guidedBuilds: 0, sessions: 1, durationInHours: 8760 },
  { id: 'career_pro', name: 'Career Pro Plan', price: 2999, optimizations: 100, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0, sessions: 1, durationInHours: 8760 },
  { id: 'jd_starter', name: 'JD Starter', price: 89, optimizations: 5, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'jd_basic', name: 'JD Basic', price: 169, optimizations: 10, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'jd_advanced', name: 'JD Advanced', price: 799, optimizations: 50, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'jd_pro', name: 'JD Pro', price: 1499, optimizations: 100, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'score_starter', name: 'Score Starter', price: 39, optimizations: 0, scoreChecks: 5, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'score_basic', name: 'Score Basic', price: 79, optimizations: 0, scoreChecks: 10, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'score_advanced', name: 'Score Advanced', price: 349, optimizations: 0, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'combo_starter', name: 'Combo Starter', price: 999, optimizations: 50, scoreChecks: 50, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
  { id: 'combo_pro', name: 'Combo Pro', price: 1899, optimizations: 100, scoreChecks: 100, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 8760 },
];

const addOns = [
  { id: 'jd_optimization_single_purchase', name: 'JD-Based Optimization (1 Use)', price: 19, type: 'optimization', quantity: 1 },
  { id: 'resume_score_check_single_purchase', name: 'Resume Score Check (1 Use)', price: 9, type: 'score_check', quantity: 1 },
];

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
      .select("id, status, payment_id")
      .eq("id", transactionId)
      .single();

    if (existingTxError || !existingTx) throw new Error("Transaction not found.");

    if (existingTx.status === "success") {
      return new Response(
        JSON.stringify({ success: true, verified: true, transactionId, message: "Payment already verified." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }
    if (existingTx.status !== "pending") throw new Error("Transaction is not in a verifiable state.");

    if (walletDeduction > 0) {
      const { data: walletRows, error: walletBalanceError } = await supabase
        .from("wallet_transactions").select("amount").eq("user_id", user.id).eq("status", "completed");
      if (walletBalanceError) throw new Error("Failed to verify wallet balance.");
      const currentBalance = (walletRows || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      if (currentBalance < walletDeduction) throw new Error("Insufficient wallet balance for deduction.");
    }

    const { data: updatedTransaction, error: updateTransactionError } = await supabase
      .from("payment_transactions")
      .update({ payment_id: razorpay_payment_id, status: "success", order_id: razorpay_order_id, wallet_deduction_amount: walletDeduction, coupon_code: couponCode, discount_amount: discountAmount })
      .eq("id", transactionId)
      .eq("status", "pending")
      .select()
      .single();

    if (updateTransactionError) throw new Error("Failed to update payment transaction status.");

    if (Object.keys(selectedAddOns).length > 0) {
      for (const addOnKey in selectedAddOns) {
        const quantity = selectedAddOns[addOnKey];
        const addOn = addOns.find((a) => a.id === addOnKey);
        if (!addOn) continue;

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

        await supabase.from("user_addon_credits").insert({
          user_id: user.id, addon_type_id: addonType.id, quantity_purchased: quantity, quantity_remaining: quantity, payment_transaction_id: transactionId,
        });
      }
    }

    if (isWebinarPayment && webinarId && registrationId) {
      await supabase.from("webinar_registrations").update({
        payment_status: 'completed', registration_status: 'confirmed', payment_transaction_id: transactionId, updated_at: new Date().toISOString(),
      }).eq("id", registrationId);
    }

    let subscriptionId: string | null = null;

    if (planId && planId !== "addon_only_purchase" && !isWebinarPayment && paymentType !== 'session_booking') {
      const { data: existingSubscription } = await supabase
        .from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active")
        .gt("end_date", new Date().toISOString()).order("end_date", { ascending: false }).limit(1).maybeSingle();

      if (existingSubscription) {
        await supabase.from("subscriptions").update({ status: "upgraded", updated_at: new Date().toISOString() }).eq("id", existingSubscription.id);
      }

      const plan = plans.find((p) => p.id === planId);
      if (!plan) throw new Error("Invalid plan");

      const { data: subscription, error: subscriptionError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user.id, plan_id: planId, status: "active",
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + plan.durationInHours * 60 * 60 * 1000).toISOString(),
          optimizations_used: 0, optimizations_total: plan.optimizations,
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

    return new Response(
      JSON.stringify({ success: true, verified: true, subscriptionId, transactionId, message: isWebinarPayment ? "Webinar payment verified successfully" : "Payment verified and credits granted successfully" }),
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
