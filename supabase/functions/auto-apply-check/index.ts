import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { denied, getCaller } from "../_shared/auth.ts";
import { findTwin, isJobClosed } from "../_shared/jobCheck.ts";

// Looks at a job before any AI is spent on it: has the user already got this one
// under another listing, and is it still open? It only reports. Queueing happens
// later, in auto-apply-queue, which makes the duplicate check again for itself.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { user } = await getCaller(req);
    if (!user) return denied("Sign in required.", 401, corsHeaders);

    const { jobId } = await req.json();
    if (typeof jobId !== 'string' || !jobId) return json({ error: 'Which job?' }, 400);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: job } = await supabase
      .from('job_listings')
      .select('id, application_link, role_title, is_active')
      .eq('id', jobId)
      .maybeSingle();
    if (!job?.application_link) return json({ closed: false, twin: null });

    const twin = await findTwin(supabase, user.id, job);
    return json({ twin, closed: !twin && (job.is_active === false || await isJobClosed(job.application_link)) });
  } catch (error: any) {
    console.error('Error checking a job:', error);
    return json({ error: 'This job could not be checked.' }, 500);
  }
});
