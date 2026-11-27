// Renders the Reel for every queued Instagram job post and hands it to
// publish-instagram-posts. Run by .github/workflows/instagram-reels.yml.
//
// For each instagram_job_posts row in 'pending_render': make the Reel
// (videos/job-reel-tesseract/make-reel.mjs: a walkthrough of the live job page
// with a voiceover), upload the MP4 to the public instagram-reels bucket, and
// mark the row 'rendered'. Uses plain fetch so the workflow needs no npm install.
//
// Set ELEVENLABS_API_KEY to add the voiceover; without it Reels are silent.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeReel } from '../videos/job-reel-tesseract/make-reel.mjs';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const SITE_URL = process.env.SITE_URL || 'https://primoboostai.in';
const voice = { apiKey: process.env.ELEVENLABS_API_KEY, voiceId: process.env.ELEVENLABS_VOICE_ID };
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// Chrome, the Tesseract CLI and FFmpeg run as child processes and inherit the
// environment; they have no business seeing these keys.
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.ELEVENLABS_API_KEY;

const BUCKET = 'instagram-reels';
const auth = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

async function api(urlPath, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${urlPath}`, { ...options, headers: { ...auth, ...options.headers } });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${urlPath} failed (${response.status}): ${await response.text()}`);
  return response;
}

const updatePost = (id, values) =>
  api(`/rest/v1/instagram_job_posts?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

const posts = await (await api('/rest/v1/instagram_job_posts?status=eq.pending_render&select=id,job_id,card&order=scheduled_at&limit=10')).json();
console.log(`${posts.length} Reel(s) to render.`);

let failures = 0;
for (const post of posts) {
  try {
    const workDir = mkdtempSync(path.join(tmpdir(), 'job-reel-'));
    const video = readFileSync(await makeReel(post.card, `${SITE_URL}/jobs/${post.job_id}`, workDir, voice));
    await api(`/storage/v1/object/${BUCKET}/${post.job_id}.mp4`, {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
      body: video,
    });
    await updatePost(post.id, {
      status: 'rendered',
      video_url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${post.job_id}.mp4`,
      error: null,
    });
    console.log(`Rendered Reel for job ${post.job_id}.`);
  } catch (error) {
    failures++;
    console.error(`Reel for job ${post.job_id} failed:`, error);
    await updatePost(post.id, { status: 'failed', error: `Render failed: ${error.message}`.slice(0, 1000) }).catch(console.error);
  }
}

process.exit(failures ? 1 : 0);
