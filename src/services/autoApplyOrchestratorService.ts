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
  /**
   * With error 'REVIEW_REQUIRED': the form is filled and nothing is sent. The
   * user approves `filled` and picks from `consents`; `reviewed` is the same
   * answers by key, sent back on approval.
   */
  review?: { filled: Record<string, string>; reviewed: Record<string, string>; consents: ApplyQuestion[] };
  /** Set once the user pressed Approve & Submit; from then on calls may send the application. */
  approved?: boolean;
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

      // One live application per job: pick up the one that exists, never start a second.
      const live = await this.findLiveApplication(userId, jobId);
      if (live) return await this.resumeLiveApplication(jobId, live, userResume, applicationUrl);

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

      const applicationId = await this.createApplication(
        userId,
        jobId,
        resumeId,
        platform,
        applicationUrl
      );

      return await this.submitApplication(jobId, {
        success: false,
        // Every site goes through the same engine. Greenhouse and Lever are
        // the tested ones; anywhere else, a form that cannot be sent hands
        // the user the tailored resume to finish there.
        manualFallback: platform !== 'greenhouse' && platform !== 'lever',
        applicationId,
        resumeId,
        matchScore,
        pdfUrl,
        resumeFlags,
      });
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
      // Until the user approves on the review screen, the form is only filled
      // and read back; the Submit button is not touched.
      this.updateStatus(jobId, pending.approved
        ? { step: 'submitting', progress: 90, message: 'Applying...', currentAction: 'Sending your approved application' }
        : { step: 'submitting', progress: 85, message: 'Preparing...', currentAction: "Reading the employer's form" });

      const outcome = await this.triggerFormSubmission(pending.applicationId!, {
        answers,
        mode: pending.approved ? 'submit' : 'review',
        reviewed: pending.approved ? pending.reviewedAnswers : undefined,
      });

      if (outcome.status === 'needs_input') {
        return { ...pending, success: false, error: 'INPUT_REQUIRED', questions: outcome.questions || [] };
      }
      if (outcome.status === 'ready_for_review') {
        return {
          ...pending,
          success: false,
          error: 'REVIEW_REQUIRED',
          questions: undefined,
          review: { filled: outcome.filled || {}, reviewed: outcome.answers || {}, consents: outcome.consents || [] },
        };
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

  /**
   * The user pressed Approve & Submit on the review screen. Sends exactly what
   * they saw, plus a tick for each consent box they chose.
   */
  async approveApplication(jobId: string, pending: AutoApplyResult, consentKeys: string[]): Promise<AutoApplyResult> {
    return this.submitApplication(jobId, {
      ...pending,
      error: undefined,
      review: undefined,
      approved: true,
      reviewedAnswers: {
        ...pending.review?.reviewed,
        ...Object.fromEntries(consentKeys.map((key) => [key, 'yes'])),
      },
    });
  }

  /** The user's application for this job that still holds the duplicate lock, if any. */
  private async findLiveApplication(userId: string, jobId: string) {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .select('id, status, resume_version_id, platform')
      .eq('user_id', userId)
      .eq('job_listing_id', jobId)
      .neq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data as { id: string; status: string; resume_version_id: string | null; platform: string } | null;
  }

  /** Continues an application that already exists for this job, according to how far it got. */
  private async resumeLiveApplication(
    jobId: string,
    live: { id: string; status: string; resume_version_id: string | null; platform: string },
    originalResume: string,
    applicationUrl: string
  ): Promise<AutoApplyResult> {
    if (live.status === 'submitted') {
      return { success: true, applicationId: live.id };
    }
    if (live.status === 'submitting' || live.status === 'uncertain') {
      return { success: false, applicationId: live.id, error: 'SUBMISSION_UNCERTAIN' };
    }

    // Still being prepared: reuse its tailored resume and go back to the form.
    const { data: resume, error } = await supabase
      .from('optimized_resumes')
      .select('resume_content, pdf_url')
      .eq('id', live.resume_version_id)
      .maybeSingle();
    if (error) throw error;
    if (!resume?.pdf_url) throw new Error('Your earlier application for this job could not be reopened.');
    const { data: signed } = await supabase.storage.from(RESUME_BUCKET).createSignedUrl(resume.pdf_url, 3600);
    const platform = this.detectPlatform(applicationUrl);
    return this.submitApplication(jobId, {
      success: false,
      manualFallback: platform !== 'greenhouse' && platform !== 'lever',
      applicationId: live.id,
      resumeId: live.resume_version_id || undefined,
      pdfUrl: signed?.signedUrl,
      resumeFlags: findUnsupportedClaims(originalResume, resume.resume_content as ResumeData),
    });
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

  private async createApplication(
    userId: string,
    jobListingId: string,
    resumeVersionId: string,
    platform: string,
    applicationUrl: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('auto_apply_applications')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        resume_version_id: resumeVersionId,
        platform,
        application_url: applicationUrl,
        status: 'filling',
      })
      .select('id')
      .single();

    // The database allows one live application per user and job. Losing that
    // race (a second tab, a double click) must not start a second one.
    if (error?.code === '23505') throw new Error('An application for this job is already in progress.');
    if (error) throw error;
    return data.id;
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
    return data || [];
  }
}

export const autoApplyOrchestratorService = new AutoApplyOrchestratorService();
