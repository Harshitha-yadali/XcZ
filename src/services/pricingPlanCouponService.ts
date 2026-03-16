import { SUPABASE_ANON_KEY, SUPABASE_URL, fetchWithSupabaseFallback } from '../config/env';
import { supabase } from '../lib/supabaseClient';
import type { PricingPlanCoupon, PricingPlanCouponInput } from '../types/pricingCoupon';

const SCHEMA_HELP_MESSAGE =
  'Pricing plan coupons are not enabled in the database yet. Run migration 20260312160000_add_pricing_plan_coupons.sql in Supabase.';
const PRICING_PLAN_COUPON_TABLE = 'pricing_plan_coupons';
const MISSING_PRICING_PLAN_COUPON_ERROR_CODES = new Set(['PGRST205', '42P01']);
const SCHEMA_CHECK_TTL_MS = 30_000;

const normalizePlanCouponCode = (code: string) => code.trim().toUpperCase();

const normalizePlanIds = (planIds: string[]) =>
  Array.from(new Set((planIds || []).map((planId) => String(planId || '').trim()).filter(Boolean)));

let couponSchemaAvailability: boolean | null = null;
let couponSchemaCheckedAt = 0;

const mapCouponRow = (row: any): PricingPlanCoupon => ({
  id: row.id,
  code: normalizePlanCouponCode(row.code || ''),
  description: row.description || '',
  discountPercentage: Number(row.discount_percentage || 0),
  applicablePlanIds: normalizePlanIds(row.applicable_plan_ids || []),
  isActive: Boolean(row.is_active),
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || '',
  createdBy: row.created_by || null,
});

const extractCouponErrorMessages = (error: unknown): string[] => {
  if (!error || typeof error !== 'object') {
    return [];
  }

  const record = error as Record<string, unknown>;
  return ['message', 'details', 'hint', 'description', 'error_description']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

const updateCouponSchemaAvailability = (isAvailable: boolean | null) => {
  couponSchemaAvailability = isAvailable;
  couponSchemaCheckedAt = Date.now();
};

const shouldReuseCouponSchemaAvailability = () =>
  couponSchemaAvailability !== null && Date.now() - couponSchemaCheckedAt < SCHEMA_CHECK_TTL_MS;

const buildCouponSchemaHeaders = async (): Promise<Record<string, string>> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    Accept: 'application/openapi+json',
  };

  if (SUPABASE_ANON_KEY) {
    headers.apikey = SUPABASE_ANON_KEY;
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  } else if (SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  return headers;
};

const ensureCouponSchemaAvailable = async (): Promise<void> => {
  if (shouldReuseCouponSchemaAvailability()) {
    if (couponSchemaAvailability === false) {
      throw new Error(SCHEMA_HELP_MESSAGE);
    }
    return;
  }

  try {
    const response = await fetchWithSupabaseFallback(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: await buildCouponSchemaHeaders(),
    });

    if (!response.ok) {
      updateCouponSchemaAvailability(null);
      return;
    }

    const schemaText = await response.text();
    const isAvailable =
      schemaText.includes(`"/${PRICING_PLAN_COUPON_TABLE}"`) ||
      schemaText.includes(`/${PRICING_PLAN_COUPON_TABLE}`);

    updateCouponSchemaAvailability(isAvailable);

    if (!isAvailable) {
      throw new Error(SCHEMA_HELP_MESSAGE);
    }
  } catch (error) {
    if (error instanceof Error && error.message === SCHEMA_HELP_MESSAGE) {
      throw error;
    }

    updateCouponSchemaAvailability(null);
  }
};

const isMissingPricingPlanCouponSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = typeof record.code === 'string' ? record.code : '';
  const status =
    typeof record.status === 'number'
      ? record.status
      : typeof record.statusCode === 'number'
        ? record.statusCode
        : null;
  const normalized = extractCouponErrorMessages(error).join(' ').toLowerCase();

  if (MISSING_PRICING_PLAN_COUPON_ERROR_CODES.has(code)) {
    return true;
  }

  if (
    normalized.includes(PRICING_PLAN_COUPON_TABLE) &&
    (
      normalized.includes('does not exist') ||
      normalized.includes('schema cache') ||
      normalized.includes('not found') ||
      normalized.includes('could not find') ||
      normalized.includes('relation')
    )
  ) {
    return true;
  }

  if (status === 404 && (normalized.length === 0 || normalized.includes(PRICING_PLAN_COUPON_TABLE))) {
    return true;
  }

  return false;
};

const resolveCouponError = (error: any): string => {
  const messages = extractCouponErrorMessages(error);
  const message = messages[0] || String(error?.message || 'Unknown error');

  if (error?.code === '23505') {
    return 'A coupon with this code already exists.';
  }

  if (isMissingPricingPlanCouponSchemaError(error)) {
    updateCouponSchemaAvailability(false);
    return SCHEMA_HELP_MESSAGE;
  }

  return message;
};

class PricingPlanCouponService {
  async listCoupons(): Promise<PricingPlanCoupon[]> {
    await ensureCouponSchemaAvailable();

    const { data, error } = await supabase
      .from('pricing_plan_coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(resolveCouponError(error));
    }

    return (data || []).map(mapCouponRow);
  }

  async createCoupon(input: PricingPlanCouponInput): Promise<PricingPlanCoupon> {
    await ensureCouponSchemaAvailable();

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user?.id) {
      throw new Error('Authentication required.');
    }

    const payload = {
      code: normalizePlanCouponCode(input.code),
      description: input.description.trim(),
      discount_percentage: Math.round(Number(input.discountPercentage || 0)),
      applicable_plan_ids: normalizePlanIds(input.applicablePlanIds),
      is_active: Boolean(input.isActive),
      created_by: session.user.id,
    };

    const { data, error } = await supabase
      .from('pricing_plan_coupons')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(resolveCouponError(error));
    }

    return mapCouponRow(data);
  }

  async updateCoupon(id: string, input: PricingPlanCouponInput): Promise<PricingPlanCoupon> {
    await ensureCouponSchemaAvailable();

    const payload = {
      code: normalizePlanCouponCode(input.code),
      description: input.description.trim(),
      discount_percentage: Math.round(Number(input.discountPercentage || 0)),
      applicable_plan_ids: normalizePlanIds(input.applicablePlanIds),
      is_active: Boolean(input.isActive),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('pricing_plan_coupons')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(resolveCouponError(error));
    }

    return mapCouponRow(data);
  }

  async deleteCoupon(id: string): Promise<void> {
    await ensureCouponSchemaAvailable();

    const { error } = await supabase
      .from('pricing_plan_coupons')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(resolveCouponError(error));
    }
  }
}

export const pricingPlanCouponService = new PricingPlanCouponService();
