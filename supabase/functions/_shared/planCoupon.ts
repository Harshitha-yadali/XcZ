export interface PricingPlanCouponRecord {
  code: string;
  description?: string | null;
  discount_percentage: number;
  applicable_plan_ids?: string[] | null;
  is_active?: boolean;
}

const PENDING_COUPON_HOLD_WINDOW_MS = 30 * 60 * 1000;

export const normalizePricingPlanCouponCode = (couponCode: string): string =>
  couponCode.trim().toUpperCase();

export const normalizePricingPlanIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean),
    ),
  );
};

export const pricingPlanCouponAppliesToPlan = (
  coupon: Pick<PricingPlanCouponRecord, 'applicable_plan_ids'>,
  planId: string,
): boolean => {
  const applicablePlanIds = normalizePricingPlanIds(coupon.applicable_plan_ids);
  return applicablePlanIds.length === 0 || applicablePlanIds.includes(planId);
};

export const applyPricingPlanCoupon = (
  originalPrice: number,
  coupon: Pick<PricingPlanCouponRecord, 'discount_percentage'>,
): {
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
} => {
  const safeOriginalPrice = Math.max(0, Math.round(Number(originalPrice || 0)));
  const discountPercentage = Math.max(
    0,
    Math.min(100, Math.round(Number(coupon.discount_percentage || 0))),
  );
  const discountAmount = Math.min(
    safeOriginalPrice,
    Math.round((safeOriginalPrice * discountPercentage) / 100),
  );

  return {
    discountPercentage,
    discountAmount,
    finalAmount: Math.max(0, safeOriginalPrice - discountAmount),
  };
};

export const getPricingPlanCouponPendingHoldSinceIso = (): string =>
  new Date(Date.now() - PENDING_COUPON_HOLD_WINDOW_MS).toISOString();
