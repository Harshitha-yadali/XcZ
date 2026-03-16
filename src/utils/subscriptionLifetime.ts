export const LIFETIME_PLAN_END_DATE_ISO = '9999-12-31T23:59:59.999Z';

export const isLifetimeSubscriptionEndDate = (dateString?: string | null): boolean => {
  if (!dateString) {
    return false;
  }

  const date = new Date(dateString);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 9999;
};

export const getSubscriptionDaysRemaining = (dateString?: string | null): number => {
  if (!dateString || isLifetimeSubscriptionEndDate(dateString)) {
    return Number.POSITIVE_INFINITY;
  }

  const end = new Date(dateString);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
};

export const formatSubscriptionEndDate = (dateString?: string | null): string => {
  if (!dateString) {
    return '-';
  }

  if (isLifetimeSubscriptionEndDate(dateString)) {
    return 'Lifetime';
  }

  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
