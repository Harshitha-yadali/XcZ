// Daily job marketing email. Called by pg_cron (job-marketing-email) every
// 10 minutes from 08:30 to 14:20 IST; sends up to 30 a run and 200-1000 a day
// (dailyCap) through the Hostinger mailbox, everyone in turn (see next_marketing_recipients).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { EmailService } from '../_shared/emailService.ts';
import { getCaller } from '../_shared/auth.ts';
import { marketingHtml, marketingSubject, unsubscribeToken, type MarketingJob } from '../_shared/marketingEmail.ts';

// Hostinger allows 3,000 a day for this mailbox; marketing ramps up so the
// rest stays free for normal mail and Gmail sees a slow, steady start.
const START = Date.UTC(2026, 10, 28); // first send day (IST date)
const dailyCap = (istDay: number) => {
  const day = Math.floor((istDay - START) / 86400_000);
  return day < 3 ? 200 : day < 10 ? 500 : 1000;
};
const PER_RUN = 30;
const MIN_JOBS = 3;
const PROXY = 'https://red-sky-a122.harshithayadali30.workers.dev';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (!(await getCaller(req)).isService) return json({ error: 'Not allowed.' }, 401);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  // Today in India, as a UTC timestamp.
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const istMidnight = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600_000);
  const { count: sentToday } = await supabase
    .from('marketing_emails').select('user_id', { count: 'exact', head: true })
    .gte('last_sent_at', istMidnight.toISOString());
  const cap = dailyCap(istMidnight.getTime() + 5.5 * 3600_000);
  const budget = Math.min(PER_RUN, cap - (sentToday ?? 0));
  if (budget <= 0) return json({ success: true, skipped: 'daily cap reached', sentToday });

  // Newest open jobs of the last week, Auto Apply-ready ones first.
  const { data: jobs, error: jobsError } = await supabase
    .from('job_listings')
    .select('id, company_name, role_title, location_city, location_type, experience_required, package_amount, apply_check, created_at')
    .eq('is_active', true)
    .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(30);
  if (jobsError) return json({ error: jobsError.message }, 500);
  const picked = [...(jobs ?? [])]
    .sort((a, b) => Number(b.apply_check === 'works') - Number(a.apply_check === 'works'))
    .slice(0, 5) as MarketingJob[];
  if (picked.length < MIN_JOBS) return json({ success: true, skipped: `only ${picked.length} new jobs` });

  const { data: users, error: usersError } = await supabase.rpc('next_marketing_recipients', { p_limit: budget });
  if (usersError) return json({ error: usersError.message }, 500);

  const dayIndex = Math.floor(ist.getTime() / 86400_000);
  const mailer = new EmailService();
  let sent = 0;
  const failed: string[] = [];
  for (const u of users ?? []) {
    const t = await unsubscribeToken(u.user_id, serviceKey);
    const q = `u=${u.user_id}&t=${t}`;
    const result = await mailer.sendEmail({
      to: u.email,
      subject: marketingSubject(picked, u.full_name, dayIndex),
      html: marketingHtml({ jobs: picked, name: u.full_name, unsubscribeUrl: `https://primoboostai.in/unsubscribe?${q}`, dayIndex }),
      unsubscribeUrl: `${PROXY}/functions/v1/marketing-unsubscribe?${q}`,
    });
    if (result.success) sent++;
    else failed.push(`${u.user_id}: ${result.error}`);
    // Mark failures as mailed too, so one bad address can't block the queue.
    const { data: row } = await supabase.from('marketing_emails').select('sent_count').eq('user_id', u.user_id).maybeSingle();
    await supabase.from('marketing_emails').upsert({
      user_id: u.user_id,
      last_sent_at: new Date().toISOString(),
      sent_count: (row?.sent_count ?? 0) + (result.success ? 1 : 0),
    });
    // Hostinger throttles bursts; keep it gentle.
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('job_marketing', { sent, failed: failed.length, sentToday: (sentToday ?? 0) + (users?.length ?? 0) });
  return json({ success: true, sent, failed });
});
