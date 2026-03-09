import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  applySessionPromo,
  findSessionPromo,
  normalizeSessionPromoCode,
} from '../_shared/sessionPromo.ts';

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
    const normalizedCouponKey = normalizeSessionPromoCode(normalizedCoupon);

    if (purchaseType === 'session_booking') {
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

    if (normalizedCouponKey === 'diwali') {
      return new Response(
        JSON.stringify({ isValid: false, message: 'Coupon expired or inactive.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    const { count, error: couponUsageError } = await supabase
      .from('payment_transactions')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .ilike('coupon_code', normalizedCouponKey)
      .in('status', ['success', 'pending']);

    if (couponUsageError) {
      console.error('Error checking coupon usage:', couponUsageError);
      throw new Error('Failed to verify coupon usage. Please try again.');
    }

    if ((count || 0) > 0) {
      return new Response(
        JSON.stringify({
          isValid: false,
          message: `Coupon "${normalizedCoupon}" has already been used by this account.`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        isValid: true,
        message: `Coupon "${normalizedCoupon}" is valid.`,
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
