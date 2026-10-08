import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { denied, getCaller } from "../_shared/auth.ts";
import { decryptSecret, siteOf } from "../_shared/vault.ts";
import { openPage, type Page } from "../_shared/cdp.ts";
import { answerKey, detectPlatform, runApplication, unsupportedReason, type ApplyResult, type Question } from "../_shared/applyForm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AutoApplyRequest {
  applicationId: string;
  /** Answers to the questions a previous call returned, keyed by question key. */
  answers?: Record<string, string>;
}

const RESUME_BUCKET = 'user-resumes';

// Never inferred, whatever the model says: these are personal facts, legal
// statements or consent, and only the user can answer them.
const USER_ONLY = /gender|\bsex\b|birth|\bdob\b|\bage\b|race|ethnic|disab|veteran|religio|caste|marital|salary|\bctc\b|compensation|visa|sponsor|authori[sz]|citizen|consent|agree|criminal|convict|hear about|source/i;

/**
 * Answers form questions from the tailored resume with one model call.
 * Returns {} on any failure, so the user is simply asked instead.
 */
async function inferAnswers(questions: Question[], resume: unknown, location: string): Promise<Record<string, string>> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY');
  const askable = questions.filter((question) => !USER_ONLY.test(question.label));
  if (!apiKey || !askable.length) return {};
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'google/gemini-3.5-flash-lite',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You fill job application form fields for a candidate. Answer a question ONLY when the resume states the fact or it follows directly from the resume (a degree abbreviation, graduation year, college, city or country of residence, total years or months of work experience, current company). When a question lists options, answer with exactly one of those options, copied character for character. If you are not sure, leave the question out. Never guess. Reply with one JSON object mapping each answered question key to its answer as a string.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              resume,
              location,
              questions: askable.map((question) => ({ key: question.key, label: question.label, options: question.options.slice(0, 300) })),
            }),
          },
        ],
      }),
    });
    if (!response.ok) return {};
    const text: string = (await response.json()).choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
    const allowed = new Set(askable.map((question) => question.key));
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([key, value]) => allowed.has(key) && typeof value === 'string' && value.trim())
        .map(([key, value]) => [key, String(value).slice(0, 500)]),
    );
  } catch (error) {
    console.error('Could not infer answers:', error);
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user } = await getCaller(req);
    if (!user) return denied("Sign in required.", 401, corsHeaders);

    const { applicationId, answers }: AutoApplyRequest = await req.json();

    // Everything is read from the caller's own rows: nothing in the body picks
    // whose data is used or which site the browser visits.
    const { data: application } = await supabase
      .from('auto_apply_applications')
      .select('id, application_url, resume_version_id, status')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!application) return denied("Application not found.", 404, corsHeaders);

    const platform = detectPlatform(application.application_url);
    const startTime = Date.now();

    const finish = async (result: ApplyResult) => {
      const submitted = result.status === 'submitted';
      const { error: updateError } = await supabase
        .from('auto_apply_applications')
        .update({
          platform,
          status: submitted ? 'submitted' : result.status === 'failed' ? 'failed' : 'paused',
          submission_time: submitted ? new Date().toISOString() : null,
          error_message: submitted ? null : result.message || null,
          paused_at_field: result.questions?.[0]?.label ?? null,
          form_data_captured: result.filled || {},
          time_taken_seconds: Math.floor((Date.now() - startTime) / 1000),
        })
        .eq('id', application.id)
        .eq('user_id', user.id);
      if (updateError) console.error('Error updating application status:', updateError);

      if (submitted || result.status === 'failed') await updateAnalytics(supabase, user.id, platform, submitted);

      return new Response(
        JSON.stringify({
          success: submitted,
          status: result.status,
          message: result.message,
          error: submitted ? undefined : result.message,
          questions: result.questions,
          site: result.status === 'needs_login' ? siteOf(application.application_url) : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    };
    const fail = (message: string) => finish({ status: 'failed', message });

    // A second click must never send a second application.
    if (application.status === 'submitted') {
      return new Response(
        JSON.stringify({ success: true, status: 'submitted', message: 'This application was already submitted.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const blocked = unsupportedReason(platform);
    if (blocked) return fail(blocked);

    const browserWs = Deno.env.get('BROWSER_WS');
    if (!browserWs) return fail('Auto-apply is not switched on yet. Please apply from the job link.');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email_address, phone, linkedin_profile_url, github_profile_url, current_location, apply_answers')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile) return fail('Your profile was not found.');

    const saved: Record<string, string> = { ...(profile.apply_answers || {}) };
    const given = Object.entries(answers || {}).slice(0, 100);
    if (given.length) {
      for (const [key, value] of given) saved[answerKey(key)] = String(value).slice(0, 2000);
      // Remembered, so the same question is not asked on the next job.
      await supabase.from('user_profiles').update({ apply_answers: saved }).eq('id', user.id);
    }

    const { data: resume } = await supabase
      .from('optimized_resumes')
      .select('pdf_url, resume_content')
      .eq('id', application.resume_version_id)
      .eq('user_id', user.id)
      .maybeSingle();
    // pdf_url is a path in the private resume bucket. It is written by the
    // client, so only accept a file in this user's own folder.
    const resumePath: string = resume?.pdf_url || '';
    if (!resumePath.startsWith(`${user.id}/`) || resumePath.includes('..')) {
      return fail('The tailored resume for this job was not found.');
    }
    const { data: resumeFile, error: resumeError } = await supabase.storage.from(RESUME_BUCKET).download(resumePath);
    if (resumeError || !resumeFile) return fail('The tailored resume for this job could not be read.');

    // The login the user saved for this job site, if any. A value that no
    // longer decrypts is treated as missing, so the user is asked again.
    let login: { username: string; password: string } | null = null;
    const credentialsKey = Deno.env.get('CREDENTIALS_KEY');
    if (credentialsKey) {
      const { data: stored } = await supabase
        .from('user_credentials_vault')
        .select('username, password_encrypted')
        .eq('user_id', user.id)
        .eq('platform', siteOf(application.application_url))
        .maybeSingle();
      if (stored?.username && stored.password_encrypted) {
        try {
          login = { username: stored.username, password: await decryptSecret(stored.password_encrypted, credentialsKey) };
        } catch {
          login = null;
        }
      }
    }

    const fullName = profile.full_name || '';
    const content = resume?.resume_content || {};
    const education = Array.isArray(content.education) ? content.education[0] : null;
    // Whole skill names only, short enough for a typical 100-character box.
    const skills: string[] = [];
    for (const name of (Array.isArray(content.skills) ? content.skills : []).flatMap((group: any) => group?.list || [])) {
      if ([...skills, name].join(', ').length > 100) break;
      skills.push(String(name));
    }
    let page: Page | null = null;
    let result: ApplyResult;
    try {
      page = await openPage(browserWs);
      result = await runApplication(page, {
        url: application.application_url,
        profile: {
          fullName,
          email: profile.email_address || user.email || '',
          phone: profile.phone || '',
          linkedin: profile.linkedin_profile_url || '',
          github: profile.github_profile_url || '',
          location: profile.current_location || content.location || '',
          college: education?.school || '',
          degree: education?.degree || '',
          graduationYear: (String(education?.year || '').match(/\d{4}/g) || []).pop() || '',
          skills: skills.join(', '),
        },
        saved,
        resume: {
          name: `${fullName.replace(/[^A-Za-z0-9]+/g, '_') || 'Resume'}_Resume.pdf`,
          base64: encodeBase64(new Uint8Array(await resumeFile.arrayBuffer())),
        },
        submit: true,
        login,
        infer: (questions) => inferAnswers(questions, content, profile.current_location || content.location || ''),
      });
    } catch (error: any) {
      console.error('Browser session failed:', error);
      result = { status: 'failed', message: 'The browser session failed before the application was sent. Please try again.' };
    } finally {
      page?.close();
    }

    return finish(result);
  } catch (error: any) {
    console.error('Error in auto-apply:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function updateAnalytics(supabase: any, userId: string, platform: string, success: boolean) {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('auto_apply_analytics')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('auto_apply_analytics')
      .update({
        total_applications: existing.total_applications + 1,
        successful_applications: success
          ? existing.successful_applications + 1
          : existing.successful_applications,
        failed_applications: !success
          ? existing.failed_applications + 1
          : existing.failed_applications,
        platforms_used: {
          ...existing.platforms_used,
          [platform]: (existing.platforms_used[platform] || 0) + 1,
        },
      })
      .eq('id', existing.id);

    if (error) console.error('Error updating analytics:', error);
  } else {
    const { error } = await supabase.from('auto_apply_analytics').insert({
      user_id: userId,
      date: today,
      total_applications: 1,
      successful_applications: success ? 1 : 0,
      failed_applications: success ? 0 : 1,
      platforms_used: { [platform]: 1 },
    });

    if (error) console.error('Error creating analytics:', error);
  }
}
