import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jobLink, matchesKeyword, verifyMetaSignature } from "../_shared/instagram.ts";

/**
 * Meta calls this for every comment on the account's posts. Deployed with
 * --no-verify-jwt: Meta cannot send a Supabase JWT, so the request is
 * authenticated by its X-Hub-Signature-256 signature instead.
 *
 * When someone comments the keyword on a job Reel, they get a DM with that
 * job's link and a public reply telling them to check their inbox.
 */
Deno.serve(async (req: Request) => {
  // One-time subscription check from the Meta app dashboard.
  if (req.method === "GET") {
    const url = new URL(req.url);
    const verifyToken = Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN");
    const ok = verifyToken && url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === verifyToken;
    return new Response(ok ? url.searchParams.get("hub.challenge") : "Forbidden", { status: ok ? 200 : 403 });
  }

  const rawBody = await req.text();
  const signed = await verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), Deno.env.get("META_APP_SECRET") || "");
  if (!signed) return new Response("Invalid signature", { status: 401 });

  const igUserId = Deno.env.get("INSTAGRAM_USER_ID");
  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!igUserId || !token) {
    console.warn("instagram-webhook: INSTAGRAM_USER_ID/INSTAGRAM_ACCESS_TOKEN not configured, skipping.");
    return new Response("OK", { status: 200 });
  }

  const base = Deno.env.get("INSTAGRAM_GRAPH_BASE") || "https://graph.instagram.com";
  const siteUrl = Deno.env.get("SITE_URL") || "https://primoboost.ai";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const send = async (path: string, body: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(result.error?.message || `Instagram API request failed (${response.status})`);
  };

  let failed = false;
  const payload = JSON.parse(rawBody);

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const comment = change.value;
      // Skip replies and our own comments, which include the reply sent below.
      if (change.field !== "comments" || !comment?.id || comment.parent_id || comment.from?.id === igUserId) continue;
      if (!matchesKeyword(comment.text)) continue;

      const { data: post } = await supabase
        .from("instagram_job_posts").select("job_id, hook_variant").eq("ig_media_id", comment.media?.id || "").maybeSingle();
      if (!post) continue;

      // Meta retries deliveries; the primary key makes a comment get one DM.
      const { error: dedupeError } = await supabase
        .from("instagram_comment_dms").insert({ comment_id: comment.id, ig_media_id: comment.media.id });
      if (dedupeError) {
        if (dedupeError.code !== "23505") console.error("instagram-webhook: dedupe insert failed:", dedupeError.message);
        continue;
      }

      try {
        // With a Facebook Login (Page) token, DMs are sent through the Page, not the Instagram account.
        await send(`/${Deno.env.get("FACEBOOK_PAGE_ID") || igUserId}/messages`, {
          recipient: { comment_id: comment.id },
          message: { text: `Here is the apply link you asked for:\n${jobLink(siteUrl, post.job_id, post.hook_variant)}` },
        });
      } catch (error) {
        // Release the comment so Meta's retry of this delivery can send the DM.
        console.error(`instagram-webhook: DM for comment ${comment.id} failed:`, error);
        await supabase.from("instagram_comment_dms").delete().eq("comment_id", comment.id);
        failed = true;
        continue;
      }

      try {
        await send(`/${comment.id}/replies`, { message: "Sent! Check your DMs for the apply link 📩" });
      } catch (error) {
        console.warn(`instagram-webhook: public reply to ${comment.id} failed (DM was sent):`, error);
      }
    }
  }

  // A non-200 makes Meta redeliver, which retries only the comments released above.
  return new Response(failed ? "Retry" : "OK", { status: failed ? 500 : 200 });
});
