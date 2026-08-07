// Captures the `?ref=CODE` param from a shared referral link (generated in
// UserProfileManagement's "Referral Code" section as `${origin}/?ref=${code}`)
// and threads it through to signup. The referral reward logic itself (₹10 signup
// bonus + 10% ongoing commission) already exists server-side (see
// supabase/migrations/20250806161802_steep_cake.sql and
// supabase/functions/verify-payment/index.ts) — it was just never reachable
// because nothing ever read this query param off the URL.
const REFERRAL_STORAGE_KEY = 'pb_pending_referral_code';

export function capturePendingReferralCode(): void {
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim();
  if (ref) {
    localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
  }
}

export function getPendingReferralCode(): string | undefined {
  return localStorage.getItem(REFERRAL_STORAGE_KEY) || undefined;
}

export function clearPendingReferralCode(): void {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
