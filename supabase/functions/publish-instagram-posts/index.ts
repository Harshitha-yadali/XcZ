import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { denyUnlessServiceOrAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function graph(path: string, token: string, params?: Record<string, string>) {
  const base = Deno.env.get("INSTAGRAM_GRAPH_BASE") || "https://graph.instagram.com";
  const response = await fetch(`${base}${path}`, params
    ? { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: new URLSearchParams(params) }
    : { headers: { Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok || result.error) {
    throw new Error(result.error?.message || `Instagram API request failed (${response.status})`);
  }
  return result;
}

/**
 * Runs every 10 minutes from pg_cron. Publishing a Reel is two API calls with
 * Meta's video processing in between, so each run does one step per row
 * instead of waiting: rendered → container_created → published.
 *
 * ponytail: no row locking, overlapping runs could create a duplicate
 * container. Runs take seconds and fire 10 minutes apart; claim rows with a
 * conditional update if that ever changes.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const deny = await denyUnlessServiceOrAdmin(req, corsHeaders);
  if (deny) return deny;

  const igUserId = Deno.env.get("INSTAGRAM_USER_ID");
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!igUserId || !token) {
    console.warn("publish-instagram-posts: INSTAGRAM_USER_ID/INSTAGRAM_ACCESS_TOKEN not configured, skipping.");
    return json({ success: false, skipped: true, message: "Instagram is not configured." });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const summary = { containersCreated: 0, published: 0, stillProcessing: 0, failed: 0 };

  const update = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("instagram_job_posts").update(values).eq("id", id);
    if (error) console.error(`publish-instagram-posts: failed to update ${id}:`, error.message);
  };
  const fail = async (id: string, error: unknown) => {
    console.error(`publish-instagram-posts: ${id} failed:`, error);
    summary.failed++;
    await update(id, { status: "failed", error: error instanceof Error ? error.message : String(error) });
  };

  try {
    const { data: processing, error: processingError } = await supabase
      .from("instagram_job_posts").select("id, ig_container_id").eq("status", "container_created").limit(5);
    if (processingError) throw new Error(processingError.message);

    for (const post of processing || []) {
      try {
        const { status_code } = await graph(`/${post.ig_container_id}?fields=status_code`, token);
        if (status_code === "FINISHED") {
          const { id: mediaId } = await graph(`/${igUserId}/media_publish`, token, { creation_id: post.ig_container_id });
          await update(post.id, { status: "published", ig_media_id: mediaId, published_at: new Date().toISOString() });
          summary.published++;
        } else if (status_code === "IN_PROGRESS") {
          summary.stillProcessing++;
        } else {
          await fail(post.id, `Instagram could not process the video (${status_code})`);
        }
      } catch (error) {
        await fail(post.id, error);
      }
    }

    const { data: due, error: dueError } = await supabase
      .from("instagram_job_posts").select("id, video_url, caption, job_listings(is_active)")
      .eq("status", "rendered").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
    if (dueError) throw new Error(dueError.message);

    for (const post of due || []) {
      const job = post.job_listings as unknown as { is_active: boolean } | null;
      if (!job?.is_active) {
        await fail(post.id, "Job was closed before its Reel was published");
        continue;
      }
      try {
        // thumb_offset picks the cover: the Reel opens on an empty card, so use
        // a frame from the hold at the end where every detail is visible.
        const { id: containerId } = await graph(`/${igUserId}/media`, token, {
          media_type: "REELS", video_url: post.video_url, caption: post.caption, share_to_feed: "true", thumb_offset: "7000",
        });
        await update(post.id, { status: "container_created", ig_container_id: containerId });
        summary.containersCreated++;
      } catch (error) {
        await fail(post.id, error);
      }
    }

    return json({ success: true, ...summary });
  } catch (error) {
    console.error("Error in publish-instagram-posts:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Failed to publish Instagram posts" }, 500);
  }
});
