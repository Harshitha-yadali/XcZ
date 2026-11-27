// Daily job marketing email: subject and HTML. Pure, so it can be tested and
// previewed without sending anything.

export interface MarketingJob {
  id: string;
  company_name: string;
  role_title: string;
  location_city?: string | null;
  location_type?: string | null;
  experience_required?: string | null;
  package_amount?: number | null;
  apply_check?: string | null;
}

const SITE = 'https://primoboostai.in';
const UTM = 'utm_source=email&utm_medium=marketing&utm_campaign=daily_jobs';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const firstName = (name: string) => (name || '').trim().split(/\s+/)[0] || 'there';

const companies = (jobs: MarketingJob[]) => {
  const names = [...new Set(jobs.map((j) => j.company_name))];
  return names.length > 2 ? `${names[0]}, ${names[1]} & more` : names.join(' & ');
};

const lpa = (n?: number | null) => {
  if (!n || n <= 0) return '';
  if (n < 100) return `₹${n} LPA`; // already in lakhs
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} LPA`;
  return `₹${n.toLocaleString('en-IN')}`; // e.g. an intern stipend
};

const pick = <T,>(list: T[], i: number) => list[((i % list.length) + list.length) % list.length];

/** A different subject each day of the week; dayIndex = days since epoch. */
export function marketingSubject(jobs: MarketingJob[], name: string, dayIndex: number): string {
  const n = jobs.length;
  const top = jobs[0]?.company_name ?? 'Top companies';
  return pick([
    `🔥 ${n} new jobs this week: ${companies(jobs)}`,
    `${firstName(name)}, ${top} is hiring. Apply in 1 click ⚡`,
    `Don't miss these ${n} jobs before they close`,
    `Your next job could be here: ${companies(jobs)}`,
    `${n} fresh openings picked for you, ${firstName(name)}`,
    `${top} + ${n - 1} more jobs. Your resume, tailored for each`,
    `Weekend plan: apply to ${n} jobs in 5 minutes ⚡`,
  ], dayIndex);
}

const TIPS = [
  'Recruiters spend about 7 seconds on a first look. Put your strongest skill in the first line of your resume.',
  'Copy 3-4 exact keywords from the job description into your resume. ATS software looks for them.',
  'Apply within 48 hours of a job going live. Early applications get read first.',
  'Numbers stand out: "built 3 projects" or "cut load time by 40%" beat "worked on projects".',
  'One resume for every job gets filtered out. A tailored resume per job gets shortlisted.',
];

export function marketingHtml(opts: {
  jobs: MarketingJob[];
  name: string;
  unsubscribeUrl: string;
  dayIndex: number;
}): string {
  const { jobs, name, unsubscribeUrl, dayIndex } = opts;
  const cards = jobs
    .map((j) => {
      const meta = [j.location_city || j.location_type, j.experience_required, lpa(j.package_amount)]
        .filter(Boolean).map(esc).join(' · ');
      const auto = j.apply_check === 'works'
        ? '<span style="display:inline-block;background:#d1fae5;color:#047857;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;margin-bottom:6px">⚡ AUTO APPLY READY</span><br>'
        : '';
      return `
      <tr><td style="padding:0 0 12px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
          <tr><td style="padding:16px 18px">
            ${auto}
            <div style="font-size:16px;font-weight:700;color:#0f172a">${esc(j.role_title)}</div>
            <div style="font-size:14px;color:#334155;margin-top:2px">${esc(j.company_name)}</div>
            ${meta ? `<div style="font-size:13px;color:#64748b;margin-top:6px">${meta}</div>` : ''}
            <a href="${SITE}/jobs/${encodeURIComponent(j.id)}?${UTM}" style="display:inline-block;margin-top:12px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:8px">Apply now →</a>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="background:linear-gradient(135deg,#10b981,#06b6d4);background-color:#10b981;border-radius:16px 16px 0 0;padding:28px 24px;color:#ffffff">
    <div style="font-size:13px;font-weight:700;letter-spacing:1px;opacity:.9">PRIMOBOOST AI · JOBS FOR YOU</div>
    <div style="font-size:24px;font-weight:800;margin-top:8px;line-height:1.25">Hi ${esc(firstName(name))}, ${jobs.length} new jobs are open now</div>
    <div style="font-size:15px;margin-top:8px;opacity:.95">We tailor your resume to each job and apply for you in one click.</div>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 16px 8px">
    <table width="100%" cellpadding="0" cellspacing="0">${cards}</table>
  </td></tr>
  <tr><td style="background:#0f172a;padding:22px 24px;color:#e2e8f0">
    <div style="font-size:17px;font-weight:800;color:#ffffff">⚡ Let AI apply for you</div>
    <div style="font-size:14px;margin-top:6px;line-height:1.5">Pick a job, click <b>Auto Apply</b>. We rewrite your resume for that job and fill the application, so you spend time on interviews, not forms.</div>
    <a href="${SITE}/jobs?${UTM}" style="display:inline-block;margin-top:14px;background:#ffffff;color:#0f172a;text-decoration:none;font-weight:800;font-size:14px;padding:11px 20px;border-radius:8px">See all jobs</a>
  </td></tr>
  <tr><td style="background:#ffffff;padding:18px 24px;border-radius:0 0 16px 16px">
    <div style="font-size:13px;font-weight:800;color:#047857">💡 TIP OF THE DAY</div>
    <div style="font-size:14px;color:#334155;margin-top:4px;line-height:1.5">${esc(pick(TIPS, dayIndex))}</div>
    <a href="${SITE}/score-checker?${UTM}" style="display:inline-block;margin-top:10px;color:#059669;font-weight:700;font-size:14px">Check your resume score →</a>
  </td></tr>
  <tr><td style="padding:18px 12px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.6">
    You're getting this because you have a PrimoBoost AI account.<br>
    <a href="${esc(unsubscribeUrl)}" style="color:#64748b">Unsubscribe from job emails</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** Unsubscribe token: HMAC-SHA256 of the user id, so links can't be forged. */
export async function unsubscribeToken(userId: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`unsub:${userId}`));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
