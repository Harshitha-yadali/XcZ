export interface SessionPromoCodeConfig {
  code: string;
  discount_percentage: number;
  description?: string;
}

export function normalizeSessionPromoCode(code: string): string {
  return code.trim().toLowerCase();
}

export function parseSessionPromoCodes(raw: unknown): SessionPromoCodeConfig[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const code = typeof record.code === 'string' ? record.code.trim().toUpperCase() : '';
      const discountPercentage = Number(record.discount_percentage ?? 0);
      const description = typeof record.description === 'string' ? record.description.trim() : '';

      if (!code || !Number.isFinite(discountPercentage) || discountPercentage <= 0 || discountPercentage > 100) {
        return null;
      }

      return {
        code,
        discount_percentage: Math.round(discountPercentage),
        description,
      } satisfies SessionPromoCodeConfig;
    })
    .filter((entry): entry is SessionPromoCodeConfig => Boolean(entry));
}

export function findSessionPromo(
  rawPromoCodes: unknown,
  couponCode: string
): SessionPromoCodeConfig | null {
  const normalizedCoupon = normalizeSessionPromoCode(couponCode);

  return (
    parseSessionPromoCodes(rawPromoCodes).find(
      (promo) => normalizeSessionPromoCode(promo.code) === normalizedCoupon
    ) || null
  );
}

export function calculateSessionPromoDiscount(
  offerPrice: number,
  discountPercentage: number
): number {
  const safeOfferPrice = Math.max(0, Number(offerPrice || 0));
  const safeDiscountPercentage = Math.min(100, Math.max(0, Number(discountPercentage || 0)));

  if (!safeOfferPrice || !safeDiscountPercentage) {
    return 0;
  }

  return Math.min(safeOfferPrice, Math.floor((safeOfferPrice * safeDiscountPercentage) / 100));
}

export function applySessionPromo(
  offerPrice: number,
  promo: SessionPromoCodeConfig
): { discountAmount: number; finalAmount: number } {
  const discountAmount = calculateSessionPromoDiscount(offerPrice, promo.discount_percentage);
  return {
    discountAmount,
    finalAmount: Math.max(0, offerPrice - discountAmount),
  };
}
