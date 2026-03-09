import type { SessionPromoCode, SessionService } from '../types/session';

export interface SessionPromoValidationResult {
  isValid: boolean;
  couponApplied: string | null;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
  message: string;
}

export function normalizeSessionPromoCodes(raw: unknown): SessionPromoCode[] {
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
      } satisfies SessionPromoCode;
    })
    .filter((entry): entry is SessionPromoCode => Boolean(entry));
}

export function getSessionRegularPrice(
  service: Pick<SessionService, 'price' | 'regular_price'>
): number {
  const offerPrice = Math.max(0, Number(service.price || 0));
  const regularPrice = Number(service.regular_price ?? offerPrice);

  if (!Number.isFinite(regularPrice) || regularPrice <= 0) {
    return offerPrice;
  }

  return Math.max(regularPrice, offerPrice);
}

export function hasSessionOffer(
  service: Pick<SessionService, 'price' | 'regular_price'>
): boolean {
  return getSessionRegularPrice(service) > Math.max(0, Number(service.price || 0));
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

export function normalizeSessionService(raw: any): SessionService {
  const offerPrice = Math.max(0, Number(raw?.price || 0));

  return {
    id: String(raw?.id || ''),
    title: String(raw?.title || ''),
    description: String(raw?.description || ''),
    price: offerPrice,
    regular_price: getSessionRegularPrice({
      price: offerPrice,
      regular_price: raw?.regular_price == null ? offerPrice : Number(raw.regular_price),
    }),
    currency: String(raw?.currency || 'INR'),
    highlights: Array.isArray(raw?.highlights)
      ? raw.highlights.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
    promo_codes: normalizeSessionPromoCodes(raw?.promo_codes),
    bonus_credits: Number(raw?.bonus_credits || 0),
    max_slots_per_day: Number(raw?.max_slots_per_day || 0),
    time_slots: Array.isArray(raw?.time_slots)
      ? raw.time_slots.filter((entry: unknown): entry is string => typeof entry === 'string')
      : [],
    meet_link: typeof raw?.meet_link === 'string' ? raw.meet_link : '',
    is_active: Boolean(raw?.is_active),
    created_at: String(raw?.created_at || ''),
    updated_at: String(raw?.updated_at || ''),
  };
}
