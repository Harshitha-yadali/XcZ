import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { scoreResumeAgainstJD } from "../../../src/services/jdScoringEngine.ts";
import { normalizeCanonicalResume } from "../../../src/services/canonicalResumeNormalizer.ts";
import type { ResumeData, UserType } from "../../../src/types/canonicalResume.ts";

const SCORING_VERSION = 'pb-jd-v2.0.0';
const allowedContexts = new Set([
  'quick_scan', 'smart_before', 'smart_after', 'deep_before', 'deep_after', 'resume_score_checker',
]);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function normalizeForHash(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(normalizeForHash);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeForHash(item)]),
    );
  }
  return value;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hasEvidenceForAwardedParameters(value: unknown): boolean {
  const result = value as { parameters?: Array<{ score?: unknown; evidence?: unknown }> } | null;
  return Boolean(
    result &&
    Array.isArray(result.parameters) &&
    result.parameters.every(parameter =>
      typeof parameter.score === 'number' &&
      (parameter.score <= 0 || (Array.isArray(parameter.evidence) && parameter.evidence.length > 0))
    )
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return jsonResponse({ error: 'Authentication required' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) throw new Error('Scoring backend is not configured.');
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) return jsonResponse({ error: 'Invalid user token' }, 401);

    const body = await req.json() as {
      resumeData?: unknown;
      jobDescription?: string;
      candidateType?: UserType;
      scoringVersion?: string;
      context?: string;
      runId?: string;
    };
    if (!body.resumeData || typeof body.jobDescription !== 'string' || body.jobDescription.trim().length < 20) {
      return jsonResponse({ error: 'Resume data and a valid job description are required.' }, 400);
    }
    if (!['fresher', 'experienced', 'student'].includes(body.candidateType || '')) {
      return jsonResponse({ error: 'Invalid candidate type.' }, 400);
    }
    if (body.scoringVersion !== SCORING_VERSION) {
      return jsonResponse({ error: 'Unsupported scoring version.' }, 409);
    }
    if (!body.context || !allowedContexts.has(body.context)) {
      return jsonResponse({ error: 'Invalid scoring context.' }, 400);
    }

    const resumeData: ResumeData = normalizeCanonicalResume(body.resumeData);

    const canonicalResume = JSON.stringify(normalizeForHash(resumeData));
    const canonicalJd = String(normalizeForHash(body.jobDescription));
    const resumeHash = await sha256(canonicalResume);
    const jdHash = await sha256(canonicalJd);
    const inputHash = await sha256(`${resumeHash}|${jdHash}|${body.candidateType}|${SCORING_VERSION}`);

    const { data: cached, error: cacheError } = await admin
      .from('canonical_jd_scores')
      .select('id, score_result')
      .eq('input_hash', inputHash)
      .eq('scoring_version', SCORING_VERSION)
      .maybeSingle();
    if (cacheError) throw cacheError;

    let scoreId = cached?.id as string | undefined;
    let scoreResult = cached?.score_result;
    let cacheHit = Boolean(cached);

    if (scoreResult && !hasEvidenceForAwardedParameters(scoreResult)) {
      const repairedScore = scoreResumeAgainstJD(resumeData, body.jobDescription, body.candidateType as UserType);
      const { data: repaired, error: repairError } = await admin
        .from('canonical_jd_scores')
        .update({
          overall_score: repairedScore.overallScore,
          score_result: repairedScore,
          created_by: user.id,
        })
        .eq('id', scoreId)
        .select('id, score_result')
        .single();
      if (repairError) throw repairError;
      scoreId = repaired.id;
      scoreResult = repaired.score_result;
      cacheHit = false;
    } else if (!scoreResult) {
      // This shared deterministic rules engine is the only code allowed to
      // produce the official JD Match number. No AI-generated score is accepted.
      scoreResult = scoreResumeAgainstJD(resumeData, body.jobDescription, body.candidateType as UserType);
      const { data: inserted, error: insertError } = await admin
        .from('canonical_jd_scores')
        .upsert({
          input_hash: inputHash,
          resume_hash: resumeHash,
          job_description_hash: jdHash,
          candidate_type: body.candidateType,
          scoring_version: SCORING_VERSION,
          overall_score: scoreResult.overallScore,
          score_result: scoreResult,
          created_by: user.id,
        }, { onConflict: 'input_hash,scoring_version', ignoreDuplicates: true })
        .select('id, score_result')
        .maybeSingle();
      if (insertError) throw insertError;

      if (inserted) {
        scoreId = inserted.id;
        scoreResult = inserted.score_result;
      } else {
        const { data: raced, error: racedError } = await admin
          .from('canonical_jd_scores')
          .select('id, score_result')
          .eq('input_hash', inputHash)
          .eq('scoring_version', SCORING_VERSION)
          .single();
        if (racedError) throw racedError;
        scoreId = raced.id;
        scoreResult = raced.score_result;
        cacheHit = true;
      }
    }

    if (!hasEvidenceForAwardedParameters(scoreResult)) {
      throw new Error('Canonical scoring produced an evidence-invalid result.');
    }

    const { error: historyError } = await admin.from('canonical_jd_score_history').insert({
      user_id: user.id,
      score_id: scoreId,
      context: body.context,
      run_id: body.runId || null,
      cache_hit: cacheHit,
    });
    if (historyError) throw historyError;

    return jsonResponse({
      scoreResult,
      scoreId,
      inputHash,
      scoringVersion: SCORING_VERSION,
      cacheHit,
    });
  } catch (error) {
    console.error('canonical-jd-score failed:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Scoring failed' }, 500);
  }
});
