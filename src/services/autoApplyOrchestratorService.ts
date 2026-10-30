import { supabase } from '../lib/supabaseClient';
import { ResumeData } from '../types/resume';
import {
  aiProjectSuggestionService,
  ProjectSuggestion,
} from './aiProjectSuggestionService';
import { optimizeResume } from './geminiService';
import { QUICK_OPTIMIZATION_MODEL } from './openrouterModelConfig';
import { exportToPDFBlob } from '../utils/exportUtils';
import { findUnsupportedClaims } from '../utils/resumeFactCheck';
import { SUPABASE_ANON_KEY, fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';

// Private bucket that already holds users' uploaded resumes.
const RESUME_BUCKET = 'user-resumes';

export interface AutoApplyStatus {
  step: 'analyzing' | 'suggesting_projects' | 'optimizing' | 'generating_pdf' | 'submitting' | 'completed' | 'failed';
  progress: number;
  message: string;
  currentAction?: string;
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
    try {
      const applicant = await this.getApplicant(userId);
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

      // ponytail: single-pass optimizer and a fixed 'fresher' layout. Use the
      // optimizer page's multi-pass pipeline and the user's own type once
      // auto-apply is tied to plan credits.
      const resumeData = await optimizeResume(
        finalResumeText,
        jobDescription || `${roleTitle} at ${companyName}`,
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
        // The default free model often returns nothing for a prompt this size.
        QUICK_OPTIMIZATION_MODEL
      );
      // Tailoring may reword, never invent: anything the original does not
      // state is shown to the user on the review screen before it is sent.
      const resumeFlags = findUnsupportedClaims(resumeText, resumeData);
      const pdfBlob = await exportToPDFBlob(resumeData, 'fresher');
      const pdfPath = await this.uploadResumePDF(userId, jobId, pdfBlob);
      const resumeId = await this.saveOptimizedResume(userId, jobId, resumeData, pdfPath);
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
      const { applicationId } = await this.queueApplication(jobId, resumeId);

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
      .select('full_name, email_address, phone, linkedin_profile_url, github_profile_url')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;

    // The uploaded resume's text is saved with the job preferences, not the profile.
    const { data: preferences, error: preferencesError } = await supabase
      .from('user_job_preferences')
      .select('resume_text')
      .eq('user_id', userId)
      .maybeSingle();
    if (preferencesError) throw preferencesError;

    return {
      full_name: '', email_address: '', phone: '', linkedin_profile_url: '', github_profile_url: '',
      ...data,
      resume_text: preferences?.resume_text || '',
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
    pdfPath: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('optimized_resumes')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        resume_content: resumeData,
        pdf_url: pdfPath,
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
  async queueApplication(jobId: string, resumeVersionId?: string): Promise<{ applicationId: string; status: string; queued: boolean }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Authentication required');

    const response = await fetchWithSupabaseFallback(getSupabaseEdgeFunctionUrl('auto-apply-queue'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ jobId, resumeVersionId }),
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
