import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    type?: 'webinar' | 'subscription' | 'session_booking';
    webinarId?: string;
    registrationId?: string;
    webinarTitle?: string;
    serviceId?: string;
    serviceTitle?: string;
  };
  userId?: string;
  currency?: string;
}

interface PlanConfig {
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

const plans: PlanConfig[] = [
  {
    id: 'career_boost',
    name: 'Career Boost Plan',
    price: 1999,
    mrp: 3925,
    discountPercentage: 49,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'career_pro',
    name: 'Career Pro Plan',
    price: 2999,
    mrp: 6850,
    discountPercentage: 56,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'jd_starter',
    name: 'JD Starter',
    price: 89,
    mrp: 245,
    discountPercentage: 64,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'jd_basic',
    name: 'JD Basic',
    price: 169,
    mrp: 490,
    discountPercentage: 65,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'jd_advanced',
    name: 'JD Advanced',
    price: 799,
    mrp: 2450,
    discountPercentage: 67,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'jd_pro',
    name: 'JD Pro',
    price: 1499,
    mrp: 4900,
    discountPercentage: 69,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'score_starter',
    name: 'Score Starter',
    price: 39,
    mrp: 95,
    discountPercentage: 59,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'score_basic',
    name: 'Score Basic',
    price: 79,
    mrp: 190,
    discountPercentage: 58,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'score_advanced',
    name: 'Score Advanced',
    price: 349,
    mrp: 950,
    discountPercentage: 63,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'combo_starter',
    name: 'Combo Starter',
    price: 999,
    mrp: 3400,
    discountPercentage: 71,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
  {
    id: 'combo_pro',
    name: 'Combo Pro',
    price: 1899,
    mrp: 6800,
    discountPercentage: 72,
    duration: 'One-time Purchase',
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
    durationInHours: 8760,
  },
];

const addOns = [
  { id: 'jd_optimization_single_purchase', name: 'JD-Based Optimization (1 Use)', price: 19, type: 'optimization', quantity: 1 },
  { id: 'resume_score_check_single_purchase', name: 'Resume Score Check (1 Use)', price: 9, type: 'score_check', quantity: 1 },
];

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

    let originalPrice = 0;
    let finalAmount = 0;
    let discountAmount = 0;
    let appliedCoupon: string | null = null;

    if (isSessionBooking) {
      if (!metadata?.serviceId) {
        return new Response(JSON.stringify({ error: 'Missing service ID for session booking' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      const { data: serviceRow, error: serviceErr } = await supabase.from('session_services').select('price, title').eq('id', metadata.serviceId).single();
      if (serviceErr || !serviceRow) {
        return new Response(JSON.stringify({ error: 'Unable to fetch session service pricing' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      originalPrice = Number(serviceRow.price || 0);
      if (!originalPrice || originalPrice <= 0) {
        return new Response(JSON.stringify({ error: 'Invalid session service price' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
      finalAmount = originalPrice;
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

    let plan: PlanConfig;
    if (isSessionBooking) {
      plan = { id: 'session_booking', name: metadata?.serviceTitle || 'Session Booking', price: originalPrice / 100, mrp: originalPrice / 100, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else if (isWebinarPayment) {
      plan = { id: 'webinar_payment', name: metadata?.webinarTitle || 'Webinar Registration', price: originalPrice / 100, mrp: originalPrice / 100, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else if (planId === 'addon_only_purchase' || !planId) {
      plan = { id: 'addon_only_purchase', name: 'Add-on Only Purchase', price: 0, mrp: 0, discountPercentage: 0, duration: 'One-time Purchase', optimizations: 0, scoreChecks: 0, linkedinMessages: 0, guidedBuilds: 0, sessions: 0, durationInHours: 0, tag: '', tagColor: '', gradient: '', icon: '', features: [] };
    } else {
      const foundPlan = plans.find((p) => p.id === planId);
      if (!foundPlan) throw new Error('Invalid plan selected');
      plan = foundPlan;
    }

    if (!isWebinarPayment && !isSessionBooking) {
      originalPrice = (plan?.price || 0) * 100;
      discountAmount = 0;
      finalAmount = originalPrice;
      appliedCoupon = null;
    }

    if (couponCode && !isWebinarPayment && !isSessionBooking) {
      const normalizedCoupon = couponCode.toLowerCase().trim();

      const { count: userCouponUsageCount, error: userCouponUsageError } = await supabase
        .from('payment_transactions')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .ilike('coupon_code', normalizedCoupon)
        .in('status', ['success', 'pending']);

      if (userCouponUsageError) throw new Error('Failed to verify coupon usage.');
      if (userCouponUsageCount && userCouponUsageCount > 0) {
        return new Response(JSON.stringify({ error: `Coupon "${normalizedCoupon}" has already been used by this account.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }

      if (normalizedCoupon === 'fullsupport' && planId === 'career_pro') {
        finalAmount = 0;
        discountAmount = plan.price * 100;
        appliedCoupon = 'fullsupport';
      } else if (normalizedCoupon === 'diwali') {
        discountAmount = Math.floor(originalPrice * 0.9);
        finalAmount = originalPrice - discountAmount;
        appliedCoupon = 'diwali';
      } else {
        return new Response(JSON.stringify({ error: 'Invalid coupon code or not applicable to selected plan.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    if (!isWebinarPayment && !isSessionBooking && walletDeduction && walletDeduction > 0) {
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

    if (!isSessionBooking && addOnsTotal && addOnsTotal > 0) {
      finalAmount += addOnsTotal;
    }

    if (!isWebinarPayment && !isSessionBooking) {
      if (finalAmount !== frontendCalculatedAmount) {
        return new Response(JSON.stringify({ error: 'Price mismatch detected. Please try again.', debug: { backendCalculated: finalAmount, frontendSent: frontendCalculatedAmount } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
      }
    }

    const getPurchaseType = () => {
      if (isSessionBooking) return 'session_booking';
      if (isWebinarPayment) return 'webinar';
      if (planId === 'addon_only_purchase') return 'addon_only';
      if (Object.keys(selectedAddOns || {}).length > 0) return 'plan_with_addons';
      return 'plan';
    };

    const baseInsert: any = {
      user_id: user.id,
      plan_id: (isWebinarPayment || isSessionBooking || planId === 'addon_only_purchase') ? null : planId,
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
        planId: planId || 'webinar_payment',
        planName: plan.name,
        originalAmount: plan.price * 100,
        couponCode: appliedCoupon,
        discountAmount: discountAmount,
        walletDeduction: walletDeduction || 0,
        addOnsTotal: addOnsTotal || 0,
        transactionId: transactionId,
        selectedAddOns: JSON.stringify(selectedAddOns || {}),
        paymentType: isWebinarPayment ? 'webinar' : (isSessionBooking ? 'session_booking' : 'subscription'),
        webinarId: metadata?.webinarId || '',
        registrationId: metadata?.registrationId || '',
        webinarTitle: metadata?.webinarTitle || '',
        serviceId: metadata?.serviceId || '',
        serviceTitle: metadata?.serviceTitle || '',
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
