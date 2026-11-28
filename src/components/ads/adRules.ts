// Pure rules for where Google AdSense may appear. Content pages only, never money pages.

const NOT_JOB_DETAIL = new Set(['auto-applied', 'applications', 'company']);

export function isAdAllowedPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/blog' || path.startsWith('/blog/')) return true;
  if (path.startsWith('/tutorials')) return true;
  if (path === '/jobs') return true;
  // /jobs/<id> only; not /jobs/<id>/apply, /jobs/applications, /jobs/auto-applied
  const m = path.match(/^\/jobs\/([^/]+)$/);
  return !!m && !NOT_JOB_DETAIL.has(m[1]);
}

/** Paying = has an active subscription that is not the free trial ('lite_check' with no payment). */
export function isPayingSubscription(sub: { planId?: string | null; paymentId?: string | null } | null | undefined): boolean {
  if (!sub) return false;
  return !!sub.paymentId || sub.planId !== 'lite_check';
}

/** paying: true / false, or undefined while still unknown (show nothing then). */
export function shouldShowAd(opts: { client?: string; pathname: string; paying: boolean | undefined }): boolean {
  return !!opts.client && opts.paying === false && isAdAllowedPath(opts.pathname);
}
