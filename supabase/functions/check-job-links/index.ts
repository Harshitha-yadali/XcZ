import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isJobClosed, pageSaysClosed } from "../_shared/jobCheck.ts";

// Removes closed jobs from the site. Called every hour by pg_cron; each run
// checks the open jobs looked at longest ago, so every job is checked about
// once a day. A closed job nobody has used is deleted. One a user has tailored
// a resume for or applied to is hidden instead: deleting it would cascade into
// their resumes and application history.
//
// "Closed" means the hiring system says so, the page is gone, or it plainly
// says the job is over. Anything unclear is left open: a wrong "closed" takes a
// real job away from every user.

const BUDGET_MS = 100_000;
const BATCH = 400;
const AT_ONCE = 8;

Deno.serve(async (req: Request) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // The hourly cron sends its own secret (kept in Vault), so the service key
  // never has to be stored in the database.
  const cronSecret = Deno.env.get('CHECK_JOBS_SECRET');
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${serviceKey}` && !(cronSecret && auth === `Bearer ${cronSecret}`)) {
    return new Response(JSON.stringify({ error: 'Not allowed.' }), { status: 401 });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const started = Date.now();

  const { data: jobs, error } = await supabase
    .from('job_listings')
    .select('id, application_link')
    .eq('is_active', true)
    .not('application_link', 'is', null)
    .order('link_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const closed: string[] = [];
  const open: string[] = [];
  let next = 0;
  const work = async () => {
    while (next < jobs.length && Date.now() - started < BUDGET_MS) {
      const job = jobs[next++];
      const bySystem = await isJobClosed(job.application_link);
      const gone = bySystem || await pageSaysClosed(job.application_link);
      (gone ? closed : open).push(job.id);
      // Deleted rows are gone for good, so each removal is on record in the logs.
      if (gone) console.info('job_closed', JSON.stringify({ id: job.id, link: job.application_link, by: bySystem ? 'hiring system' : 'page' }));
    }
  };
  await Promise.all(Array.from({ length: AT_ONCE }, work));

  const now = new Date().toISOString();
  if (open.length) await supabase.from('job_listings').update({ link_checked_at: now }).in('id', open);

  let deleted = 0;
  let hidden = 0;
  if (closed.length) {
    const used = new Set<string>();
    for (const table of ['auto_apply_applications', 'optimized_resumes']) {
      const { data } = await supabase.from(table).select('job_listing_id').in('job_listing_id', closed);
      for (const row of data || []) used.add(row.job_listing_id);
    }
    const toHide = closed.filter((id) => used.has(id));
    const toDelete = closed.filter((id) => !used.has(id));
    if (toHide.length) {
      const { error: hideError } = await supabase.from('job_listings').update({ is_active: false, link_checked_at: now }).in('id', toHide);
      if (!hideError) hidden = toHide.length;
    }
    if (toDelete.length) {
      const { error: deleteError } = await supabase.from('job_listings').delete().in('id', toDelete);
      if (!deleteError) deleted = toDelete.length;
      else console.error('Delete failed, hiding instead:', deleteError.message);
      if (deleteError) await supabase.from('job_listings').update({ is_active: false, link_checked_at: now }).in('id', toDelete);
    }
  }

  const summary = { checked: open.length + closed.length, stillOpen: open.length, deleted, hidden, seconds: Math.round((Date.now() - started) / 1000) };
  console.info('check_job_links', JSON.stringify(summary));
  return new Response(JSON.stringify(summary), { headers: { 'Content-Type': 'application/json' } });
});
