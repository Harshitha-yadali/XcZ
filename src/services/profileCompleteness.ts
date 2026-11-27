/**
 * What Auto Apply cannot fill a job form without (see applicantFrom in
 * supabase/functions/_shared/applicant.ts). Experience is left out: freshers
 * have none, and forms take "0" years for them.
 */
export function missingProfileFields(profile: any): string[] {
  let education = profile?.education_details;
  if (typeof education === 'string') {
    try { education = JSON.parse(education); } catch { education = []; }
  }
  const missing: string[] = [];
  if (!String(profile?.full_name || '').trim()) missing.push('Full name');
  if (!String(profile?.email_address || '').trim()) missing.push('Email');
  // Indian mobile numbers are 10 digits; anything shorter is not a phone a recruiter can call.
  if (String(profile?.phone || '').replace(/\D/g, '').length < 10) missing.push('Phone');
  if (!String(profile?.current_location || '').trim()) missing.push('City');
  if (!(Array.isArray(education) && education.some((e: any) => e?.degree || e?.school))) missing.push('Education');
  return missing;
}
