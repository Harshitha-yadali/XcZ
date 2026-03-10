import type { JobListing } from '../types/jobs';

type JobStatusSource = Pick<JobListing, 'is_active' | 'expires_at'>;

const parseDateValue = (value?: string | null): Date | null => {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
};

export type JobDisplayStatus = 'active' | 'expired' | 'inactive';

export const getJobExpiryDate = (value?: string | null): Date | null => parseDateValue(value);

export const isJobExpired = (job: Pick<JobListing, 'expires_at'>): boolean => {
  const expiryDate = getJobExpiryDate(job.expires_at);
  return Boolean(expiryDate && expiryDate.getTime() <= Date.now());
};

export const isJobOpen = (job: JobStatusSource): boolean => Boolean(job.is_active) && !isJobExpired(job);

export const getJobDisplayStatus = (job: JobStatusSource): JobDisplayStatus => {
  if (isJobExpired(job)) return 'expired';
  return job.is_active ? 'active' : 'inactive';
};

export const formatJobExpiryLabel = (value?: string | null): string => {
  const expiryDate = getJobExpiryDate(value);
  if (!expiryDate) return '';

  return expiryDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};
