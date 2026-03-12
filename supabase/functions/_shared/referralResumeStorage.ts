export const REFERRAL_RESUME_BUCKET_ID = 'referral-resumes';
export const REFERRAL_RESUME_MAX_BYTES = 5 * 1024 * 1024;

export function sanitizeReferralResumeFileName(fileName?: string): string {
  const trimmed = (fileName || 'resume.pdf').trim() || 'resume.pdf';
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (sanitized.toLowerCase().endsWith('.pdf')) {
    return sanitized;
  }

  return `${sanitized}.pdf`;
}

export function buildReferralResumeStoragePath(
  userId: string,
  listingId: string,
  paymentTransactionId: string,
): string {
  return `referrals/${userId}/${listingId}/${paymentTransactionId}/resume.pdf`;
}

function isAlreadyExistsError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('already exists') || message.includes('duplicate');
}

export async function ensureReferralResumeBucket(supabase: any): Promise<void> {
  const { error } = await supabase.storage.createBucket(REFERRAL_RESUME_BUCKET_ID, {
    public: false,
    fileSizeLimit: REFERRAL_RESUME_MAX_BYTES,
    allowedMimeTypes: ['application/pdf'],
  });

  if (error && !isAlreadyExistsError(error)) {
    throw new Error(error.message || 'Failed to ensure referral resume bucket.');
  }
}
