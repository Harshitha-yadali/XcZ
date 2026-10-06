// Renders the Reel for every queued Instagram job post and hands it to
// publish-instagram-posts. Run by .github/workflows/instagram-reels.yml.
//
// For each instagram_job_posts row in 'pending_render': build the Reel with
// Tesseract (videos/job-reel-tesseract/build.mjs) from the row's card text,
// upload the MP4 to the public instagram-reels bucket, and mark the row
// 'rendered'. Uses plain fetch so the workflow needs no npm install.
//
// Set ELEVENLABS_API_KEY to add a spoken voiceover; without it Reels are silent.
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildReel } from '../videos/job-reel-tesseract/build.mjs';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY } = process.env;
// "Anika - Sweet and Lively": an Indian-English social media voice.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'ecp3DWciuUyW7BYM7II1';
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

// The Tesseract CLI and FFmpeg run as child processes and inherit the
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

// Spoken version of the card. Returns the MP3 path, or null when no
// ELEVENLABS_API_KEY is set or the request fails: a Reel without a voice is
// better than no Reel.
async function voiceover(card, workDir) {
  if (!ELEVENLABS_API_KEY) return null;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `${card.company} is hiring: ${card.role}. Comment LINK, and we'll send you the apply link.`,
        model_id: 'eleven_multilingual_v2',
      }),
    });
    if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`);
    const file = path.join(workDir, 'voice.mp3');
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    return file;
  } catch (error) {
    console.warn('Voiceover failed, rendering a silent Reel:', error.message);
    return null;
  }
}

const VOICE_DELAY_SECONDS = 0.3;

async function renderReel(card) {
  const workDir = mkdtempSync(path.join(tmpdir(), 'job-reel-'));
  const { video } = buildReel(card, workDir);
  const output = path.join(workDir, 'instagram.mp4');
  const voice = await voiceover(card, workDir);

  // Instagram expects an AAC audio track and the moov atom at the front.
  if (voice) {
    // A long company or role can run past the 8-second card; hold the last
    // frame until the voice has finished.
    const probe = (file) => Number(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`).toString());
    const length = Math.max(probe(video), VOICE_DELAY_SECONDS + probe(voice) + 0.4);
    execSync(
      `ffmpeg -y -loglevel error -i "${video}" -i "${voice}" -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=${(length - probe(video)).toFixed(2)}[v];[1:a]adelay=${VOICE_DELAY_SECONDS * 1000}:all=1,apad[a]" -map "[v]" -map "[a]" -t ${length.toFixed(2)} -c:v libx264 -pix_fmt yuv420p -crf 18 -c:a aac -movflags +faststart "${output}"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(
      `ffmpeg -y -loglevel error -i "${video}" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -shortest -c:v copy -c:a aac -movflags +faststart "${output}"`,
      { stdio: 'inherit' },
    );
  }
  return readFileSync(output);
}

const posts = await (await api('/rest/v1/instagram_job_posts?status=eq.pending_render&select=id,job_id,card&order=scheduled_at&limit=10')).json();
console.log(`${posts.length} Reel(s) to render.`);

let failures = 0;
for (const post of posts) {
  try {
    const video = await renderReel(post.card);
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
