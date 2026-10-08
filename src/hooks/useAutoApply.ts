import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  autoApplyOrchestratorService,
  AutoApplyStatus,
  AutoApplyResult,
} from '../services/autoApplyOrchestratorService';
import {
  aiProjectSuggestionService,
  ProjectSuggestion,
  ProjectGenerationResult,
} from '../services/aiProjectSuggestionService';
import { JobListing } from '../types/jobs';

const describeJob = (job: JobListing) =>
  [
    job.full_description || job.description,
    job.short_description ? `\n\nKey Points: ${job.short_description}` : '',
    job.qualification ? `\n\nQualifications: ${job.qualification}` : '',
  ]
    .filter(Boolean)
    .join('\n');

export function useAutoApply() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<AutoApplyStatus>({
    step: 'analyzing',
    progress: 0,
    message: 'Initializing...',
  });
  const [projectSuggestions, setProjectSuggestions] = useState<ProjectGenerationResult | null>(
    null
  );
  const [currentJob, setCurrentJob] = useState<JobListing | null>(null);
  const [result, setResult] = useState<AutoApplyResult | null>(null);
  // An application waiting on answers the employer's form requires.
  const [pending, setPending] = useState<AutoApplyResult | null>(null);

  // Routes an outcome: more input needed, or a final result for the confirmation modal.
  const settle = useCallback((applyResult: AutoApplyResult) => {
    setShowStatusModal(false);
    if (!applyResult.success && applyResult.error === 'PROJECT_SUGGESTIONS_REQUIRED') {
      setProjectSuggestions(applyResult as any);
      setShowProjectModal(true);
    } else if (!applyResult.success && (applyResult.error === 'INPUT_REQUIRED' || applyResult.error === 'LOGIN_REQUIRED')) {
      setPending(applyResult);
    } else {
      setResult(applyResult);
    }
  }, []);

  const fail = useCallback((error: any) => {
    setCurrentStatus({
      step: 'failed',
      progress: 0,
      message: 'Application failed',
      currentAction: error.message,
    });
    settle({ success: false, error: error.message });
  }, [settle]);

  const startAutoApply = useCallback(
    async (job: JobListing) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setCurrentJob(job);
      setIsProcessing(true);
      setShowStatusModal(true);
      setResult(null);

      try {
        const jobDescription = describeJob(job);

        autoApplyOrchestratorService.registerStatusCallback(job.id, (status) => {
          setCurrentStatus(status);
        });

        const applyResult = await autoApplyOrchestratorService.startAutoApply(
          job.id,
          jobDescription,
          job.company_name,
          job.role_title,
          job.application_link
        );

        settle(applyResult);
      } catch (error: any) {
        console.error('Auto-apply error:', error);
        fail(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [user, settle, fail]
  );

  const handleProjectSelection = useCallback(
    async (project: ProjectSuggestion, action: 'replace' | 'add' | 'skip') => {
      if (!user || !currentJob) return;

      try {
        setShowProjectModal(false);
        setShowStatusModal(true);
        setIsProcessing(true);

        const selectedProject = action !== 'skip' ? { ...project, selectionType: action } : null;

        const userResume = '';

        const matchScore = projectSuggestions?.matchScoreImprovement
          ? ((currentStatus as any).matchScore || 70) + projectSuggestions.matchScoreImprovement
          : 85;

        const finalResult = await autoApplyOrchestratorService.continueAutoApply(
          user.id,
          currentJob.id,
          userResume,
          matchScore,
          currentJob.application_link,
          currentJob.company_name,
          currentJob.role_title,
          selectedProject,
          describeJob(currentJob)
        );

        settle(finalResult);
      } catch (error: any) {
        console.error('Error in project selection:', error);
        fail(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [user, currentJob, projectSuggestions, currentStatus, settle, fail]
  );

  const submitAnswers = useCallback(
    async (answers: Record<string, string>) => {
      if (!currentJob || !pending) return;

      setPending(null);
      setShowStatusModal(true);
      setIsProcessing(true);
      try {
        settle(await autoApplyOrchestratorService.submitApplication(currentJob.id, pending, answers));
      } catch (error: any) {
        console.error('Error submitting answers:', error);
        fail(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentJob, pending, settle, fail]
  );

  // Saves the login the user typed for the job's site, then tries the application again.
  const submitLogin = useCallback(
    async (username: string, password: string) => {
      if (!currentJob || !pending) return;

      // Throws when saving fails, so the login window can show why and stay open.
      await autoApplyOrchestratorService.saveSiteLogin(currentJob.application_link, username, password);

      setPending(null);
      setShowStatusModal(true);
      setIsProcessing(true);
      try {
        settle(await autoApplyOrchestratorService.submitApplication(currentJob.id, pending));
      } catch (error: any) {
        console.error('Error applying after login:', error);
        fail(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [currentJob, pending, settle, fail]
  );

  const closeModals = useCallback(() => {
    setShowStatusModal(false);
    setShowProjectModal(false);
    if (currentJob) {
      autoApplyOrchestratorService.unregisterStatusCallback(currentJob.id);
    }
    setCurrentJob(null);
    setProjectSuggestions(null);
    setPending(null);
    setResult(null);
  }, [currentJob]);

  return {
    isProcessing,
    showStatusModal,
    showProjectModal,
    currentStatus,
    projectSuggestions,
    currentJob,
    result,
    questions: pending?.error === 'INPUT_REQUIRED' ? pending.questions ?? null : null,
    submitAnswers,
    loginRequest: pending?.error === 'LOGIN_REQUIRED'
      ? { site: pending.loginSite || 'this site', message: pending.loginMessage }
      : null,
    submitLogin,
    startAutoApply,
    handleProjectSelection,
    closeModals,
  };
}
