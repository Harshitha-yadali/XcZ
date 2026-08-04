import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { fulfillPaymentOrder } from "../_shared/paymentFulfillment.ts";

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
    const paymentType = orderData.notes.paymentType || 'subscription';

    const { alreadyFulfilled, subscriptionId, suggestionMessage } = await fulfillPaymentOrder({
      supabase,
      userId: user.id,
      userEmail: user.email,
      userName:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.display_name,
      transactionId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      orderData,
      metadata,
    });

    if (alreadyFulfilled) {
      return new Response(
        JSON.stringify({ success: true, verified: true, transactionId, message: "Payment already verified and credits confirmed." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
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
