import { supabase } from '../lib/supabaseClient';
import { resumeAnalysisService } from './resumeAnalysisService';
import {
  aiProjectSuggestionService,
  ProjectSuggestion,
} from './aiProjectSuggestionService';
import { optimizeResume } from './geminiService';
import { exportToPDFBlob } from '../utils/exportUtils';
import { SUPABASE_ANON_KEY, fetchWithSupabaseFallback, getSupabaseEdgeFunctionUrl } from '../config/env';

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
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checks' | 'checkbox' | 'combobox' | 'file';
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
        message: 'Analyzing your resume against job requirements...',
        currentAction: 'Calculating match score',
      });

      const userResume = (await this.getApplicant(userId)).resume_text;
      if (!userResume) {
        throw new Error('Please upload your resume first');
      }

      const analysisResult = await resumeAnalysisService.analyzeResume(
        userResume,
        jobDescription
      );

      const matchScore = analysisResult.overallScore || 0;

      if (matchScore < 80) {
        this.updateStatus(jobId, {
          step: 'suggesting_projects',
          progress: 30,
          message: `Match score: ${matchScore}%. Generating AI project suggestions...`,
          currentAction: 'Creating personalized projects',
        });

        const projectSuggestions = await aiProjectSuggestionService.generateProjectSuggestions(
          jobDescription,
          userResume,
          matchScore
        );

        return {
          success: false,
          matchScore,
          error: 'PROJECT_SUGGESTIONS_REQUIRED',
          ...projectSuggestions,
        } as any;
      }

      return await this.continueAutoApply(
        userId,
        jobId,
        userResume,
        matchScore,
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
          selectedProject.selectionType || 'add'
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
        roleTitle
      );
      const pdfBlob = await exportToPDFBlob(resumeData, 'fresher');
      const pdfUrl = await this.uploadResumePDF(userId, jobId, pdfBlob);

      const resumeId = await this.saveOptimizedResume(
        userId,
        jobId,
        resumeText,
        finalResumeText,
        matchScore,
        pdfUrl
      );

      if (selectedProject) {
        await aiProjectSuggestionService.saveProjectSuggestions(
          userId,
          jobId,
          resumeId,
          [selectedProject]
        );
      }

      this.updateStatus(jobId, {
        step: 'submitting',
        progress: 85,
        message: 'Submitting application...',
        currentAction: 'Filling out application form',
      });

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
        applicationId,
        resumeId,
        matchScore,
        pdfUrl,
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
      this.updateStatus(jobId, {
        step: 'submitting',
        progress: 85,
        message: 'Submitting application...',
        currentAction: 'Filling out application form',
      });

      const outcome = await this.triggerFormSubmission(pending.applicationId!, answers);

      if (outcome.status === 'needs_input') {
        return { ...pending, success: false, error: 'INPUT_REQUIRED', questions: outcome.questions || [] };
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

  private async getApplicant(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('resume_text, full_name, email_address, phone, linkedin_profile_url, github_profile_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return {
      resume_text: '', full_name: '', email_address: '', phone: '', linkedin_profile_url: '', github_profile_url: '',
      ...data,
    };
  }

  private async uploadResumePDF(
    userId: string,
    jobId: string,
    pdfBlob: Blob
  ): Promise<string> {
    const fileName = `${userId}/${jobId}_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from('optimized-resumes')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from('optimized-resumes').getPublicUrl(data.path);

    return publicUrl;
  }

  private async saveOptimizedResume(
    userId: string,
    jobListingId: string,
    originalText: string,
    optimizedText: string,
    matchScore: number,
    pdfUrl: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('optimized_resumes')
      .insert({
        user_id: userId,
        job_listing_id: jobListingId,
        original_resume_text: originalText,
        optimized_resume_text: optimizedText,
        match_score: matchScore,
        pdf_url: pdfUrl,
        improvements_made: [],
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private detectPlatform(url: string): string {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
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

    if (error) throw error;
    return data.id;
  }

  private async triggerFormSubmission(
    applicationId: string,
    answers?: Record<string, string>
  ): Promise<{ success: boolean; status?: string; message?: string; error?: string; questions?: ApplyQuestion[] }> {
    const edgeFunctionUrl = getSupabaseEdgeFunctionUrl('auto-apply-submit');
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetchWithSupabaseFallback(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ applicationId, answers }),
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
          match_score,
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
