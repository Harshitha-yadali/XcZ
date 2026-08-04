import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyRazorpayWebhookSignature } from "../_shared/razorpayWebhookSignature.ts";
import { fulfillPaymentOrder } from "../_shared/paymentFulfillment.ts";

/**
 * Server-side safety net for Razorpay payments.
 *
 * The primary crediting path is client-side: after Razorpay Checkout.js
 * confirms a payment, the browser calls verify-payment to grant credits.
 * That path breaks whenever the tab closes, the device loses network, or a
 * JS error fires before that call completes — money is captured by Razorpay
 * but payment_transactions stays "pending" forever and the user never gets
 * their credits.
 *
 * This webhook (configured in the Razorpay Dashboard to POST here on
 * `payment.captured`) re-runs the same fulfillment for any transaction that
 * is still "pending" once Razorpay confirms the capture server-side, so
 * crediting no longer depends on the client completing the round trip.
 * fulfillPaymentOrder() is idempotent, so this is also safe to receive after
 * verify-payment already succeeded (Razorpay retries webhooks, and both
 * paths can race for the same payment).
 */

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
    console.error("razorpay-webhook: invalid signature");
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only payment.captured tells us Razorpay actually captured the money.
  if (event?.event !== "payment.captured") {
    return new Response(JSON.stringify({ received: true, ignored: event?.event }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const paymentEntity = event?.payload?.payment?.entity;
  const razorpayOrderId: string | undefined = paymentEntity?.order_id;
  const razorpayPaymentId: string | undefined = paymentEntity?.id;

  if (!razorpayOrderId || !razorpayPaymentId) {
    console.error("razorpay-webhook: payment.captured event missing order_id/payment id", event?.id);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("id, user_id, status")
      .eq("order_id", razorpayOrderId)
      .maybeSingle();

    if (transactionError) {
      console.error("razorpay-webhook: failed to look up transaction", transactionError.message);
      return new Response(JSON.stringify({ error: "Lookup failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!transaction) {
      // No matching transaction row (e.g. order created outside this flow). Nothing to fulfill.
      return new Response(JSON.stringify({ received: true, matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (transaction.status === "success") {
      return new Response(JSON.stringify({ received: true, alreadyFulfilled: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) throw new Error("Razorpay credentials not configured");

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${razorpayOrderId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!orderResponse.ok) throw new Error("Failed to fetch order details from Razorpay");
    const orderData = await orderResponse.json();

    await fulfillPaymentOrder({
      supabase,
      userId: transaction.user_id,
      transactionId: transaction.id,
      razorpayOrderId,
      razorpayPaymentId,
      orderData,
    });

    return new Response(JSON.stringify({ received: true, fulfilled: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("razorpay-webhook: fulfillment failed", error?.message);
    // Non-2xx so Razorpay retries with backoff instead of silently dropping the event.
    return new Response(JSON.stringify({ error: error?.message || "Fulfillment failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
