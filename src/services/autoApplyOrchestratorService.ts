import { supabase } from '../lib/supabaseClient';
import { ResumeData } from '../types/resume';
import {
  aiProjectSuggestionService,
  ProjectSuggestion,
} from './aiProjectSuggestionService';
import { optimizeResume } from './geminiService';
import { GEMINI_3_5_FLASH_LITE_MODEL } from './openrouterModelConfig';
import { runOptimizationLoop } from './optimizationLoopController';
import { paymentService } from './paymentService';
import { JD_OPTIMIZATION_TIERS } from '../config/jdOptimizationTiers';

// Auto Apply tailors with the Quick Scan plan: its model for the rewrite, then
// its scored refinement pass, which also gives the real match score.
const QUICK_TIER = JD_OPTIMIZATION_TIERS.find((tier) => tier.id === 'quick')!;
import { exportToPDFBlob } from '../utils/exportUtils';
import { findUnsupportedClaims } from '../utils/resumeFactCheck';
import { SUPABASE_ANON_KEY, fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';
import { applicantFrom } from '../../supabase/functions/_shared/applicant';
import { missingProfileFields } from './profileCompleteness';

// Private bucket that already holds users' uploaded resumes.
const RESUME_BUCKET = 'user-resumes';

export interface AutoApplyStatus {
  step: 'analyzing' | 'suggesting_projects' | 'optimizing' | 'generating_pdf' | 'submitting' | 'completed' | 'failed';
  progress: number;
  message: string;
  currentAction?: string;
}

/** On once mail to the agents' own addresses is delivered. Set with APPLY_MAIL on the worker. */
export const APPLY_MAIL = import.meta.env.VITE_APPLY_MAIL === 'true';

/**
 * The profile as a resume, untouched: the "before" of the score and the
 * evidence the rewrite is checked against, as on the optimizer page.
 * Null when the profile has no experience, projects or skills.
 */
export function profileResumeData(profile: any): ResumeData | null {
  if (!profileResumeText(profile)) return null;
  const list = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  return {
    name: profile.full_name || '', email: profile.email_address || '', phone: profile.phone || '',
    linkedin: profile.linkedin_profile_url || '', github: profile.github_profile_url || '', location: profile.current_location || '',
    summary: profile.resume_headline || '', careerObjective: profile.resume_headline || '',
    workExperience: list(profile.experience_details).map((e) => ({ role: e.role || '', company: e.company || '', year: e.year || '', bullets: e.bullets || [] })),
    projects: list(profile.projects_details).map((p) => ({ title: p.title || '', bullets: p.bullets || [] })),
    skills: list(profile.skills_details).map((s) => ({ category: s.category || '', count: (s.list || []).length, list: s.list || [] })),
    education: list(profile.education_details).map((e) => ({ degree: e.degree || '', school: e.school || '', year: e.year || '', cgpa: e.cgpa || '', location: e.location || '' })),
    certifications: list(profile.certifications_details).map((c) => ({ title: c.title || '', description: c.description || '' })),
  } as unknown as ResumeData;
}

/** The profile's own resume sections as plain text; '' when it has no experience, projects or skills. */
export function profileResumeText(profile: any): string {
  if (!profile) return '';
  const list = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const lines = (items: string[]) => items.map((item) => `• ${String(item).trim()}`).join('\n');
  const experience = list(profile.experience_details).filter((e) => e?.role || e?.company);
  const projects = list(profile.projects_details).filter((p) => p?.title);
  const skills = list(profile.skills_details).filter((s) => (s?.list || []).length);
  if (!experience.length && !projects.length && !skills.length) return '';

  const sections = [
    [profile.full_name, [profile.email_address, profile.phone, profile.current_location].filter(Boolean).join(' | '),
      [profile.linkedin_profile_url, profile.github_profile_url].filter(Boolean).join(' | ')].filter(Boolean).join('\n'),
    profile.resume_headline && `SUMMARY\n${profile.resume_headline}`,
    experience.length && `WORK EXPERIENCE\n${experience.map((e) =>
      `${[e.role, e.company].filter(Boolean).join(' | ')}${e.year ? ` (${e.year})` : ''}\n${lines(e.bullets || [])}`).join('\n\n')}`,
    projects.length && `PROJECTS\n${projects.map((p) => `${p.title}\n${lines(p.bullets || [])}`).join('\n\n')}`,
    skills.length && `SKILLS\n${skills.map((s) => `${s.category ? `${s.category}: ` : ''}${s.list.join(', ')}`).join('\n')}`,
    list(profile.education_details).length && `EDUCATION\n${list(profile.education_details).map((e) =>
      [e.degree, e.school, e.year, e.cgpa && `CGPA ${e.cgpa}`, e.location].filter(Boolean).join(' | ')).join('\n')}`,
    list(profile.certifications_details).length && `CERTIFICATIONS\n${lines(list(profile.certifications_details).map((c) =>
      [c.title, c.description].filter(Boolean).join(': ')))}`,
  ];
  return sections.filter(Boolean).join('\n\n');
}

/** The user's agreement to be applied for, and the address companies are given. */
export interface ApplyAgent { address: string; active: boolean; agreed_at: string }

/** A message a company sent to that address. */
export interface ApplyMail {
  id: string;
  application_id: string | null;
  from_address: string;
  subject: string;
  body: string;
  kind: 'code' | 'confirmed' | 'interview' | 'rejected' | 'other';
  received_at: string;
}

/** A form field the employer requires that the profile could not answer. */
export interface ApplyQuestion {
  key: string;
  label: string;
  type: 'text' | 'date' | 'textarea' | 'select' | 'radio' | 'checks' | 'checkbox' | 'combobox' | 'file';
  options: string[];
  required?: boolean;
}

export interface AutoApplyResult {
  success: boolean;
  /** Set with error 'INPUT_REQUIRED': answer these, then call submitApplication again. */
  questions?: ApplyQuestion[];
  applicationId?: string;
  resumeId?: string;
  matchScore?: number;
  error?: string;
  pdfUrl?: string;
  /** When the form cannot be sent, hand over the tailored resume instead of reporting a failure. */
  manualFallback?: boolean;
  /** With error 'MANUAL_APPLY': why the form was not sent, in words for the user. */
  manualReason?: string;
  /** With error 'LOGIN_REQUIRED': the job site that needs the user's sign-in, and why. */
  loginSite?: string;
  loginMessage?: string;
  /** Facts in the tailored resume that the user's original resume does not state. */
  resumeFlags?: string[];
  /** Answers that authorise this application alone and are never remembered. */
  reviewedAnswers?: Record<string, string>;
  /** With error 'SUBMISSION_UNCERTAIN': why the outcome is not known. */
  uncertainMessage?: string;
}

class AutoApplyOrchestratorService {
  private statusCallbacks: Map<string, (status: AutoApplyStatus) => void> = new Map();

  registerStatusCallback(jobId: string, callback: (status: AutoApplyStatus) => void) {
    this.statusCallbacks.set(jobId, callback);
  }

  unregisterStatusCallback(jobId: string) {
    this.statusCallbacks.delete(jobId);
  }

  private updateStatus(jobId: string, status: AutoApplyStatus) {
    const callback = this.statusCallbacks.get(jobId);
    if (callback) {
      callback(status);
    }
  }

  async startAutoApply(
    jobId: string,
    jobDescription: string,
    companyName: string,
    roleTitle: string,
    applicationUrl: string
  ): Promise<AutoApplyResult> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const userId = user.id;

      this.updateStatus(jobId, {
        step: 'analyzing',
        progress: 10,
        message: 'Reading your resume...',
        currentAction: 'Loading your saved resume',
      });

      const userResume = (await this.getApplicant(userId)).resume_text;
      if (!userResume) {
        throw new Error('Please upload your resume first');
      }

      // One live application per job: report the one that exists, never start a second.
      const live = await this.findLiveApplication(userId, jobId);
      if (live) return this.resumeLiveApplication(live);

      // Before the tailoring, which is the part that costs.
      this.updateStatus(jobId, {
        step: 'analyzing',
        progress: 20,
        message: 'Checking the job is still open...',
        currentAction: 'Looking at the job',
      });
      const check = await this.checkJob(jobId);
      if (check.twin) return this.resumeLiveApplication(check.twin);
      if (check.closed) return { success: false, error: 'JOB_CLOSED' };

      // ponytail: no match-score gate or project suggestions before applying.
      // That step called a scoring method that never existed; wire it to the
      // real JD scorer if the "add a project first" prompt is wanted back.
      return await this.continueAutoApply(
        userId,
        jobId,
        userResume,
        0,
        applicationUrl,
        companyName,
        roleTitle,
        null,
        jobDescription
      );
    } catch (error: any) {
      console.error('Error in auto-apply:', error);
      this.updateStatus(jobId, {
        step: 'failed',
        progress: 0,
        message: 'Application failed',
        currentAction: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  async continueAutoApply(
    userId: string,
    jobId: string,
    resumeText: string,
    matchScore: number,
    applicationUrl: string,
    companyName: string,
    roleTitle: string,
    selectedProject: ProjectSuggestion | null,
    jobDescription = ''
  ): Promise<AutoApplyResult> {
    // One Quick Scan credit per application: reserved before the paid rewrite,
    // kept once the application is queued, given back if anything fails first.
    // After that the worker gives it back if the employer's side fails the run.
    let reservationId: string | null = null;
    let charged = false;
    try {
      const applicant = await this.getApplicant(userId);
      const runId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `auto-apply-${jobId}-${Date.now()}`;
      const reservation = await paymentService.reserveOptimization(userId, 'quick', runId);
      if (!reservation.success || !reservation.reservationId) {
        // A failed call is a real error; anything else means the user is out of Quick credits.
        if (reservation.error?.startsWith('Unable to reserve')) throw new Error(reservation.error);
        throw new Error('NO_CREDITS');
      }
      reservationId = reservation.reservationId;
      // The project-selection step does not carry the resume text along.
      resumeText = resumeText || applicant.resume_text;
      if (!resumeText) {
        throw new Error('Please upload your resume first');
      }
      let finalResumeText = resumeText;

      if (selectedProject) {
        this.updateStatus(jobId, {
          step: 'optimizing',
          progress: 50,
          message: 'Injecting selected project into resume...',
          currentAction: 'Optimizing resume structure',
        });

        finalResumeText = aiProjectSuggestionService.injectProjectIntoResume(
          resumeText,
          selectedProject,
          selectedProject.selectionType === 'replace' ? 'replace' : 'add'
        );
      }

      this.updateStatus(jobId, {
        step: 'generating_pdf',
        progress: 70,
        message: 'Tailoring your resume to this job...',
        currentAction: 'Creating PDF document',
      });

      // ponytail: fixed 'fresher' layout; use the user's own type when known.
      const jd = jobDescription || `${roleTitle} at ${companyName}`;
      const firstPass = (model: string) => optimizeResume(
        finalResumeText,
        jd,
        'fresher',
        applicant.full_name || undefined,
        undefined,
        applicant.email_address || undefined,
        applicant.phone || undefined,
        applicant.linkedin_profile_url || undefined,
        applicant.github_profile_url || undefined,
        undefined,
        undefined,
        roleTitle,
        undefined,
        undefined,
        model,
        QUICK_TIER.mode
      );
      // Same fallback as the optimizer page's Quick: one retry on Flash Lite.
      let resumeData = await firstPass(QUICK_TIER.modelId).catch((error) => {
        console.warn('Quick first pass failed, retrying on Flash Lite:', error);
        return firstPass(GEMINI_3_5_FLASH_LITE_MODEL);
      });
      try {
        const loop = await runOptimizationLoop(resumeData, jd, undefined, profileResumeData(applicant) ?? undefined, {
          maxLoops: Math.max(0, QUICK_TIER.aiPasses - 1),
          modelSequence: QUICK_TIER.refinementModels,
          candidateType: 'fresher',
          optimizationTier: 'quick',
        });
        resumeData = loop.optimizedResume;
        matchScore = Math.round(loop.afterScore.overallScore || 0);
      } catch (error) {
        // The rewrite is already usable; only the refinement and score are lost.
        console.warn('Quick refinement pass failed, using the first pass:', error);
      }
      // Tailoring may reword, never invent: anything the original does not
      // state is shown to the user on the review screen before it is sent.
      const resumeFlags = findUnsupportedClaims(resumeText, resumeData);
      const pdfBlob = await exportToPDFBlob(resumeData, 'fresher');
      const pdfPath = await this.uploadResumePDF(userId, jobId, pdfBlob);
      const resumeId = await this.saveOptimizedResume(userId, jobId, resumeData, pdfPath, matchScore);
      // The bucket is private, so the "view resume" link is a short-lived signed URL.
      const { data: signed } = await supabase.storage.from(RESUME_BUCKET).createSignedUrl(pdfPath, 3600);
      const pdfUrl = signed?.signedUrl;

      if (selectedProject) {
        await aiProjectSuggestionService.saveProjectSuggestions(
          userId,
          jobId,
          resumeId,
          [selectedProject]
        );
      }

      const platform = this.detectPlatform(applicationUrl);

      // The form is filled by a worker, not here. An application of several
      // pages takes longer than this page is likely to stay open, and longer
      // than an edge function is allowed to run, so it is queued and the user
      // is free to leave. My Auto Applications follows it from here.
      const { applicationId, status: queuedAs } = await this.queueApplication(jobId, resumeId, reservationId);
      const finalized = await paymentService.finalizeCreditReservation(reservationId);
      if (!finalized.success) console.error('Quick credit could not be finalized:', finalized.error);
      charged = true;

      // Smart Apply: a site the runner does not finish. The tailored resume is
      // the product here; the user applies with it on the site.
      if (queuedAs === 'needs_manual_action') {
        return {
          success: false,
          error: 'MANUAL_APPLY',
          manualReason: `${companyName || 'This company'}'s site needs you to submit the application yourself (it uses a sign-in, captcha or its own portal).`,
          applicationId,
          resumeId,
          matchScore,
          pdfUrl,
          resumeFlags,
        };
      }

      this.updateStatus(jobId, {
        step: 'submitting',
        progress: 100,
        message: 'Applying in the background',
        currentAction: 'You can close this page; we will carry on.',
      });

      return {
        success: false,
        error: 'QUEUED',
        message: 'We are applying for you. You can close this page.',
        // Every site goes through the same engine. Greenhouse and Lever are
        // the tested ones; anywhere else, a form that cannot be sent hands
        // the user the tailored resume to finish there.
        manualFallback: platform !== 'greenhouse' && platform !== 'lever',
        applicationId,
        resumeId,
        matchScore,
        pdfUrl,
        resumeFlags,
      };
    } catch (error: any) {
      console.error('Error continuing auto-apply:', error);
      if (reservationId && !charged) {
        const refund = await paymentService.refundCreditReservation(reservationId);
        if (!refund.success) console.error('Quick credit could not be given back:', refund.error);
      }
      this.updateStatus(jobId, {
        step: 'failed',
        progress: 0,
        message: 'Application failed',
        currentAction: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Sends the application through the employer's form. Reports success only
   * when the employer's site confirmed it; if the form needs answers the
   * profile lacks, returns them as questions instead.
   */
  async submitApplication(
    jobId: string,
    pending: AutoApplyResult,
    answers?: Record<string, string>
  ): Promise<AutoApplyResult> {
    try {
      // Auto Apply applies as the user, so there is no separate approval step:
      // the form is sent as soon as nothing is missing. The engine still stops
      // before the Submit button whenever it needs something, so a question the
      // resume cannot answer comes back as `needs_input`, and a sign-in wall as
      // `needs_login`. The run holds there until the user supplies it.
      this.updateStatus(jobId, {
        step: 'submitting', progress: 90, message: 'Applying...', currentAction: 'Sending your application',
      });

      // A tick against one employer's declaration authorises that application
      // and nothing else, so it must not be remembered as an answer: the next
      // employer's similarly worded box would then be ticked unasked. Answers
      // to checkbox questions travel in `reviewed`, which the server applies to
      // this run only; everything else is saved and reused as before.
      const perApplication = new Set(
        (pending.questions || []).filter((question) => question.type === 'checkbox').map((question) => question.key)
      );
      const remembered: Record<string, string> = {};
      const thisRunOnly: Record<string, string> = { ...(pending.reviewedAnswers || {}) };
      for (const [key, value] of Object.entries(answers || {})) {
        (perApplication.has(key) ? thisRunOnly : remembered)[key] = value;
      }

      const outcome = await this.triggerFormSubmission(pending.applicationId!, {
        answers: Object.keys(remembered).length ? remembered : undefined,
        mode: 'submit',
        reviewed: Object.keys(thisRunOnly).length ? thisRunOnly : undefined,
      });

      if (outcome.status === 'needs_input') {
        return { ...pending, success: false, error: 'INPUT_REQUIRED', questions: outcome.questions || [] };
      }
      // Checked before any fallback: an uncertain submission must not be
      // offered as "finish it yourself", which would invite a second one.
      if (outcome.status === 'uncertain') {
        return {
          ...pending,
          success: false,
          error: 'SUBMISSION_UNCERTAIN',
          uncertainMessage: outcome.message,
          questions: undefined,
        };
      }
      if (outcome.status === 'needs_login') {
        return {
          ...pending,
          success: false,
          error: 'LOGIN_REQUIRED',
          loginSite: outcome.site,
          loginMessage: outcome.message,
          questions: undefined,
        };
      }
      if (!outcome.success && pending.manualFallback) {
        return {
          ...pending,
          success: false,
          error: 'MANUAL_APPLY',
          manualReason: outcome.error || outcome.message,
          questions: undefined,
        };
      }
      if (!outcome.success) {
        throw new Error(outcome.error || outcome.message || 'The application was not submitted.');
      }

      this.updateStatus(jobId, {
        step: 'completed',
        progress: 100,
        message: 'Application submitted successfully!',
        currentAction: 'Done',
      });
      return { ...pending, success: true, error: undefined, questions: undefined };
    } catch (error: any) {
      console.error('Error submitting application:', error);
      this.updateStatus(jobId, {
        step: 'failed',
        progress: 0,
        message: 'Application failed',
        currentAction: error.message,
      });
      return { ...pending, success: false, error: error.message, questions: undefined };
    }
  }

  /** The user's application for this job that still holds the duplicate lock, if any. */
  private async findLiveApplication(userId: string, jobId: string) {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select('id, status')
      .eq('user_id', userId)
      .eq('job_listing_id', jobId)
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; status: string } | null;
  }

  /**
   * Asks whether this job is closed, or already in hand under another listing.
   * A check that fails stops nothing: the job goes on to the form, as it would
   * have anyway, and the queue makes the duplicate check again.
   */
  private async checkJob(jobId: string): Promise<{ closed?: boolean; twin?: { id: string; status: string } | null }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('auto-apply-check'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ jobId }),
      });
      return response.ok ? await response.json() : {};
    } catch {
      return {};
    }
  }

  /**
   * Says how far the application already held for this job has got. Nothing is
   * started from here: it belongs to a worker or is waiting on the user, and
   * running it from this page as well is how one job reached an employer twice.
   */
  private resumeLiveApplication(live: { id: string; status: string }): AutoApplyResult {
    if (live.status === 'submitted') {
      return { success: true, applicationId: live.id };
    }
    if (live.status === 'submitting' || live.status === 'submission_uncertain') {
      return { success: false, applicationId: live.id, error: 'SUBMISSION_UNCERTAIN' };
    }
    return { success: false, applicationId: live.id, error: 'ALREADY_IN_HAND' };
  }

  /**
   * Saves the user's own login for one sign-in address, the `loginSite` a
   * LOGIN_REQUIRED result names. The password is encrypted on the server.
   */
  async saveSiteLogin(site: string, username: string, password: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('save-site-credentials'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ site, username, password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'The login could not be saved. Please try again.');
    }
  }

  private async getApplicant(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, email_address, phone, linkedin_profile_url, github_profile_url, current_location, resume_headline, education_details, experience_details, projects_details, skills_details, certifications_details')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;

    // The profile is what the user keeps up to date, so the resume is built
    // from it. The older uploaded text (saved with the job preferences) is only
    // a fallback, and only when it carries the user's own name: one account
    // held someone else's resume there, and applications went out with that
    // person's history under the user's name.
    let resumeText = profileResumeText(data);
    if (!resumeText) {
      const { data: preferences, error: preferencesError } = await supabase
        .from('user_job_preferences')
        .select('resume_text')
        .eq('user_id', userId)
        .maybeSingle();
      if (preferencesError) throw preferencesError;
      const uploaded = preferences?.resume_text || '';
      const firstName = (data?.full_name || '').trim().split(/\s+/)[0]?.toLowerCase();
      if (uploaded && firstName && !uploaded.toLowerCase().includes(firstName)) {
        throw new Error('Your saved resume has a different name on it. Please fill in your profile or upload your own resume again.');
      }
      resumeText = uploaded;
    }

    return {
      full_name: '', email_address: '', phone: '', linkedin_profile_url: '', github_profile_url: '',
      ...data,
      resume_text: resumeText,
    };
  }

  private async uploadResumePDF(
    userId: string,
    jobId: string,
    pdfBlob: Blob
  ): Promise<string> {
    // The bucket only lets a user write inside the folder named after their id.
    const fileName = `${userId}/auto-apply/${jobId}_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from(RESUME_BUCKET)
      .upload(fileName, pdfBlob, { contentType: 'application/pdf' });

    if (error) throw error;
    return data.path;
  }

  /** Saves the tailored resume; pdf_url holds its path in the private resume bucket. */
  private async saveOptimizedResume(
    userId: string,
    jobListingId: string,
    resumeData: ResumeData,
    pdfPath: string,
    matchScore = 0
  ): Promise<string> {
    const { data, error } = await supabase
      .from('optimized_resumes')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        resume_content: resumeData,
        pdf_url: pdfPath,
        optimization_score: matchScore || null,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private detectPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('naukri.com')) return 'naukri';
    if (lowerUrl.includes('indeed.com')) return 'indeed';
    if (lowerUrl.includes('workday.com')) return 'workday';
    if (lowerUrl.includes('greenhouse.io')) return 'greenhouse';
    if (lowerUrl.includes('lever.co')) return 'lever';
    if (lowerUrl.includes('myworkdayjobs.com')) return 'workday';
    return 'other';
  }

  /**
   * Hands the application to the background worker and returns at once, so the
   * user can close the site while it runs. The worker has no time limit of its
   * own, which is what an application of several pages needs: the same work
   * inside an edge function is cut off part way through.
   *
   * Pressing Auto Apply again on a job already in hand returns that same
   * application rather than starting a second one.
   */
  async queueApplication(jobId: string, resumeVersionId?: string, reservationId?: string): Promise<{ applicationId: string; status: string; queued: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('auto-apply-queue'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ jobId, resumeVersionId, reservationId }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'This application could not be queued.');
    return { applicationId: result.applicationId, status: result.status, queued: Boolean(result.queued) };
  }

  /**
   * The user has answered what a paused application was waiting for, so it goes
   * back on the queue. Answers to ordinary questions are remembered on the
   * profile, so the same one is not asked on the next job; an answer to a
   * checkbox is not, because a tick against one employer's declaration
   * authorises that application and nothing else.
   */
  async resumeWithAnswers(applicationId: string, answers: Record<string, string>, questions: ApplyQuestion[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const perApplication = new Set(questions.filter((question) => question.type === 'checkbox').map((question) => question.key));
    const remembered: Record<string, string> = {};
    const thisOneOnly: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
      (perApplication.has(key) ? thisOneOnly : remembered)[key] = value;
    }

    if (Object.keys(remembered).length) {
      const { data: profile } = await supabase
        .from('user_profiles').select('apply_answers').eq('id', user.id).maybeSingle();
      await supabase.from('user_profiles')
        .update({ apply_answers: { ...(profile?.apply_answers || {}), ...remembered } })
        .eq('id', user.id);
    }

    // On top of what was given earlier: a form with a declaration on each of two
    // pages would otherwise forget the first tick when the second is answered.
    const { data: application } = await supabase
      .from('auto_apply_applications').select('given_answers').eq('id', applicationId).maybeSingle();
    await this.requeue(applicationId, {
      given_answers: { ...(application?.given_answers || {}), ...remembered, ...thisOneOnly },
    });
  }

  /** The user has saved the login a paused application was waiting for. */
  async resumeAfterLogin(applicationId: string, site: string, username: string, password: string): Promise<void> {
    await this.saveSiteLogin(site, username, password);
    await this.requeue(applicationId, {});
  }

  /**
   * Puts a paused application back in the queue for a worker to pick up. Only
   * one still paused: a page left open can offer an answer to an application
   * that has since moved on, and sending that one back would send it twice.
   */
  private async requeue(applicationId: string, extra: Record<string, unknown>): Promise<void> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .update({ status: 'queued', pending_questions: [], login_site: null, error_message: null, ...extra })
      .eq('id', applicationId)
      .in('status', ['needs_input', 'needs_login'])
      .select('id');
    if (error) throw new Error('This application could not be restarted. Please try again.');
    if (!data?.length) throw new Error('This application has already moved on, so nothing was changed.');
  }

  /**
   * Gives the browser extension what it needs to fill one form in the user's own
   * Chrome: their details for this application, and nothing that signs them in.
   * Google lets no server sign in for a user, so a form behind a Google sign-in
   * can only be filled there. Without the extension this message goes nowhere,
   * and the form simply opens for them to fill in.
   */
  async prepareInBrowser(application: {
    user_id: string;
    resume_version_id?: string | null;
    given_answers?: Record<string, string> | null;
    job_listings: { company_name: string; role_title: string };
    optimized_resumes?: { pdf_url: string } | null;
  }): Promise<void> {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, email_address, phone, linkedin_profile_url, github_profile_url, current_location, apply_answers')
      .eq('id', application.user_id)
      .maybeSingle();
    const { data: resume } = await supabase
      .from('optimized_resumes')
      .select('resume_content')
      .eq('id', application.resume_version_id ?? '')
      .maybeSingle();
    window.postMessage({
      source: 'primoboost-site',
      type: 'prepare',
      prepared: {
        role: application.job_listings.role_title,
        company: application.job_listings.company_name,
        profile: applicantFrom(profile, resume?.resume_content),
        saved: { ...(profile?.apply_answers || {}), ...(application.given_answers || {}) },
        resumeUrl: application.optimized_resumes?.pdf_url,
      },
    }, window.location.origin);
  }

  /** Every remembered answer, including the "@" ones given at turn-on. */
  async getApplyAnswers(): Promise<Record<string, string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');
    const { data } = await supabase.from('user_profiles').select('apply_answers').eq('id', user.id).maybeSingle();
    return data?.apply_answers || {};
  }

  /**
   * Saves the answers to the common questions. Only "@" keys are touched: a
   * blank one is removed, so the next form asks rather than reusing it. Answers
   * remembered from real forms are kept as they are.
   */
  async saveApplyTopics(values: Record<string, string>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');
    const next = { ...(await this.getApplyAnswers()) };
    for (const [key, value] of Object.entries(values)) {
      if (!key.startsWith('@')) continue;
      const clean = value.trim().slice(0, 200);
      if (clean) next[key] = clean;
      else delete next[key];
    }
    const { error } = await supabase.from('user_profiles').update({ apply_answers: next }).eq('id', user.id);
    if (error) throw new Error('Your answers could not be saved. Please try again.');
  }

  /** Where employer mail to the job address is forwarded; '' means the account email. */
  async getJobMailTo(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';
    const { data } = await supabase.from('user_profiles').select('job_mail_to').eq('id', user.id).maybeSingle();
    return data?.job_mail_to || '';
  }

  async setJobMailTo(email: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');
    const clean = email.trim().toLowerCase();
    if (clean && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(clean)) throw new Error('Please enter a valid email address.');
    const { error } = await supabase.from('user_profiles').update({ job_mail_to: clean || null }).eq('id', user.id);
    if (error) throw new Error('Your forwarding email could not be saved. Please try again.');
  }

  /** Profile fields a job form needs that the user has not filled; [] when ready. */
  async getMissingProfileFields(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('full_name, email_address, phone, current_location, education_details')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return missingProfileFields(data);
  }

  async getAgent(): Promise<ApplyAgent | null> {
    const { data, error } = await supabase.from('apply_agents').select('address, active, agreed_at').maybeSingle();
    if (error) throw new Error('Your apply agent could not be checked. Please try again.');
    return data;
  }

  async setAgent(active: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_apply_agent', { p_active: active });
    if (error) throw new Error('This could not be saved. Please try again.');
  }

  async getMail(): Promise<ApplyMail[]> {
    const { data, error } = await supabase
      .from('apply_mail')
      .select('id, application_id, from_address, subject, body, kind, received_at')
      .neq('kind', 'code')
      .order('received_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []) as ApplyMail[];
  }

  async deleteMail(id: string): Promise<void> {
    const { error } = await supabase.from('apply_mail').delete().eq('id', id);
    if (error) throw new Error('This message could not be deleted. Please try again.');
  }

  /** The user finished an application on the employer's own page, which we cannot see. */
  async markApplied(applicationId: string): Promise<void> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .update({
        status: 'submitted', submission_time: new Date().toISOString(),
        error_message: null, login_site: null, pending_questions: [],
      })
      .eq('id', applicationId)
      .in('status', ['needs_login', 'needs_manual_action'])
      .select('id');
    if (error) throw new Error('This application could not be updated. Please try again.');
    if (!data?.length) throw new Error('This application has already moved on, so nothing was changed.');
  }

  private async triggerFormSubmission(
    applicationId: string,
    request: { answers?: Record<string, string>; mode: 'review' | 'submit'; reviewed?: Record<string, string> }
  ): Promise<{
    success: boolean; status?: string; message?: string; error?: string; questions?: ApplyQuestion[]; site?: string;
    filled?: Record<string, string>; answers?: Record<string, string>; consents?: ApplyQuestion[];
  }> {
    const edgeFunctionUrl = getSupabaseEdgeFunctionUrl('auto-apply-submit');
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetchWithSupabaseFallback(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ applicationId, ...request }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Form submission failed: ${error}`);
    }

    return response.json();
  }

  async getApplicationStatus(applicationId: string): Promise<any> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) throw error;
    return data;
  }

  async getUserApplications(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select(`
        *,
        job_listings (
          id,
          company_name,
          role_title,
          company_logo_url
        ),
        optimized_resumes (
          match_score:optimization_score,
          pdf_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const applications = data || [];

    // pdf_url is a path in the private bucket, not an address a link can open.
    const paths = applications
      .map((application: any) => application.optimized_resumes?.pdf_url)
      .filter((path: string | undefined) => path && !/^https?:/.test(path));
    if (!paths.length) return applications;
    const { data: signed } = await supabase.storage.from(RESUME_BUCKET).createSignedUrls([...new Set(paths)], 3600);
    const links = new Map((signed || []).map((link) => [link.path, link.signedUrl]));
    return applications.map((application: any) => (
      application.optimized_resumes && links.get(application.optimized_resumes.pdf_url)
        ? { ...application, optimized_resumes: { ...application.optimized_resumes, pdf_url: links.get(application.optimized_resumes.pdf_url) } }
        : application
    ));
  }
}

export const autoApplyOrchestratorService = new AutoApplyOrchestratorService();
