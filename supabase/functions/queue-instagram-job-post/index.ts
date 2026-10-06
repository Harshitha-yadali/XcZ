import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { denyUnlessServiceOrAdmin } from "../_shared/auth.ts";
import { buildCaption, type JobCard, nextSlot, pickVariant } from "../_shared/instagram.ts";
import { formatCompensation, formatEligibleYears, formatExperience, formatLocation } from "../_shared/jobFormat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Queues an Instagram Reel for a job an admin just posted (see persistJobListing
 * in JobUploadForm.tsx, next to notify-telegram-job-update). Only reserves the
 * next free posting slot and stores the text for the video; rendering happens
 * in GitHub Actions and publishing in publish-instagram-posts.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const deny = await denyUnlessServiceOrAdmin(req, corsHeaders);
  if (deny) return deny;

  try {
    const { jobId } = await req.json();
    if (!jobId) return json({ success: false, error: "jobId is required" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: job, error: jobError } = await supabase
      .from("job_listings")
      .select("id, company_name, role_title, location_type, location_city, package_amount, package_type, eligible_years, experience_required, is_active")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw new Error(`Failed to fetch job: ${jobError.message}`);
    if (!job || !job.is_active) return json({ success: true, message: "Job not found or inactive, nothing to queue." });

    const card: JobCard = {
      company: job.company_name,
      role: job.role_title,
      salary: formatCompensation(job),
      experience: formatExperience(job),
      location: formatLocation(job),
      eligible: formatEligibleYears(job),
    };

    const { data: lastTested } = await supabase
      .from("instagram_job_posts").select("hook_variant")
      .not("hook_variant", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const hookVariant = pickVariant(card, lastTested?.hook_variant ?? null);

    // The unique index on scheduled_at settles two jobs racing for one slot:
    // the loser re-reads the taken slots and picks the next one.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: upcoming, error: slotsError } = await supabase
        .from("instagram_job_posts")
        .select("scheduled_at")
        .gte("scheduled_at", new Date().toISOString());
      if (slotsError) throw new Error(`Failed to read slots: ${slotsError.message}`);

      const scheduledAt = nextSlot(new Date(), (upcoming || []).map((row) => row.scheduled_at));
      const { error: insertError } = await supabase.from("instagram_job_posts").insert({
        job_id: job.id,
        scheduled_at: scheduledAt.toISOString(),
        caption: buildCaption(card, hookVariant),
        hook_variant: hookVariant,
        card,
      });

      if (!insertError) return json({ success: true, scheduledAt: scheduledAt.toISOString() });
      if (insertError.code !== "23505") throw new Error(`Failed to queue post: ${insertError.message}`);
      if (insertError.message.includes("job_id")) return json({ success: true, message: "Already queued." });
    }

    throw new Error("Could not reserve a posting slot");
  } catch (error) {
    console.error("Error in queue-instagram-job-post:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Failed to queue Instagram post" }, 500);
  }
});
