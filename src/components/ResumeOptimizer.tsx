// src/components/ResumeOptimizer.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { FileText, AlertCircle, Plus, Sparkles, ArrowLeft, X, Send, Briefcase, Building2, Target, Zap, CheckCircle, Pencil, Eye, Download } from 'lucide-react';
import { AnimatedCard, GradientButton, FloatingParticles, ChristmasSnow } from './ui';
import { ResumePreview } from './ResumePreview';
import { Parameter16ScoreDisplay } from './Parameter16ScoreDisplay';
import { ProjectAnalysisModal } from './ProjectAnalysisModal';
import { MobileOptimizedInterface } from './MobileOptimizedInterface';
import { ProjectEnhancement } from './ProjectEnhancement';
import { SubscriptionPlans } from './payment/SubscriptionPlans';
import { SubscriptionStatus } from './payment/SubscriptionStatus';
import { MissingSectionsModal } from './MissingSectionsModal';
import { InputWizard } from './InputWizard';
import { LoadingAnimation } from './LoadingAnimation';
// REMOVED: OpenRouter/Gemini - now using EdenAI only
// import { optimizeResume } from '../services/geminiService';
// REMOVED: OpenRouter scoring - using EdenAI only
// import { generateBeforeScore, generateAfterScore, getDetailedResumeScore, reconstructResumeText } from '../services/scoringService';
import { reconstructResumeText } from '../services/scoringService'; // Keep only reconstructResumeText utility
import { getOptimizationTierRemaining, paymentService } from '../services/paymentService';
import { authService } from '../services/authService'; // ADDED: Import authService
import { ResumeData, UserType, MatchScore, DetailedScore, ExtractionResult, ScoringMode } from '../types/resume';
import { ExportOptions, defaultExportOptions } from '../types/export';
import { exportToPDF, exportToWord } from '../utils/exportUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { ResumePreviewControls } from './ResumePreviewControls';
import { FullScreenPreviewModal } from './FullScreenPreviewModal';
import { jobsService } from '../services/jobsService';

// NEW: EdenAI and enhanced services imports
import { matchProjectsToJd, extractJdKeywords, ProjectMatchResult } from '../services/projectMatchingEngine';
import { processResumeText } from '../services/edenModerationService';
import { ProjectMatchingPanel } from './ProjectMatchingPanel';
import { MissingSections, arrayToMissingSections } from '../types/edenai';

import { runOptimizationLoop, OptimizationSessionResult } from '../services/optimizationLoopController';
import ScoreDeltaDisplay, { type ScoreSummaryOverride } from './ScoreDeltaDisplay';
import MissingProfilePrompt from './MissingProfilePrompt';
import ResumeEditor from './editor/ResumeEditor';
import ExportResumeModal from './ExportResumeModal';
import OptimizationQualityModal from './optimizer/OptimizationQualityModal';
import {
  DEFAULT_JD_OPTIMIZATION_TIER,
  getJdOptimizationPackage,
  getJdOptimizationTier,
  type JdOptimizationPackageSize,
  type JdOptimizationTierId,
} from '../config/jdOptimizationTiers';
import { findRequiredMissingSections } from '../utils/resumeMissingSections';

// src/components/ResumeOptimizer.tsx
const cleanResumeText = (text: string): string => {
  let cleaned = text;
  // Remove "// Line XXX" patterns anywhere in the text
  cleaned = cleaned.replace(/\/\/\s*Line\s*\d+\s*/g, '');
  // Remove "// MODIFIED:" patterns anywhere in the text (e.g., "// MODIFIED: listStyleType to 'none'")
  cleaned = cleaned.replace(/\/\/\s*MODIFIED:\s*.*?(?=\n|$)/g, ''); // Catches the whole comment line
  // Also remove any remaining single-line comments that might have slipped through or were on their own line
  cleaned = cleaned.split('\n')
                   .filter(line => !line.trim().startsWith('//')) // Remove lines that start with //
                   .join('\n');
  return cleaned;
};


interface ResumeOptimizerProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile: (mode?: 'profile' | 'wallet') => void;
  onNavigateBack: () => void;
  userSubscription: any;
  refreshUserSubscription: () => Promise<void>;
  onShowPlanSelection: (featureId?: string) => void;
  onShowSubscriptionPlansDirectly?: () => void; // Direct subscription plans (skip plan selection modal)
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

type ManualProject = {
  title: string;
  startDate: string;
  endDate: string;
  techStack: string[];
  oneLiner: string;
};

// --- NEW CONSTANT ---
const MAX_OPTIMIZER_INPUT_LENGTH = 50000; // Match the constant in geminiService.ts

const ResumeOptimizer: React.FC<ResumeOptimizerProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile,
  onNavigateBack,
  userSubscription,
  refreshUserSubscription,
  onShowPlanSelection,
  onShowSubscriptionPlansDirectly,
  toolProcessTrigger,
  setToolProcessTrigger
}) => {
  const { user, revalidateUserSession } = useAuth();
  const { isChristmasMode, colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  useSEO({
    title: 'JD-Based Resume Optimizer - Tailor Resume to Job Description',
    description: 'Optimize your resume for any job description with AI-powered JD-based resume optimization. Get ATS-friendly, keyword-matched resumes tailored to specific roles. Increase your interview callback rate.',
    keywords: 'JD based resume, job description based resume, resume from job description, JD resume builder, JD resume optimization, JD resume keywords, JD resume matching, JD resume AI tool, resume tailored to job description, resume optimized for JD, resume JD keyword mapping, resume JD alignment tool, JD resume score, JD resume rewrite, JD resume customization, ATS resume optimization tool, ATS resume keyword match, resume keyword optimizer, resume optimization AI, resume optimization tool, resume optimization for software engineer, resume optimization for fresher, resume optimization for experienced, PrimoBoost AI',
    canonical: '/optimizer',
  });

  const jobContext = location.state as { jobId?: string; jobDescription?: string; roleTitle?: string; companyName?: string; fromJobApplication?: boolean } | null;
  const jobIdFromContext = jobContext?.jobId;

  const [extractionResult, setExtractionResult] = useState<ExtractionResult>({ text: '', extraction_mode: 'TEXT', trimmed: false });
  const [jobDescription, setJobDescription] = useState(jobContext?.jobDescription || '');
  const [targetRole, setTargetRole] = useState(jobContext?.roleTitle || '');
  
  // Ref to always get latest jobDescription value in callbacks (fixes stale closure issue)
  const jobDescriptionRef = useRef(jobDescription);
  useEffect(() => {
    jobDescriptionRef.current = jobDescription;
  }, [jobDescription]);
  const [userType, setUserType] = useState<UserType>('fresher');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('general');
  const [autoScoreOnUpload, setAutoScoreOnUpload] = useState(true);

  const [optimizedResume, setOptimizedResume] = useState<ResumeData | null>(null);
  const [parsedResumeData, setParsedResumeData] = useState<ResumeData | null>(null);
  const [pendingResumeData, setPendingResumeData] = useState<ResumeData | null>(null);

  const [beforeScore, setBeforeScore] = useState<MatchScore | null>(null);
  const [afterScore, setAfterScore] = useState<MatchScore | null>(null);
  const [initialResumeScore, setInitialResumeScore] = useState<DetailedScore | null>(null);
  const [finalResumeScore, setFinalResumeScore] = useState<DetailedScore | null>(null);
  const [changedSections, setChangedSections] = useState<string[]>([]);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isCalculatingScore, setIsCalculatingScore] = useState(false);
  const [isProcessingMissingSections, setIsProcessingMissingSections] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume'>('resume');
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview');
  const [currentStep, setCurrentStep] = useState(0);

  const [showProjectAnalysis, setShowProjectAnalysis] = useState(false);
  const [showMissingSectionsModal, setShowMissingSectionsModal] = useState(false);
  const [missingSections, setMissingSections] = useState<string[]>([]);
  
  // NEW: EdenAI enhanced state
  const jdSummary = jobDescription;
  const [showProjectMatchingPanel, setShowProjectMatchingPanel] = useState(false);
  const [projectMatchResults, setProjectMatchResults] = useState<ProjectMatchResult[]>([]);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [missingSectionsJson, setMissingSectionsJson] = useState<MissingSections | null>(null);
  
  // NEW: User actions required for 90%+ score
  const [userActionsRequired, setUserActionsRequired] = useState<any[]>([]);
  
  // NEW: 16-Parameter optimization scores
  const [parameter16Scores, setParameter16Scores] = useState<{
    beforeScores?: any[];
    afterScores?: any[];
    overallBefore?: number;
    overallAfter?: number;
    improvement?: number;
  } | null>(null);

  const [jdOptimizationResult, setJdOptimizationResult] = useState<OptimizationSessionResult | null>(null);
  const [optimizationScoreSummary, setOptimizationScoreSummary] = useState<ScoreSummaryOverride | null>(null);
  const [showMissingProfile, setShowMissingProfile] = useState(true);

  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showProjectMismatch, setShowProjectMismatch] = useState(false);
  
  // Responsive check for mobile/desktop view - updates on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [showProjectOptions, setShowProjectOptions] = useState(false);
  const [showManualProjectAdd, setShowManualProjectAdd] = useState(false);
  const [lowScoringProjects, setLowScoringProjects] = useState<any[]>([]);
  const [manualProject, setManualProject] = useState<ManualProject>({
    title: '',
    startDate: '',
    endDate: '',
    techStack: [],
    oneLiner: ''
  });
  const [newTechStack, setNewTechStack] = useState('');

  const [showProjectEnhancement, setShowProjectEnhancement] = useState(false);

  const [subscription, setSubscription] = useState<any>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');

  const [exportOptions, setExportOptions] = useState<ExportOptions>(defaultExportOptions);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [exportStatus, setExportStatus] = useState<{
    type: 'pdf' | 'word' | null;
    status: 'success' | 'error' | null;
    message: string;
  }>({ type: null, status: null, message: '' });

  const [optimizationInterrupted, setOptimizationInterrupted] = useState(false);
  const [showOptimizationQuality, setShowOptimizationQuality] = useState(false);
  const [availableOptimizationCredits, setAvailableOptimizationCredits] = useState(0);
  const [processingQualityTier, setProcessingQualityTier] = useState<JdOptimizationTierId | null>(null);
  const [qualitySelectionError, setQualitySelectionError] = useState<string | null>(null);
  const selectedOptimizationTierRef = useRef<JdOptimizationTierId>(DEFAULT_JD_OPTIMIZATION_TIER);
  const qualitySelectionLockRef = useRef(false);
  const [jobApplicationLink, setJobApplicationLink] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);

  const [previewZoom, setPreviewZoom] = useState(0.8);
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false);
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2.5;

  const userName = (user as any)?.user_metadata?.name || '';
  const userEmail = user?.email || ''; // Correctly accesses email from user object
  const userPhone = user?.phone || ''; // Correctly accesses phone from user object
  const userLinkedin = user?.linkedin || ''; // Correctly accesses linkedin from user object
  const userGithub = user?.github || ''; // Correctly accesses github from user object

  const handleStartNewResume = useCallback(() => { // Memoize
    setOptimizedResume(null);
    setExtractionResult({ text: '', extraction_mode: 'TEXT', trimmed: false });
    setJobDescription('');
    setTargetRole('');
    setUserType('fresher');
    setBeforeScore(null);
    setAfterScore(null);
    setInitialResumeScore(null);
    setFinalResumeScore(null);
    setParsedResumeData(null);
    setManualProject({ title: '', startDate: '', endDate: '', techStack: [], oneLiner: '' });
    setNewTechStack('');
    setLowScoringProjects([]);
    setChangedSections([]);
    setCurrentStep(0);
    setActiveTab('resume');
    setOptimizationInterrupted(false);
    setParameter16Scores(null);
    setUserActionsRequired([]);
    setJdOptimizationResult(null);
    setOptimizationScoreSummary(null);
    setEditorMode('preview');
    setShowExportModal(false);
  }, []);

  const checkSubscriptionStatus = useCallback(async () => { // Memoize
    if (!user) return;
    try {
      const userSubscriptionData = await paymentService.getUserSubscription(user.id);
      setSubscription(userSubscriptionData);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoadingSubscription(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      checkSubscriptionStatus();
    } else {
      setLoadingSubscription(false);
    }
  }, [isAuthenticated, user, checkSubscriptionStatus]); // Add checkSubscriptionStatus to dependencies

  useEffect(() => {
    let isMounted = true;

    if (!jobContext?.fromJobApplication || !jobIdFromContext) {
      setJobApplicationLink(null);
      return () => {
        isMounted = false;
      };
    }

    const fetchJobLink = async () => {
      try {
        const jobDetails = await jobsService.getJobListingById(jobIdFromContext);
        if (isMounted) {
          const link = jobDetails?.application_link?.trim();
          setJobApplicationLink(link && link.length > 0 ? link : null);
        }
      } catch (error) {
        console.error('ResumeOptimizer: Failed to fetch job application link', error);
        if (isMounted) {
          setJobApplicationLink(null);
        }
      }
    };

    fetchJobLink();

    return () => {
      isMounted = false;
    };
  }, [jobContext?.fromJobApplication, jobIdFromContext]);

  useEffect(() => {
    if (extractionResult.text.trim().length > 0 && currentStep === 0) {
      setCurrentStep(1);
    }
  }, [extractionResult.text, currentStep]);

  const handleExternalApply = useCallback(
    (resumeData?: ResumeData | null) => {
      if (jobApplicationLink) {
        const newWindow = window.open(jobApplicationLink, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          console.warn('ResumeOptimizer: popup blocked when trying to open job application link.');
        }
        return;
      }

      if (jobIdFromContext) {
        const navigationState = resumeData
          ? {
              state: {
                optimizedResumeData: resumeData,
                fromOptimizer: true
              }
            }
          : undefined;
        navigate(`/jobs/${jobIdFromContext}/apply-form`, navigationState);
        return;
      }

      navigate('/jobs');
    },
    [jobApplicationLink, jobIdFromContext, navigate]
  );
const checkForMissingSections = useCallback((resumeData: ResumeData): string[] =>
  findRequiredMissingSections(resumeData, userType, {
    name: userName,
    email: userEmail,
    phone: userPhone,
  }), [userEmail, userName, userPhone, userType]);

  const proceedWithFinalOptimization = useCallback(async (resumeData: ResumeData, initialScore: DetailedScore, accessToken: string) => { // Memoize
    // Use ref to get latest jobDescription value (fixes stale closure issue)
    const currentJobDescription = jobDescriptionRef.current;
    const qualityTier = getJdOptimizationTier(selectedOptimizationTierRef.current);
    const optimizationRunId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `optimization-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let creditReservationId: string | null = null;
    let creditFinalized = false;
    
    try {
      setIsOptimizing(true);
      setJdOptimizationResult(null);
      setParameter16Scores(null);
      setOptimizationScoreSummary(null);
      setUserActionsRequired([]);

      const reservation = await paymentService.reserveOptimization(user!.id, qualityTier.id, optimizationRunId);
      if (!reservation.success || !reservation.reservationId) {
        setAvailableOptimizationCredits(reservation.remaining || 0);
        throw new Error(reservation.error || `No ${qualityTier.name} usage is available.`);
      }
      creditReservationId = reservation.reservationId;

      // EDENAI + JD OPTIMIZATION: Optimize resume against job description with 220+ metrics
      let finalOptimizedResume: ResumeData;
      let optimizationSessionPayload: Record<string, unknown> | null = null;
      
      if (currentJobDescription && currentJobDescription.trim().length > 50) {
        // Import and use the ENHANCED JD optimizer service (220+ metrics)
        const { EnhancedJdOptimizerService } = await import('../services/enhancedJdOptimizerService');
        
        const resumeText = reconstructResumeText(resumeData);
        const optimizationResult = await EnhancedJdOptimizerService.optimizeResume(
          resumeData,
          resumeText,
          currentJobDescription,
          targetRole,
          qualityTier.mode,
          qualityTier.modelId,
          optimizationRunId,
          userType,
        );
        
        finalOptimizedResume = {
          ...optimizationResult.optimizedResume,
          name: resumeData.name || userName || '',
          email: resumeData.email || userEmail || '',
          phone: resumeData.phone || userPhone || '',
          linkedin: resumeData.linkedin || userLinkedin || '',
          github: resumeData.github || userGithub || '',
          targetRole: targetRole || resumeData.targetRole || '',
          origin: 'jd_optimized'
        };
        
        if (optimizationResult.userActionsRequired && optimizationResult.userActionsRequired.length > 0) {
          setUserActionsRequired(optimizationResult.userActionsRequired);
        } else {
          setUserActionsRequired([]);
        }

        if (optimizationResult.parameter16Scores) {
          setParameter16Scores(optimizationResult.parameter16Scores);
        } else {
          setParameter16Scores({
            overallBefore: optimizationResult.beforeScore?.overall || 0,
            overallAfter: optimizationResult.afterScore?.overall || 0,
            improvement: optimizationResult.scoreImprovement || 0,
          });
        }

        try {
          const loopResult = await runOptimizationLoop(
            finalOptimizedResume,
            currentJobDescription,
            (msg, pct) => console.log(`[OptLoop] ${pct}% - ${msg}`),
            resumeData,
            {
              maxLoops: Math.max(0, qualityTier.aiPasses - 1),
              modelSequence: qualityTier.refinementModels,
              candidateType: userType,
              optimizationTier: qualityTier.id,
              runId: optimizationRunId,
            },
          );
          setJdOptimizationResult(loopResult);
          finalOptimizedResume = loopResult.optimizedResume;
          setParameter16Scores({
            overallBefore: loopResult.beforeScore.overallScore,
            overallAfter: loopResult.afterScore.overallScore,
            improvement: loopResult.afterScore.overallScore - loopResult.beforeScore.overallScore,
          });
          setOptimizationScoreSummary({
            before: {
              score: loopResult.beforeScore.overallScore,
              band: loopResult.beforeScore.matchBand,
              probability: loopResult.beforeScore.interviewProbability,
            },
            after: {
              score: loopResult.afterScore.overallScore,
              band: loopResult.afterScore.matchBand,
              probability: loopResult.afterScore.interviewProbability,
            },
          });

          const loopEvidenceAction = loopResult.evidenceViolations.length > 0 ? [{
            category: 'experience',
            priority: 'high',
            title: 'Candidate evidence required',
            description: 'Some suggested changes were excluded because they were not supported by your original resume.',
            currentScore: 0,
            targetScore: 100,
            suggestions: [...new Set(loopResult.evidenceViolations.map((item) => item.message))].slice(0, 5),
            canAutoFix: false,
          }] : [];
          if (loopResult.gapClassification.userActionCards.length > 0 || loopEvidenceAction.length > 0) {
            setUserActionsRequired((current) => [
              ...current,
              ...loopEvidenceAction,
              ...loopResult.gapClassification.userActionCards,
            ]);
          }

          if (user) {
            optimizationSessionPayload = {
              user_id: user.id,
              resume_text: reconstructResumeText(resumeData),
              job_description: currentJobDescription,
              before_score: loopResult.beforeScore.overallScore,
              after_score: loopResult.afterScore.overallScore,
              canonical_before_score_id: loopResult.beforeScoreId,
              canonical_after_score_id: loopResult.afterScoreId,
              scoring_version: loopResult.scoringVersion,
              before_input_hash: loopResult.beforeInputHash,
              after_input_hash: loopResult.afterInputHash,
              before_parameters: loopResult.beforeScore.parameters,
              after_parameters: loopResult.afterScore.parameters,
              category_deltas: loopResult.categoryDeltas,
              gap_classification: {
                ...loopResult.gapClassification,
                optimizationTier: qualityTier.id,
                requestedModel: qualityTier.modelId,
                creditsCharged: qualityTier.creditCost,
                aiPasses: qualityTier.aiPasses,
                scoringVersion: loopResult.scoringVersion,
                beforeScoreId: loopResult.beforeScoreId,
                afterScoreId: loopResult.afterScoreId,
                beforeInputHash: loopResult.beforeInputHash,
                afterInputHash: loopResult.afterInputHash,
                runId: optimizationRunId,
              },
              changes_applied: loopResult.totalChanges,
              iterations_count: loopResult.iterations.length,
              reached_target: loopResult.reachedTarget,
              processing_time_ms: loopResult.processingTimeMs,
            };
          }
        } catch (loopErr) {
          console.error(`${qualityTier.name} refinement pass failed:`, loopErr);
          throw new Error(`${qualityTier.name} could not complete every promised AI pass. No credits were charged.`);
        }
      } else {
        // Fallback: Use parsed resume directly if no JD provided
        finalOptimizedResume = {
          ...resumeData,
          name: resumeData.name || userName || '',
          email: resumeData.email || userEmail || '',
          phone: resumeData.phone || userPhone || '',
          linkedin: resumeData.linkedin || userLinkedin || '',
          github: resumeData.github || userGithub || '',
          targetRole: targetRole || resumeData.targetRole || '',
          origin: 'eden_optimized'
        };
      }
      // Merge in user's saved certifications from profile if optimizer returned none
      try {
        if ((!finalOptimizedResume.certifications || finalOptimizedResume.certifications.length === 0) && user) {
          const profile = await authService.fetchUserProfile(user.id);
          const normalizeCerts = (items: any[]): (string | { title: string; description: string })[] => {
            return (items || [])
              .map((item: any) => {
                if (typeof item === 'string') {
                  const s = item.trim();
                  return s.length > 0 ? s : null;
                }
                if (item && typeof item === 'object') {
                  const primary: string = (item.title || item.name || item.certificate || item.text || item.value || item.issuer || item.provider || '').toString().trim();
                  const desc: string = (item.description || item.issuer || item.provider || '').toString().trim();
                  if (!primary && !desc) return null;
                  return { title: primary || desc, description: desc && desc !== primary ? desc : '' };
                }
                return null;
              })
              .filter(Boolean) as (string | { title: string; description: string })[];
          };
          const profileCerts = normalizeCerts((profile as any)?.certifications_details || []);
          if (profileCerts.length > 0) {
            const seen = new Set<string>();
            finalOptimizedResume.certifications = (finalOptimizedResume.certifications || []).concat(
              profileCerts.filter((c: any) => {
                const key = typeof c === 'string' ? c.toLowerCase() : (c.title || c.description || '').toLowerCase();
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
              })
            );
          }
        }
      } catch (mergeErr) {
        console.warn('ResumeOptimizer: Could not merge profile certifications:', mergeErr);
      }

      // EDENAI ONLY: Skip OpenRouter scoring calls
      // const finalScore = await getDetailedResumeScore(finalOptimizedResume, jobDescription, setIsCalculatingScore);
      // setFinalResumeScore(finalScore);
      // const afterScoreData = await generateAfterScore(finalOptimizedResume, jobDescription);
      // setAfterScore(afterScoreData);
      
      if (optimizationSessionPayload) {
        const { error: sessionInsertError } = await supabase
          .from('optimization_sessions')
          .insert(optimizationSessionPayload);
        if (sessionInsertError) {
          console.warn('Failed to persist optimization session:', sessionInsertError);
        }
      }

      const finalizedReservation = await paymentService.finalizeCreditReservation(creditReservationId);
      if (!finalizedReservation.success) {
        throw new Error(finalizedReservation.error || 'Unable to finalize the reserved optimization usage.');
      }
      creditFinalized = true;
      await checkSubscriptionStatus();
      setWalletRefreshKey(prevKey => prevKey + 1);

      setChangedSections(
        qualityTier.id === 'quick'
          ? []
          : ['workExperience', 'education', 'projects', 'skills', 'certifications'],
      );
      if (user) {
        try {
          await authService.incrementResumesCreatedCount(user.id);
          await authService.incrementGlobalResumesCreatedCount();
          await revalidateUserSession();
        } catch (countError) {
          console.error('ResumeOptimizer: Failed to increment resume counts:', countError);
        }
      }
      setActiveTab('resume');
      
      setOptimizedResume(finalOptimizedResume);
    } catch (error) {
      console.error('Error in final optimization pass:', error);
      if (creditReservationId && !creditFinalized) {
        const refund = await paymentService.refundCreditReservation(creditReservationId);
        if (!refund.success) {
          console.error('Failed to restore reserved optimization usage:', refund.error);
        } else {
          await checkSubscriptionStatus();
          setWalletRefreshKey(prevKey => prevKey + 1);
        }
      }
      alert(error instanceof Error ? error.message : 'Failed to complete resume optimization. Please try again.');
    } finally {
      setIsOptimizing(false);
      setIsCalculatingScore(false);
    }
  }, [jobDescription, userType, userName, userEmail, userPhone, userLinkedin, userGithub, targetRole, user, checkSubscriptionStatus, revalidateUserSession]); // Dependencies for memoized function

  const handleInitialResumeProcessing = useCallback(async (resumeData: ResumeData, accessToken: string) => { // Memoize
    try {
      setIsCalculatingScore(true);
      
      // EDENAI ONLY: Skip OpenRouter scoring - just process the resume directly
      // const initialScore = await getDetailedResumeScore(resumeData, jobDescription, setIsCalculatingScore);
      // setInitialResumeScore(initialScore);
      
      // DON'T set optimizedResume here - it causes mobile interface to show before optimization
      // setOptimizedResume(resumeData); // REMOVED - was causing mobile to skip optimization
      setParsedResumeData(resumeData);
      
      if (selectedOptimizationTierRef.current === 'quick') {
        await proceedWithFinalOptimization(resumeData, null as any, accessToken);
      } else if (resumeData.projects && resumeData.projects.length > 0) {
        setShowProjectAnalysis(true);
      } else {
        // Pass null for initialScore since we're not using OpenRouter scoring
        await proceedWithFinalOptimization(resumeData, null as any, accessToken);
      }
    } catch (error) {
      console.error('Error in initial resume processing:', error);
      alert('Failed to process resume. Please try again.');
    } finally {
      setIsCalculatingScore(false);
    }
  }, [jobDescription, proceedWithFinalOptimization]); // Dependencies for memoized function

 const continueOptimizationProcess = useCallback(async (resumeData: ResumeData, accessToken: string) => { // Memoize
  // Quick Scan is diagnostic and must never force users through data-entry.
  const missing = selectedOptimizationTierRef.current === 'quick'
    ? []
    : checkForMissingSections(resumeData);

  // If missing sections, show modal and STOP processing
  if (missing.length > 0) {
    setMissingSections(missing);
    setPendingResumeData(resumeData);
    setShowMissingSectionsModal(true);
    setIsOptimizing(false);
    return; // IMPORTANT: Stop here, don't proceed with optimization
  }

  // Only proceed with optimization if no missing sections
  try {
    await handleInitialResumeProcessing(resumeData, accessToken);
  } catch (error) {
    console.error('Error in optimization process:', error);
    alert('Failed to continue optimization. Please try again.');
    setIsOptimizing(false);
  }
}, [handleInitialResumeProcessing, checkForMissingSections]); // Dependencies for memoized function


  const handleMissingSectionsProvided = useCallback(async (data: any) => {
    setIsProcessingMissingSections(true);
    try {
      if (!pendingResumeData) {
        throw new Error('No pending resume data to update.');
      }
      
      // Start with the pending resume data
      let updatedResume: ResumeData = {
        ...pendingResumeData,
        ...(data.workExperience && data.workExperience.length > 0 && { workExperience: data.workExperience }),
        ...(data.projects && data.projects.length > 0 && { projects: data.projects }),
        ...(data.skills && data.skills.length > 0 && { skills: data.skills }),
        ...(data.education && data.education.length > 0 && { education: data.education }),
        ...(data.certifications && data.certifications.length > 0 && { certifications: data.certifications }),
        ...(data.summary && { summary: data.summary }),
        ...(data.contactDetails && {
          name: data.contactDetails.name || pendingResumeData.name,
          phone: data.contactDetails.phone || pendingResumeData.phone,
          email: data.contactDetails.email || pendingResumeData.email,
          linkedin: data.contactDetails.linkedin || pendingResumeData.linkedin,
          github: data.contactDetails.github || pendingResumeData.github
        })
      };
      
      // Handle work experience dates (when only dates were missing)
      if (data.workExperienceDates && Object.keys(data.workExperienceDates).length > 0) {
        // Update existing work experience entries with the provided dates
        if (updatedResume.workExperience) {
          updatedResume.workExperience = updatedResume.workExperience.map(exp => {
            // Find matching date by role or company name
            const expKey = exp.role || exp.company || '';
            const matchingDate = data.workExperienceDates[expKey];
            
            if (matchingDate && (!exp.year || exp.year.trim() === '')) {
              return { ...exp, year: matchingDate };
            }
            return exp;
          });
        }
      }
      
      setShowMissingSectionsModal(false);
      setMissingSections([]);
      setPendingResumeData(null);
      setIsOptimizing(false);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token || '';
      await handleInitialResumeProcessing(updatedResume, accessToken);
    } catch (error) {
      console.error('Error processing missing sections:', error);
      alert('Failed to process the provided information. Please try again.');
    } finally {
      setIsProcessingMissingSections(false);
    }
  }, [pendingResumeData, handleInitialResumeProcessing]);

  const handleOptimize = useCallback(async (requestedTier?: JdOptimizationTierId) => { // Memoize
    if (!extractionResult.text.trim() || !jobDescription.trim()) {
      alert('Please provide both resume content and job description');
      return;
    }
    if (!user) {
      alert('User information not available. Please sign in again.');
      onShowAuth();
      return;
    }

    // --- NEW: Input Length Validation ---
    const combinedInputLength = extractionResult.text.length + jobDescription.length;
    if (combinedInputLength > MAX_OPTIMIZER_INPUT_LENGTH) {
      alert(
        `Your combined resume and job description are too long (${combinedInputLength} characters). ` +
        `The maximum allowed is ${MAX_OPTIMIZER_INPUT_LENGTH} characters. Please shorten your input.`
      );
      return;
    }
    // --- END NEW ---

    if (!requestedTier) {
      try {
        const latestSubscription = await paymentService.getUserSubscription(user.id);
        const remainingCredits = latestSubscription
          ? Math.max(0, latestSubscription.optimizationsTotal - latestSubscription.optimizationsUsed)
          : 0;
        setAvailableOptimizationCredits(remainingCredits);
        setQualitySelectionError(null);
        setShowOptimizationQuality(true);
      } catch (creditError) {
        console.error('Failed to load optimization credit balance:', creditError);
        setAvailableOptimizationCredits(0);
        setQualitySelectionError('We could not load your credit balance. You can still choose a service and retry.');
        setShowOptimizationQuality(true);
      }
      return;
    }

    const qualityTier = getJdOptimizationTier(requestedTier);
    selectedOptimizationTierRef.current = requestedTier;

    // Clear any previous interruption state at the start of optimization attempt
    setOptimizationInterrupted(false);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        alert('Your session has expired. Please sign in again.');
        onShowAuth();
        return;
      }
      const session = refreshData.session;
      if (!session || !session.access_token) {
        alert('Your session has expired. Please sign in again.');
        onShowAuth();
        return;
      }
      const latestUserSubscription = await paymentService.getUserSubscription(user.id);
      const remainingCredits = getOptimizationTierRemaining(latestUserSubscription, qualityTier.id);
      if (remainingCredits < qualityTier.creditCost) {
        setAvailableOptimizationCredits(remainingCredits);
        setQualitySelectionError(
          `${qualityTier.name} requires ${qualityTier.creditCost} ${qualityTier.creditCost === 1 ? 'credit' : 'credits'}. Choose a service to continue.`,
        );
        setShowOptimizationQuality(true);
        return;
      }
      setIsOptimizing(true);
      try {
        // ⬇️ EDENAI ONLY: Use EdenAI parsed resume - no OpenRouter fallback
        let baseResume: ResumeData;

        // parsedResumeData is the canonical state for both freshly uploaded and
        // user-completed resumes, so old parser data cannot reopen the same form.
        if (parsedResumeData) {
          baseResume = parsedResumeData;
        } else {
          // No parsed resume available - user needs to upload first
          alert('Please upload your resume first. The AI parser will extract your information.');
          setIsOptimizing(false);
          return;
        }

        await continueOptimizationProcess(baseResume, session.access_token);
      } catch (error: any) {
        console.error('Error optimizing resume:', error);
        alert('Failed to optimize resume. Please try again.');
      } finally {
        setIsOptimizing(false);
      }
    } catch (error: any) {
      console.error('Error during session validation or subscription check:', error);
      alert(`An error occurred: ${error.message || 'Failed to validate session or check subscription.'}`);
      setIsOptimizing(false);
    }
  }, [
    extractionResult,
    jobDescription,
    user, // Keep user as a dependency
    onShowAuth,
    userSubscription, // Keep userSubscription as a dependency for the useEffect below
    userType,
    userName,
    userEmail,
    userPhone,
    userLinkedin,
    userGithub,
    targetRole,
    checkForMissingSections,
    continueOptimizationProcess,
    parsedResumeData, // ⬅️ added dependency because we branch on it
  ]); // Dependencies for memoized function

  useEffect(() => {
    setToolProcessTrigger(() => handleOptimize);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, handleOptimize]);

  const handleOptimizationQualityChoice = useCallback(async (
    tierId: JdOptimizationTierId,
    packageSize: JdOptimizationPackageSize,
  ) => {
    if (!user || processingQualityTier || qualitySelectionLockRef.current) return;
    qualitySelectionLockRef.current = true;

    const tier = getJdOptimizationTier(tierId);
    const optimizationPackage = getJdOptimizationPackage(tierId, packageSize);
    setQualitySelectionError(null);
    setProcessingQualityTier(tierId);

    try {
      const latestSubscription = await paymentService.getUserSubscription(user.id);
      const remainingCredits = getOptimizationTierRemaining(latestSubscription, tierId);
      setAvailableOptimizationCredits(remainingCredits);

      if (remainingCredits >= tier.creditCost) {
        selectedOptimizationTierRef.current = tierId;
        setShowOptimizationQuality(false);
        await handleOptimize(tierId);
        return;
      }

      const addOn = paymentService.getAddOnById(optimizationPackage.addOnId);
      if (
        !addOn ||
        Number(addOn.price) !== optimizationPackage.offerPrice ||
        Number(addOn.quantity) !== optimizationPackage.credits
      ) {
        throw new Error(`${tier.name} is temporarily unavailable because its payment configuration is out of sync.`);
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const purchaseResult = await paymentService.processPayment(
        {
          planId: 'addon_only_purchase',
          amount: optimizationPackage.offerPrice * 100,
          currency: 'INR',
        },
        userEmail,
        userName,
        session.access_token,
        undefined,
        0,
        optimizationPackage.offerPrice * 100,
        { [optimizationPackage.addOnId]: optimizationPackage.credits },
      );

      if (!purchaseResult.success) {
        throw new Error(purchaseResult.error || 'Payment was not completed. Please try again.');
      }

      await refreshUserSubscription();
      const refreshedSubscription = await paymentService.getUserSubscription(user.id);
      const refreshedCredits = getOptimizationTierRemaining(refreshedSubscription, tierId);
      setAvailableOptimizationCredits(refreshedCredits);

      if (refreshedCredits < tier.creditCost) {
        throw new Error('Payment succeeded, but the credits are still syncing. Please wait a moment and choose the service again.');
      }

      selectedOptimizationTierRef.current = tierId;
      setShowOptimizationQuality(false);
      setProcessingQualityTier(null);
      await handleOptimize(tierId);
    } catch (qualityError) {
      console.error('JD optimization quality selection failed:', qualityError);
      setQualitySelectionError(
        qualityError instanceof Error ? qualityError.message : 'Unable to start this optimization service.',
      );
    } finally {
      qualitySelectionLockRef.current = false;
      setProcessingQualityTier(null);
    }
  }, [handleOptimize, processingQualityTier, refreshUserSubscription, user, userEmail, userName]);

  useEffect(() => {
    // This useEffect should now primarily reset the flag, not re-trigger the process
    // The actual re-triggering will be handled by toolProcessTrigger from App.tsx
    if (
      optimizationInterrupted &&
      getOptimizationTierRemaining(userSubscription, selectedOptimizationTierRef.current) > 0
    ) {
      setOptimizationInterrupted(false); // Reset the flag
    }
  }, [optimizationInterrupted, refreshUserSubscription, userSubscription, handleOptimize]);

  const handleProjectMismatchResponse = useCallback(async (proceed: boolean) => { // Memoize
    setShowProjectMismatch(false);
    if (proceed) {
      setShowProjectOptions(true);
    } else {
      if (parsedResumeData && initialResumeScore) {
        const { data: sessionData } = await supabase.auth.getSession();
        await proceedWithFinalOptimization(parsedResumeData, initialResumeScore, sessionData?.session?.access_token || '');
      }
    }
  }, [parsedResumeData, initialResumeScore, proceedWithFinalOptimization]);

  const handleProjectOptionSelect = useCallback((option: 'manual' | 'ai') => { // Memoize
    setShowProjectOptions(false);
    if (option === 'manual') {
      setShowManualProjectAdd(true);
    } else {
      setShowProjectEnhancement(true);
    }
  }, []);

  const addTechToStack = useCallback(() => { // Memoize
    if (newTechStack.trim() && !manualProject.techStack.includes(newTechStack.trim())) {
      setManualProject(prev => ({ ...prev, techStack: [...prev.techStack, newTechStack.trim()] }));
      setNewTechStack('');
    }
  }, [newTechStack, manualProject.techStack]);

  const removeTechFromStack = useCallback((tech: string) => { // Memoize
    setManualProject(prev => ({ ...prev, techStack: prev.techStack.filter(t => t !== tech) }));
  }, []);

  const generateProjectDescription = useCallback(async (project: ManualProject, jd: string): Promise<string> => { // Memoize
    return `• Developed ${project.title} using ${project.techStack.join(', ')} technologies
• Implemented core features and functionality aligned with industry best practices
• Delivered scalable solution with focus on performance and user experience`;
  }, []);

  const handleManualProjectSubmit = useCallback(async () => { // Memoize
    if (!manualProject.title || manualProject.techStack.length === 0 || !parsedResumeData) {
      alert('Please provide project title and tech stack.');
      return;
    }
    setIsOptimizing(true);
    try {
      const projectDescriptionText = await generateProjectDescription(manualProject, jobDescription);
      const newProject = {
        title: manualProject.title,
        bullets: projectDescriptionText.split('\n').filter(line => line.trim().startsWith('•')).map(line => line.replace('•', '').trim()),
        githubUrl: ''
      };
      const updatedResume = { ...parsedResumeData, projects: [...(parsedResumeData.projects || []), newProject] };
      setShowManualProjectAdd(false);
      const { data: sessionData } = await supabase.auth.getSession();
      // EDENAI ONLY: Skip OpenRouter scoring, proceed directly
      await proceedWithFinalOptimization(updatedResume, null as any, sessionData?.session?.access_token || '');
    } catch (error) {
      console.error('Error creating manual project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsOptimizing(false);
    }
  }, [manualProject, parsedResumeData, generateProjectDescription, jobDescription, initialResumeScore, proceedWithFinalOptimization]); // Dependencies for memoized function

  const generateScoresAfterProjectAdd = useCallback(async (updatedResume: ResumeData, accessToken: string) => { // Memoize
    try {
      setIsCalculatingScore(true);
      await proceedWithFinalOptimization(updatedResume, null as any, accessToken);
    } catch (error) {
      console.error('Error generating scores after project add:', error);
      alert('Failed to generate updated scores. Please try again.');
    } finally {
      setIsCalculatingScore(false);
    }
  }, [proceedWithFinalOptimization]); // Dependencies for memoized function - removed jobDescription since we use ref

  const handleProjectsUpdated = useCallback(async (updatedResumeData: ResumeData) => { // Memoize
    try {
      // Close the project analysis modal first
      setShowProjectAnalysis(false);
      
      // Store parsed data but DON'T set optimizedResume yet - let proceedWithFinalOptimization do that
      // This prevents mobile interface from rendering before optimization completes
      setParsedResumeData(updatedResumeData);
      
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (initialResumeScore) {
        await proceedWithFinalOptimization(updatedResumeData, initialResumeScore, sessionData?.session?.access_token || '');
      } else {
        await generateScoresAfterProjectAdd(updatedResumeData, sessionData?.session?.access_token || '');
      }
    } catch (error) {
      console.error('Error in handleProjectsUpdated:', error);
      setShowProjectAnalysis(false); // Close modal even on error
    }
  }, [initialResumeScore, proceedWithFinalOptimization, generateScoresAfterProjectAdd]); // Dependencies for memoized function

  const handleSubscriptionSuccess = useCallback(() => { // Memoize
    checkSubscriptionStatus();
    onShowPlanSelection();
    setWalletRefreshKey(prevKey => prevKey + 1);
  }, [checkSubscriptionStatus, onShowPlanSelection]); // Dependencies for memoized function

  const handleZoomIn = useCallback(() => {
    setPreviewZoom(prev => Math.min(prev + 0.1, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setPreviewZoom(prev => Math.max(prev - 0.1, MIN_ZOOM));
  }, []);

  const handleFitWidth = useCallback(() => {
    setPreviewZoom(1.4);
  }, []);

  const handleFullScreen = useCallback(() => {
    setShowFullScreenPreview(true);
  }, []);

  const handleExportFile = useCallback(async (options: ExportOptions, format: 'pdf' | 'word') => {
    if (!optimizedResume) return;
    
    if (format === 'pdf') {
      if (isExportingPDF || isExportingWord) return;
      setIsExportingPDF(true);
    } else {
      if (isExportingWord || isExportingPDF) return;
      setIsExportingWord(true);
    }
    
    setExportStatus({ type: null, status: null, message: '' });
    
    try {
      if (format === 'pdf') {
        await exportToPDF(optimizedResume, userType, options);
      } else {
        await exportToWord(optimizedResume, userType);
      }
      
      setExportStatus({
        type: format,
        status: 'success',
        message: `${format.toUpperCase()} exported successfully!`
      });
      
      setTimeout(() => {
        setExportStatus({ type: null, status: null, message: '' });
      }, 3000);
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      setExportStatus({
        type: format,
        status: 'error',
        message: `${format.toUpperCase()} export failed. Please try again.`
      });
      
      setTimeout(() => { setExportStatus({ type: null, status: null, message: '' }); }, 5000);
    } finally {
      if (format === 'pdf') {
        setIsExportingPDF(false);
      } else {
        setIsExportingWord(false);
      }
    }
  }, [optimizedResume, userType, isExportingPDF, isExportingWord]);

  // Show mobile interface only when on mobile screen AND resume is optimized AND no modals are open
  // Important: Don't show mobile interface if project analysis or other modals need to be shown
  if (isMobileView && optimizedResume && !showProjectAnalysis && !showMissingSectionsModal && !showProjectEnhancement) {
    const mobileSections = [
      {
        id: 'resume',
        title: selectedOptimizationTierRef.current === 'quick' ? 'Resume' : 'Optimized Resume',
        icon: <FileText className="w-5 h-5" />,
        component: (
          <ResumePreview
            resumeData={optimizedResume}
            userType={userType}
            exportOptions={exportOptions}
            defaultZoom={0.98}
          />
        ),
        resumeData: optimizedResume,
        userType: userType
      }
    ];
    return (
      <>
        <MobileOptimizedInterface
          sections={mobileSections}
          onStartNewResume={handleStartNewResume}
          exportOptions={exportOptions}
          jobContext={jobContext}
          onApplyNow={() => handleExternalApply(optimizedResume)}
          jdOptimizationResult={jdOptimizationResult}
          scoreSummaryOverride={optimizationScoreSummary}
          parameter16Scores={parameter16Scores}
          onEditResume={() => setEditorMode('edit')}
          onExportResume={() => setShowExportModal(true)}
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          optimizationTier={selectedOptimizationTierRef.current}
          resumeEditor={
            <ResumeEditor
              resumeData={optimizedResume}
              onUpdate={(updated) => setOptimizedResume(updated)}
            />
          }
        />
        <ExportResumeModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          resumeData={optimizedResume}
          userType={userType}
        />
      </>
    );
  }

  if (isOptimizing || isCalculatingScore || isProcessingMissingSections) {
    let loadingMessage = 'Optimizing Your Resume...';
    let submessage = 'Please wait while our AI analyzes your resume and job description to generate the best possible match.';
    if (isCalculatingScore) {
      loadingMessage = 'OPTIMIZING RESUME...';
      submessage = 'Our AI is evaluating your resume based on comprehensive criteria.';
    } else if (isProcessingMissingSections) {
      loadingMessage = 'Processing Your Information...';
      submessage = "We're updating your resume with the new sections you provided.";
    }
    return <LoadingAnimation message={loadingMessage} submessage={submessage} />;
  }
  return (
   <div className={`min-h-screen relative overflow-hidden pb-16 lg:pl-16 ${
      isChristmasMode
        ? 'bg-gradient-to-b from-[#1a0a0f] via-[#0f1a0f] to-[#020617]'
        : 'bg-gradient-to-b from-slate-900 via-slate-950 to-[#020617]'
    }`}>
      {/* Radial Glow Overlay - Subtle professional effect */}
      <div className={`pointer-events-none absolute inset-0 ${
        isChristmasMode
          ? 'bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(34,197,94,0.08),transparent_50%)]'
          : 'bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.08),transparent_50%)]'
      }`} />

      {/* Floating Particles */}
      <FloatingParticles count={15} />

      {/* Christmas Snow */}
      {isChristmasMode && <ChristmasSnow count={40} />}

      <div className="container-responsive py-8 relative z-10">
        {!optimizedResume ? (
          <>
            <button
              onClick={() => jobContext?.fromJobApplication && jobContext.jobId ? navigate(`/jobs/${jobContext.jobId}/apply`) : navigate('/')}
              className="lg:hidden mb-6 bg-gradient-to-r from-neon-cyan-500 to-neon-blue-500 text-white hover:from-neon-cyan-400 hover:to-neon-blue-400 active:from-neon-cyan-600 active:to-neon-blue-600 shadow-md hover:shadow-neon-cyan py-3 px-5 rounded-xl inline-flex items-center space-x-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:block">{jobContext?.fromJobApplication ? 'Back to Job' : 'Back to Home'}</span>
            </button>

            {jobContext?.fromJobApplication && jobContext.roleTitle && jobContext.companyName && (
              <div className="mb-6 bg-gradient-to-r from-cyan-900/30 via-blue-900/30 to-blue-900/40 rounded-2xl p-6 border-2 border-cyan-500/30 shadow-xl backdrop-blur-sm">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-100">Optimizing Resume For:</h3>
                      <span className="bg-gradient-to-r from-yellow-400 to-orange-400 px-3 py-1 rounded-full text-xs font-bold text-gray-900 shadow-md">
                        JOB-SPECIFIC
                      </span>
                    </div>
                    <p className="text-xl font-semibold text-cyan-300">{jobContext.roleTitle}</p>
                    <p className="text-sm text-slate-400 flex items-center space-x-1 mt-1">
                      <Building2 className="w-4 h-4" />
                      <span>{jobContext.companyName}</span>
                    </p>
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-xs text-cyan-300 bg-cyan-500/20 px-2 py-1 rounded-full border border-cyan-500/30">
                        <Target className="w-3 h-3" />
                        <span>Tailored optimization</span>
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full border border-blue-500/30">
                        <Zap className="w-3 h-3" />
                        <span>ATS-optimized</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isAuthenticated && !loadingSubscription && (
              <div className="relative mb-8 z-10 flex flex-wrap items-center justify-center gap-2">
                {userSubscription ? (
                  <>
                    <span className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-sm sm:text-sm">
                      Quick Scan: {getOptimizationTierRemaining(userSubscription, 'quick')}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-sm sm:text-sm">
                      Smart Optimize: {getOptimizationTierRemaining(userSubscription, 'smart')}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-violet-300/20 bg-violet-400/10 px-4 py-2 text-xs font-semibold text-violet-200 shadow-sm sm:text-sm">
                      Deep Optimize: {getOptimizationTierRemaining(userSubscription, 'deep')}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-300">No optimization credits</span>
                )}
              </div>
            )}

            <div className="max-w-7xl mx-auto space-y-6">
              <InputWizard
                extractionResult={extractionResult}
                setExtractionResult={setExtractionResult}
                scoringMode={scoringMode}
                setScoringMode={setScoringMode}
                autoScoreOnUpload={autoScoreOnUpload}
                setAutoScoreOnUpload={setAutoScoreOnUpload}
                jobDescription={jobDescription}
                setJobDescription={setJobDescription}
                targetRole={targetRole}
                setTargetRole={setTargetRole}
                userType={userType}
                setUserType={setUserType}
                handleOptimize={handleOptimize}
                isAuthenticated={isAuthenticated}
                onShowAuth={onShowAuth}
                user={user}
                onShowProfile={onShowProfile}
                onParsedResume={setParsedResumeData}
                onCreditCheckPassed={() => {
                  // Credits available after upload - user still needs to fill JD and click optimize
                }}
              />
            </div>
          </>
        ) : (
          <div className="max-w-7xl mx-auto">
            {jobContext?.fromJobApplication && jobContext.jobId && (
              <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30 shadow-lg mb-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-xl font-bold text-white">
                          {selectedOptimizationTierRef.current === 'quick' ? 'Quick Scan Completed!' : 'Resume Optimized Successfully!'}
                        </h3>
                        <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                          {selectedOptimizationTierRef.current === 'quick' ? 'ANALYZED' : 'READY'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">
                        Your resume has been {selectedOptimizationTierRef.current === 'quick' ? 'analyzed' : 'optimized'} for <span className="font-semibold text-emerald-400">{jobContext.roleTitle}</span> at <span className="font-semibold text-emerald-400">{jobContext.companyName}</span>
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-slate-400">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>{selectedOptimizationTierRef.current === 'quick' ? 'JD gaps reviewed' : 'ATS-optimized'}</span>
                        <span>•</span>
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>{selectedOptimizationTierRef.current === 'quick' ? 'Resume unchanged' : 'Keyword-matched'}</span>
                        <span>•</span>
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>{selectedOptimizationTierRef.current === 'quick' ? 'Ready to review' : 'Ready to download'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExternalApply(optimizedResume)}
                    className="group flex-shrink-0 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white px-6 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 transition-all duration-300 flex items-center space-x-3"
                  >
                    <Send className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    <span>Apply Now</span>
                  </button>
                </div>
                {selectedOptimizationTierRef.current !== 'quick' && <div className="mt-4 bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
                  <p className="text-xs text-slate-400 flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Make sure to download your optimized resume before applying for future reference</span>
                  </p>
                </div>}
              </div>
            )}

            {optimizedResume && selectedOptimizationTierRef.current !== 'quick' && (
              <div className="flex items-start gap-3 p-4 rounded-xl border mb-2"
                style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.3)' }}>
                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-200 leading-relaxed">
                  <span className="font-semibold">Download your resume before closing this page.</span>{' '}
                  If you close or navigate away, your optimized resume will not be recoverable. Use the <span className="font-semibold">Export Resume</span> button to save it now.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <button
                onClick={handleStartNewResume}
                className="inline-flex items-center space-x-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 hover:border-emerald-500/30 text-white font-semibold py-2 px-4 rounded-xl shadow-lg transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Create New Resume</span>
              </button>

              <div className="flex items-center bg-slate-800/60 rounded-xl border border-slate-700/50 p-1">
                <button
                  onClick={() => setEditorMode('preview')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    editorMode === 'preview'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
                <button
                  onClick={() => setEditorMode('edit')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    editorMode === 'edit'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  Edit Resume
                </button>
              </div>
            </div>

            {optimizedResume && editorMode === 'edit' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2">
                  <ResumeEditor
                    resumeData={optimizedResume}
                    onUpdate={(updated) => setOptimizedResume(updated)}
                  />
                </div>

                <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
                  <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 p-4 border-b border-slate-700/50">
                      <h2 className="text-lg font-semibold text-white flex items-center">
                        <Eye className="w-4 h-4 mr-2 text-emerald-400" />
                        Live Preview
                      </h2>
                    </div>
                    <div className="bg-slate-800/20 p-3 flex items-center justify-center" style={{ minHeight: '400px' }}>
                      <div className="transform-gpu" style={{ transform: 'scale(0.55)', transformOrigin: 'top center' }}>
                        <ResumePreview
                          resumeData={optimizedResume}
                          userType={userType}
                          exportOptions={exportOptions}
                          showControls={false}
                          defaultZoom={0.98}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowExportModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300"
                  >
                    <Download className="w-5 h-5" />
                    Export Resume
                  </button>
                </div>
              </div>
            )}

            {optimizedResume && editorMode === 'preview' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 space-y-5">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowExportModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300"
                    >
                      <Download className="w-5 h-5" />
                      Export Resume
                    </button>
                    <button
                      onClick={() => setEditorMode('edit')}
                      className="flex items-center justify-center gap-2 px-5 py-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600/50 hover:border-emerald-500/30 text-white font-semibold rounded-xl transition-all duration-300"
                    >
                      <Pencil className="w-4 h-4 text-emerald-400" />
                      Edit
                    </button>
                  </div>

                  {jdOptimizationResult && (
                    <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700/50 overflow-hidden p-5">
                      <ScoreDeltaDisplay
                        result={jdOptimizationResult}
                        userActionCards={jdOptimizationResult.gapClassification.userActionCards}
                        scoreSummaryOverride={optimizationScoreSummary || undefined}
                        mode={selectedOptimizationTierRef.current === 'quick' ? 'scan' : 'comparison'}
                      />
                    </div>
                  )}

                  {optimizedResume && showMissingProfile && (
                    <MissingProfilePrompt
                      resumeData={optimizedResume}
                      onDismiss={() => setShowMissingProfile(false)}
                    />
                  )}

                  {!jdOptimizationResult && parameter16Scores && (
                    <Parameter16ScoreDisplay
                      beforeScores={parameter16Scores.beforeScores}
                      afterScores={parameter16Scores.afterScores}
                      overallBefore={parameter16Scores.overallBefore}
                      overallAfter={parameter16Scores.overallAfter}
                      improvement={parameter16Scores.improvement}
                      compact={true}
                      mode={selectedOptimizationTierRef.current === 'quick' ? 'scan' : 'comparison'}
                    />
                  )}
                </div>

                <div className="lg:col-span-3 lg:sticky lg:top-6 lg:self-start space-y-4">
                  <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
                    <ResumePreviewControls
                      zoom={previewZoom}
                      onZoomIn={handleZoomIn}
                      onZoomOut={handleZoomOut}
                      onFitWidth={handleFitWidth}
                      onFullScreen={handleFullScreen}
                      minZoom={MIN_ZOOM}
                      maxZoom={MAX_ZOOM}
                    />
                    <div className="bg-slate-800/20 p-4 flex items-center justify-center" style={{ minHeight: '600px' }}>
                      <div
                        className="transform-gpu"
                        style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}
                      >
                        <ResumePreview
                          resumeData={optimizedResume}
                          userType={userType}
                          exportOptions={exportOptions}
                          showControls={false}
                          defaultZoom={0.98}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showProjectMismatch && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Project Mismatch Detected</h2>
                <p className="text-gray-600">
                  Your current projects don't align well with the job description. Would you like to add a relevant project to improve your resume score?
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 mb-1">{initialResumeScore?.totalScore}/100</div>
                  <div className="text-sm text-red-700">Current Resume Score</div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button onClick={() => handleProjectMismatchResponse(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors">
                  Yes, Add Project
                </button>
                <button onClick={() => handleProjectMismatchResponse(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors">
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjectOptions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Choose Project Addition Method</h2>
                <p className="text-gray-600">How would you like to add a relevant project to your resume?</p>
              </div>
              <div className="space-x-3">
                <button onClick={() => handleProjectOptionSelect('manual')} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Manual Add - I'll provide project details</span>
                </button>
                <button onClick={() => handleProjectOptionSelect('ai')} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>AI-Suggested - Generate automatically</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showManualProjectAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Add Project Manually</h2>
                <p className="text-gray-600">Provide project details and AI will generate a professional description</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                  <input
                    type="text"
                    value={manualProject.title}
                    onChange={(e) => setManualProject(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., E-commerce Website"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                    <input
                      type="month"
                      value={manualProject.startDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                    <input
                      type="month"
                      value={manualProject.endDate}
                      onChange={(e) => setManualProject(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tech Stack *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTechStack}
                      onChange={(e) => setNewTechStack(e.target.value)}
                      placeholder="e.g., React, Node.js"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      onKeyDown={(e) => e.key === 'Enter' && addTechToStack()}
                    />
                    <button
                      onClick={addTechToStack}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {manualProject.techStack.map((tech, index) => (
                      <span key={index} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                        {tech}
                        <button onClick={() => removeTechFromStack(tech)} className="ml-2 text-green-600 hover:text-green-800">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">One-liner Description (Optional)</label>
                  <input
                    type="text"
                    value={manualProject.oneLiner}
                    onChange={(e) => setManualProject(prev => ({ ...prev, oneLiner: e.target.value }))}
                    placeholder="Brief description of the project"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleManualProjectSubmit}
                  disabled={!manualProject.title || manualProject.techStack.length === 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                >
                  Generate & Add Project
                </button>
                <button onClick={() => setShowManualProjectAdd(false)} className="px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-700 font-semibold rounded-xl transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProjectEnhancement
        isOpen={showProjectEnhancement}
        onClose={() => setShowProjectEnhancement(false)}
        currentResume={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        jobDescription={jobDescription}
        onProjectsAdded={handleProjectsUpdated}
      />

      <ProjectAnalysisModal
        isOpen={showProjectAnalysis}
        onClose={() => setShowProjectAnalysis(false)}
        resumeData={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        jobDescription={jobDescription}
        targetRole={targetRole}
        onProjectsUpdated={handleProjectsUpdated}
      />

      {/* NEW: Project Matching Panel with GitHub Suggestions */}
      <ProjectMatchingPanel
        isOpen={showProjectMatchingPanel}
        onClose={() => setShowProjectMatchingPanel(false)}
        resumeData={parsedResumeData || optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        jobDescription={jobDescription}
        jdSummary={jdSummary}
        onContinue={() => {
          setShowProjectMatchingPanel(false);
          // Continue with optimization after viewing project analysis
        }}
      />

      <MissingSectionsModal
        isOpen={showMissingSectionsModal}
        onClose={() => {
          setShowMissingSectionsModal(false);
          setMissingSections([]);
          setPendingResumeData(null);
          setIsOptimizing(false);
        }}
        missingSections={missingSections}
        currentResumeData={pendingResumeData}
        onSectionsProvided={handleMissingSectionsProvided}
      />

      <OptimizationQualityModal
        isOpen={showOptimizationQuality}
        processingTier={processingQualityTier}
        error={qualitySelectionError}
        onClose={() => {
          if (!processingQualityTier) {
            setShowOptimizationQuality(false);
            setQualitySelectionError(null);
          }
        }}
        onChoose={handleOptimizationQualityChoice}
      />

      <FullScreenPreviewModal
        isOpen={showFullScreenPreview}
        onClose={() => setShowFullScreenPreview(false)}
        resumeData={optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        userType={userType}
        exportOptions={exportOptions}
      />

      <ExportResumeModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        resumeData={optimizedResume || { name: '', phone: '', email: '', linkedin: '', github: '', education: [], workExperience: [], projects: [], skills: [], certifications: [] }}
        userType={userType}
      />
    </div>
  );
};

export default ResumeOptimizer;
