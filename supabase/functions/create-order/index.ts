import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  calculateSelectedAddOnsTotal,
  findSubscriptionPlan,
  type PaymentPlanConfig,
} from "../_shared/paymentCatalog.ts";
import {
  applySessionPromo,
  findSessionPromo,
  normalizeSessionPromoCode,
} from "../_shared/sessionPromo.ts";
import {
  applyPricingPlanCoupon,
  getPricingPlanCouponPendingHoldSinceIso,
  normalizePricingPlanCouponCode,
  pricingPlanCouponAppliesToPlan,
} from "../_shared/planCoupon.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OrderRequest {
  planId?: string;
  couponCode?: string;
  walletDeduction?: number;
  addOnsTotal?: number;
  amount: number;
  selectedAddOns?: { [key: string]: number };
  testMode?: boolean;
  metadata?: {
    type?: 'webinar' | 'subscription' | 'session_booking' | 'referral_booking';
    webinarId?: string;
    registrationId?: string;
    webinarTitle?: string;
    serviceId?: string;
    serviceTitle?: string;
    listingId?: string;
    listingTitle?: string;
  };
  userId?: string;
  currency?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const requestBody = JSON.parse(bodyText);

    const { planId, couponCode, walletDeduction, addOnsTotal, amount: frontendCalculatedAmount, selectedAddOns, metadata, testMode } = requestBody as OrderRequest;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid user token');

    const isWebinarPayment = metadata?.type === 'webinar';
    const isSessionBooking = metadata?.type === 'session_booking';
    const isReferralBooking = metadata?.type === 'referral_booking';

    const resolvedAddOnsTotal = calculateSelectedAddOnsTotal(selectedAddOns);

    let originalPrice = 0;
    let finalAmount = 0;
    let discountAmount = 0;
    let appliedCoupon: string | null = null;

    if (isReferralBooking) {
      if (!metadata?.listingId) {
        return new Response(
          JSON.stringify({ error: 'Missing referral listing for referral payment' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const [{ data: listingRow, error: listingErr }, { data: pricingRow, error: pricingErr }] = await Promise.all([
        supabase
          .from('referral_listings')
          .select('company_name, role_title, query_price, profile_price, slot_price')
          .eq('id', metadata.listingId)
          .maybeSingle(),
        supabase
          .from('referral_pricing')
          .select('query_price, profile_price, slot_price')
          .eq('id', '1')
          .maybeSingle(),
      ]);

      if (listingErr || !listingRow) {
        return new Response(
          JSON.stringify({ error: 'Unable to fetch referral listing pricing' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (pricingErr) {
        console.warn('Unable to fetch referral default pricing:', pricingErr.message);
      }

      const resolvedPrice = Number(
        listingRow.profile_price ??
        listingRow.query_price ??
        listingRow.slot_price ??
        pricingRow?.profile_price ??
        pricingRow?.query_price ??
        pricingRow?.slot_price ??
        0
      );

      if (!resolvedPrice || resolvedPrice <= 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid referral price configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      originalPrice = resolvedPrice;
      finalAmount = resolvedPrice;
    } else if (isSessionBooking) {
      if (!metadata?.serviceId) {
        return new Response(JSON.stringify({ error: 'Missing service ID for session booking' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const { data: serviceRow, error: serviceErr } = await supabase
        .from('session_services')
        .select('price, title, promo_codes')
        .eq('id', metadata.serviceId)
        .single();
      if (serviceErr || !serviceRow) {
        return new Response(JSON.stringify({ error: 'Unable to fetch session service pricing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      originalPrice = Number(serviceRow.price || 0);
      if (!originalPrice || originalPrice <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid session service price' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      finalAmount = originalPrice;

      if (couponCode) {
        const normalizedCoupon = normalizeSessionPromoCode(couponCode);

        const { count: sessionCouponUsageCount, error: sessionCouponUsageError } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('purchase_type', 'session_booking')
          .ilike('coupon_code', normalizedCoupon)
          .in('status', ['success', 'pending']);

        if (sessionCouponUsageError) {
          throw new Error('Failed to verify session promo usage.');
        }
        if ((sessionCouponUsageCount || 0) > 0) {
          return new Response(JSON.stringify({ error: `Promo code "${couponCode.trim().toUpperCase()}" has already been used by this account.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        const promo = findSessionPromo(serviceRow.promo_codes, normalizedCoupon);
        if (!promo) {
          return new Response(JSON.stringify({ error: 'Invalid promo code for this session.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        const promoTotals = applySessionPromo(originalPrice, promo);
        discountAmount = promoTotals.discountAmount;
        finalAmount = promoTotals.finalAmount;
        appliedCoupon = promo.code;
      }
    } else if (isWebinarPayment) {
      if (!metadata?.webinarId || !metadata?.registrationId) {
        return new Response(JSON.stringify({ error: 'Missing required webinar information' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const { data: webinarRow, error: webinarErr } = await supabase.from('webinars').select('discounted_price, title').eq('id', metadata.webinarId).single();
      if (webinarErr || !webinarRow) {
        return new Response(JSON.stringify({ error: 'Unable to fetch webinar pricing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      originalPrice = Number(webinarRow.discounted_price || 0);
      if (!originalPrice || originalPrice <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid webinar price configured' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      finalAmount = originalPrice;
      const normalizedCoupon = (couponCode || '').toLowerCase().trim();
      if (normalizedCoupon === 'primo') {
        const reduced = Math.max(100, Math.floor(originalPrice * 0.01));
        discountAmount = originalPrice - reduced;
        finalAmount = reduced;
        appliedCoupon = 'primo';
      }
      if (!finalAmount || finalAmount <= 0) {
        return new Response(JSON.stringify({ error: 'Calculated payable amount is invalid' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    let plan: PaymentPlanConfig;
    if (isReferralBooking) {
      plan = {
        id: 'referral_booking',
        name: metadata?.listingTitle || 'Referral Request',
        price: originalPrice / 100,
        mrp: originalPrice / 100,
        discountPercentage: 0,
        duration: 'One-time Purchase',
        optimizations: 0,
        scoreChecks: 0,
        linkedinMessages: 0,
        guidedBuilds: 0,
        sessions: 0,
        durationInHours: 0,
        tag: '',
        tagColor: '',
        gradient: '',
        icon: '',
        features: [],
      };
    } else if (isSessionBooking) {
      plan = { id: 'session_booking', name: metadata?.serviceTitle || 'Session Booking', price: originalPrice / 100, mrp: originalPrice / 100, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else if (isWebinarPayment) {
      plan = { id: 'webinar_payment', name: metadata?.webinarTitle || 'Webinar Registration', price: originalPrice / 100, mrp: originalPrice / 100, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else if (planId === 'addon_only_purchase' || !planId) {
      plan = { id: 'addon_only_purchase', name: 'Add-on Only Purchase', price: 0, mrp: 0, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else {
      const foundPlan = findSubscriptionPlan(planId);
      if (!foundPlan) throw new Error('Invalid plan selected');
      plan = foundPlan;
    }

    if (!isWebinarPayment && !isSessionBooking && !isReferralBooking) {
      originalPrice = (plan?.price || 0) * 100;
      discountAmount = 0;
      finalAmount = originalPrice;
      appliedCoupon = null;
    }

    if (couponCode && !isWebinarPayment && !isSessionBooking && !isReferralBooking) {
      if (!planId || plan.id === 'addon_only_purchase') {
        return new Response(JSON.stringify({ error: 'Coupons are only supported for pricing plans.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const normalizedCoupon = normalizePricingPlanCouponCode(couponCode);

      const { data: couponRow, error: couponError } = await supabase
        .from('pricing_plan_coupons')
        .select('code, discount_percentage, applicable_plan_ids, is_active')
        .ilike('code', normalizedCoupon)
        .maybeSingle();

      if (couponError) {
        throw new Error('Failed to verify coupon details.');
      }

      if (!couponRow || !couponRow.is_active || !pricingPlanCouponAppliesToPlan(couponRow, plan.id)) {
        return new Response(JSON.stringify({ error: 'Invalid coupon code or not applicable to selected plan.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
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
        return new Response(JSON.stringify({ error: `Coupon "${normalizedCoupon}" has already been used by this account.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      const couponTotals = applyPricingPlanCoupon(originalPrice, couponRow);
      discountAmount = couponTotals.discountAmount;
      finalAmount = couponTotals.finalAmount;
      appliedCoupon = normalizePricingPlanCouponCode(couponRow.code);
    }

    if (!isWebinarPayment && !isSessionBooking && !isReferralBooking && walletDeduction && walletDeduction > 0) {
      const { data: walletRows, error: walletBalanceError } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("status", "completed");

      if (walletBalanceError) throw new Error('Failed to verify wallet balance.');

      const currentBalance = (walletRows || []).reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
      const walletDeductionInRupees = walletDeduction / 100;
      if (currentBalance < walletDeductionInRupees) {
        return new Response(JSON.stringify({ error: 'Insufficient wallet balance.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      finalAmount = Math.max(0, finalAmount - walletDeduction);
    }

    if (!isSessionBooking && !isReferralBooking && resolvedAddOnsTotal > 0) {
      finalAmount += resolvedAddOnsTotal;
    }

    if (!isWebinarPayment && !isSessionBooking) {
      if (finalAmount !== frontendCalculatedAmount) {
        return new Response(JSON.stringify({ error: 'Price mismatch detected. Please try again.', debug: { backendCalculated: finalAmount, frontendSent: frontendCalculatedAmount } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    const getPurchaseType = () => {
      if (isSessionBooking) return 'session_booking';
      if (isReferralBooking) return 'referral_booking';
      if (isWebinarPayment) return 'webinar';
      if (planId === 'addon_only_purchase') return 'addon_only';
      if (Object.keys(selectedAddOns || {}).length > 0) return 'plan_with_addons';
      return 'plan';
    };

    const baseInsert: any = {
      user_id: user.id,
      plan_id: (isWebinarPayment || isSessionBooking || isReferralBooking || planId === 'addon_only_purchase') ? null : planId,
      status: 'pending',
      amount: plan.price * 100,
      currency: 'INR',
      order_id: 'PENDING',
      payment_id: 'PENDING',
      coupon_code: appliedCoupon,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      purchase_type: getPurchaseType(),
    };

    if (isWebinarPayment && metadata) {
      baseInsert.metadata = { type: 'webinar', webinarId: metadata.webinarId, registrationId: metadata.registrationId, webinarTitle: metadata.webinarTitle };
    }
    if (isSessionBooking && metadata) {
      baseInsert.metadata = { type: 'session_booking', serviceId: metadata.serviceId, serviceTitle: metadata.serviceTitle };
    }
    if (isReferralBooking && metadata) {
      baseInsert.metadata = {
        type: 'referral_booking',
        listingId: metadata.listingId,
        listingTitle: metadata.listingTitle,
      };
    }

    const tryInsert = async (payload: any): Promise<{ id: string }> => {
      const { data, error } = await supabase.from('payment_transactions').insert(payload).select('id').single();
      if (error) throw error;
      return data as { id: string };
    };

    let transactionId: string | null = null;
    try {
      const t = await tryInsert(baseInsert);
      transactionId = t.id;
    } catch (e: any) {
      const fallbackInsert = { ...baseInsert };
      delete fallbackInsert.metadata;
      delete fallbackInsert.purchase_type;
      try {
        const t2 = await tryInsert(fallbackInsert);
        transactionId = t2.id;
      } catch (e2: any) {
        throw new Error(`Failed to initiate payment transaction: ${e2?.message || 'unknown error'}`);
      }
    }

    if (isSessionBooking && finalAmount === 0) {
      await supabase
        .from('payment_transactions')
        .update({
          status: 'success',
          order_id: 'FREE_SESSION_PROMO',
          payment_id: 'FREE_SESSION_PROMO',
        })
        .eq('id', transactionId as string);

      return new Response(
        JSON.stringify({
          freeCheckout: true,
          amount: 0,
          currency: 'INR',
          transactionId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const envTestMode = (Deno.env.get('RAZORPAY_TEST_MODE') || '').toLowerCase() === 'true';
    const isTestMode = Boolean(testMode) || envTestMode;

    const razorpayKeyId = isTestMode
      ? (Deno.env.get('RAZORPAY_TEST_KEY_ID') || Deno.env.get('RAZORPAY_KEY_ID'))
      : Deno.env.get('RAZORPAY_KEY_ID');
    const razorpayKeySecret = isTestMode
      ? (Deno.env.get('RAZORPAY_TEST_KEY_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET'))
      : Deno.env.get('RAZORPAY_KEY_SECRET');

    if (!razorpayKeyId || !razorpayKeySecret) throw new Error('Razorpay credentials not configured');

    const orderData = {
      amount: finalAmount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: {
        planId: planId || (isReferralBooking ? 'referral_booking' : 'webinar_payment'),
        planName: plan.name,
        originalAmount: plan.price * 100,
        couponCode: appliedCoupon,
        discountAmount: discountAmount,
        walletDeduction: walletDeduction || 0,
        addOnsTotal: resolvedAddOnsTotal,
        transactionId: transactionId,
        selectedAddOns: JSON.stringify(selectedAddOns || {}),
        paymentType: isWebinarPayment ? 'webinar' : (isSessionBooking ? 'session_booking' : (isReferralBooking ? 'referral_booking' : 'subscription')),
        webinarId: metadata?.webinarId || '',
        registrationId: metadata?.registrationId || '',
        webinarTitle: metadata?.webinarTitle || '',
        serviceId: metadata?.serviceId || '',
        serviceTitle: metadata?.serviceTitle || '',
        listingId: metadata?.listingId || '',
        listingTitle: metadata?.listingTitle || '',
        mode: isTestMode ? 'test' : 'live',
      },
    };

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await supabase.from('payment_transactions').update({ status: 'failed' }).eq('id', transactionId);
      throw new Error(`Failed to create payment order with Razorpay: ${errorText}`);
    }

    const order = await response.json();

    try {
      await supabase.from('payment_transactions').update({ order_id: order.id }).eq('id', transactionId as string);
    } catch (_e) {}

    return new Response(
      JSON.stringify({ orderId: order.id, amount: finalAmount, keyId: razorpayKeyId, currency: 'INR', transactionId: transactionId, mode: isTestMode ? 'test' : 'live' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, timestamp: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
