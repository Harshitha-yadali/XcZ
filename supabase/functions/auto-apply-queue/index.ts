import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { denied, getCaller } from "../_shared/auth.ts";
import { canAutoApply, detectPlatform } from "../_shared/applyForm.ts";

/** Marks a Smart Apply row: the page shows its resume, the job link and "I've applied". */
const SMART_APPLY_MESSAGE = 'Smart Apply: your tailored resume is ready. Open the job, apply there with it, then press "I\'ve applied".';
import { findTwin } from "../_shared/jobCheck.ts";

// Puts an application on the queue and returns. A worker does the rest, so the
// user can close the site the moment they have pressed Auto Apply. Nothing here
// opens a browser: this function only has to be quick, and to be sure the job
// is one the user may apply to once.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** A row still holding the one-live-application lock is the user's answer already. */
const LIVE = 'status.neq.failed';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { user } = await getCaller(req);
    if (!user) return denied("Sign in required.", 401, corsHeaders);

    // `resumeVersionId` is the tailored resume. The browser still makes it, so
    // it comes in here; once the worker tailors the resume as well this becomes
    // optional and the worker fills it in.
    const { jobId, resumeVersionId } = await req.json();
    if (typeof jobId !== 'string' || !jobId) return json({ success: false, error: 'Which job?' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: agent } = await supabase.from('apply_agents').select('active').eq('user_id', user.id).maybeSingle();
    if (!agent?.active) return json({ success: false, error: 'AGENT_OFF' }, 403);

    const { data: job } = await supabase
      .from('job_listings')
      .select('id, application_link, role_title, is_active, apply_check')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return json({ success: false, error: 'That job was not found.' }, 404);
    if (!job.application_link) return json({ success: false, error: 'This job has no application link.' }, 400);
    if (job.is_active === false) return json({ success: false, error: 'This job is no longer open.' }, 400);

    // One application per user and job. The database enforces it too; this is
    // here so a second press returns the first application rather than an error.
    const { data: live } = await supabase
      .from('auto_apply_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('job_listing_id', jobId)
      .or(LIVE)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (live) return json({ success: true, applicationId: live.id, status: live.status, queued: false });

    // The same job can sit on two listings, and the database only knows listings.
    const twin = await findTwin(supabase, user.id, job);
    if (twin) return json({ success: true, applicationId: twin.id, status: twin.status, queued: false });

    // A resume belongs to whoever asked for it; one named here is only used
    // when it is this user's own.
    let resumeId: string | null = null;
    if (typeof resumeVersionId === 'string' && resumeVersionId) {
      const { data: resume } = await supabase
        .from('optimized_resumes')
        .select('id')
        .eq('id', resumeVersionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!resume) return json({ success: false, error: 'That tailored resume was not found.' }, 400);
      resumeId = resume.id;
    }

    const { data: created, error } = await supabase
      .from('auto_apply_applications')
      .insert({
        user_id: user.id,
        job_listing_id: jobId,
        resume_version_id: resumeId,
        platform: detectPlatform(job.application_link),
        application_url: job.application_link,
        // Only sites the runner finishes go on its queue; the rest are handed
        // to the user now rather than failing at a sign-in or captcha later.
        // and only jobs the runner has test-filled successfully ('works').
        ...(canAutoApply(job.application_link) && job.apply_check === 'works'
          ? { status: 'queued' }
          : { status: 'needs_manual_action', error_message: SMART_APPLY_MESSAGE }),
      })
      .select('id, status')
      .single();

    // Losing the race with another tab is not an error: that application is live.
    if (error?.code === '23505') {
      const { data: theirs } = await supabase
        .from('auto_apply_applications')
        .select('id, status')
        .eq('user_id', user.id).eq('job_listing_id', jobId).or(LIVE)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (theirs) return json({ success: true, applicationId: theirs.id, status: theirs.status, queued: false });
    }
    if (error) throw error;

    return json({ success: true, applicationId: created.id, status: created.status, queued: true });
  } catch (error: any) {
    console.error('Error queueing auto-apply:', error);
    return json({ success: false, error: 'This application could not be queued. Please try again.' }, 500);
  }
});
