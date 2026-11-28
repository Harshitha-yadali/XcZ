// src/components/ResumeScoreChecker.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Eye,
  Loader2,
  Shield,
  Target,
  AlertTriangle,
} from 'lucide-react';

import { FileUpload } from './FileUpload';
import { ATSScoreChecker16Parameter, ATSScore16Parameter } from '../services/atsScoreChecker16Parameter';
import { ScoringMode, ExtractionResult } from '../types/resume';
import { ParsedResume } from '../services/geminiResumeParserService';
import { ScoreCheckerHandoff, saveScoreCheckerHandoff } from '../utils/scoreCheckerHandoff';
import type { Subscription } from '../types/payment';
import { paymentService } from '../services/paymentService';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Seo } from '../seo/Seo';
import type { PremiumScoreResult } from '../services/premiumScoreEngine';
import { PremiumResultsDashboard } from './score/PremiumResultsDashboard';

interface VisibleScoreParameter {
  key: string;
  name: string;
  score: number;
  maxScore: number;
  percentage: number;
  evidence: string[];
  applicable: boolean;
}

const getVisibleScoreParameters = (result: ATSScore16Parameter): VisibleScoreParameter[] => {
  if (result.canonicalParameters?.length) {
    return result.canonicalParameters.map(parameter => ({
      key: `canonical-${parameter.id}`,
      name: parameter.name,
      score: parameter.score,
      maxScore: parameter.maxScore,
      percentage: parameter.percentage,
      evidence: parameter.evidence || [],
      applicable: parameter.applicable !== false,
    }));
  }

  const maxScores: Record<string, number> = {
    keywordMatch: 25, skillsAlignment: 20, experienceRelevance: 15,
    technicalCompetencies: 12, educationScore: 10, quantifiedAchievements: 8,
    employmentHistory: 8, industryExperience: 7, jobTitleMatch: 6,
    careerProgression: 6, certifications: 5, formatting: 5,
    contentQuality: 4, grammar: 3, resumeLength: 2, filenameQuality: 2,
  };
  const displayNames: Record<string, string> = {
    keywordMatch: 'Keyword Match', skillsAlignment: 'Skills Alignment',
    experienceRelevance: 'Experience Relevance', technicalCompetencies: 'Technical Competencies',
    educationScore: 'Education Score', quantifiedAchievements: 'Quantified Achievements',
    employmentHistory: 'Employment History', industryExperience: 'Industry Experience',
    jobTitleMatch: 'Job Title Match', careerProgression: 'Career Progression',
    certifications: 'Certifications', formatting: 'Formatting',
    contentQuality: 'Content Quality', grammar: 'Grammar',
    resumeLength: 'Resume Length', filenameQuality: 'Filename Quality',
  };

  return Object.entries(result.scores).map(([key, score]) => {
    const maxScore = maxScores[key] || 5;
    return {
      key,
      name: displayNames[key] || key,
      score,
      maxScore,
      percentage: (score / maxScore) * 100,
      evidence: [],
      applicable: true,
    };
  });
};

const getScoreBand = (score: number) =>
  score >= 80
    ? { label: 'Strong match', note: 'Likely to pass ATS screening for this job.', text: 'text-emerald-400', stroke: 'stroke-emerald-400', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' }
    : score >= 60
      ? { label: 'Fair match', note: 'A few gaps could get you filtered out.', text: 'text-amber-400', stroke: 'stroke-amber-400', chip: 'bg-amber-500/15 text-amber-300 border-amber-400/30' }
      : { label: 'Needs work', note: 'Likely filtered by ATS before a recruiter sees it.', text: 'text-red-400', stroke: 'stroke-red-400', chip: 'bg-red-500/15 text-red-300 border-red-400/30' };

const barColor = (percentage: number) =>
  percentage >= 80 ? 'bg-emerald-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-red-500';

interface TopIssue {
  key: string;
  title: string;
  detail: string;
  scoreLabel?: string;
}

// Most impactful first: canonical checks below 80%, ordered by points lost.
// skipMandatorySkills: check 8 is already shown as the "Missing key skills" card.
const getTopIssues = (result: ATSScore16Parameter, limit: number, skipMandatorySkills: boolean): TopIssue[] => {
  const weak = (result.canonicalParameters || []).filter(
    p => p.applicable !== false && p.percentage < 80 && !(skipMandatorySkills && p.id === 8),
  );
  if (weak.length) {
    return weak
      .map(p => ({
        lost: (p.weightedMaxPoints ?? p.maxScore) - (p.earnedPoints ?? p.score),
        issue: {
          key: `issue-${p.id}`,
          title: p.name,
          detail: p.suggestions[0] || '',
          scoreLabel: `${p.score}/${p.maxScore}`,
        },
      }))
      .sort((a, b) => b.lost - a.lost)
      .slice(0, limit)
      .map(entry => entry.issue);
  }
  return result.areasToImprove.slice(0, limit).map((rec, index) => ({ key: `rec-${index}`, title: rec, detail: '' }));
};

const LOADING_STEPS = ['Reading your resume', 'Matching it to the job', 'Scoring 30 ATS checks'];
const loadingStepIndex = (step: string) =>
  step.startsWith('Scoring') ? 2 : step.startsWith('Comparing') ? 1 : 0;

const USER_TYPES = [
  { id: 'fresher', label: 'Fresher', hint: '0-2 yrs' },
  { id: 'experienced', label: 'Experienced', hint: '2+ yrs' },
  { id: 'student', label: 'Student', hint: 'Studying' },
] as const;

const cardClass = 'rounded-2xl border border-white/[0.08] bg-white/[0.03]';
const inputClass = 'w-full rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-base text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40';

interface ResumeScoreCheckerProps {
  onNavigateBack: () => void;
  isAuthenticated: boolean;
  onShowAuth: () => void;
  userSubscription: Subscription | null;
  onShowSubscriptionPlans: (featureId?: string) => void;
  onShowSubscriptionPlansDirectly?: () => void; // Direct subscription plans (skip plan selection modal)
  onShowAlert: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
  refreshUserSubscription: () => Promise<void>;
  toolProcessTrigger: (() => void) | null;
  setToolProcessTrigger: React.Dispatch<React.SetStateAction<(() => void) | null>>;
}

export const ResumeScoreChecker: React.FC<ResumeScoreCheckerProps> = ({
  onNavigateBack,
  isAuthenticated,
  onShowAuth,
  userSubscription, // Keep this prop, but we'll fetch fresh data inside _analyzeResumeInternal
  onShowSubscriptionPlans,
  onShowSubscriptionPlansDirectly: _onShowSubscriptionPlansDirectly,
  onShowAlert, // This is the prop in question
  refreshUserSubscription,
  toolProcessTrigger: _toolProcessTrigger,
  setToolProcessTrigger,
}) => {
  // CRITICAL DEBUGGING STEP: Verify onShowAlert is a function immediately
  if (typeof onShowAlert !== 'function') {
    console.error('CRITICAL ERROR: onShowAlert prop is not a function or is undefined!', onShowAlert);
    // This will cause a React error, but it will confirm if the prop is truly missing at this point.
    throw new Error('onShowAlert prop is missing or invalid in ResumeScoreChecker');
  }

  const { user } = useAuth();
  const navigate = useNavigate();

  const location = useLocation();
  const [extractionResult, setExtractionResult] = useState<ExtractionResult>({ text: '', extraction_mode: 'TEXT', trimmed: false });
  const [parsedResumeData, setParsedResumeData] = useState<ParsedResume | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  // JD-based is the only scoring mode offered here, so start on it and skip the
  // one-option picker. 'general' still exists for GuidedResumeBuilder/InputWizard.
  const [scoringMode, setScoringMode] = useState<ScoringMode | null>('jd_based');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [scoreResult, setScoreResult] = useState<ATSScore16Parameter | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const [isOptimizedResume, setIsOptimizedResume] = useState(false); // Track if resume was optimized by JD optimizer
  const [userType, setUserType] = useState<'fresher' | 'experienced' | 'student' | null>(null); // Add user type selection

  const [analysisInterrupted, setAnalysisInterrupted] = useState(false);
  const [premiumResult, setPremiumResult] = useState<PremiumScoreResult | null>(null);

  // If we arrive from Job Details with state, prefill JD-based flow and jump to Step 1
  useEffect(() => {
    const state = (location.state || {}) as {
      jobDescription?: string;
      jobTitle?: string;
    };

    if (state.jobDescription || state.jobTitle) {
      setScoringMode('jd_based');
      setCurrentStep(1);
      if (state.jobDescription) setJobDescription(state.jobDescription);
      if (state.jobTitle) setJobTitle(state.jobTitle);
      
      // AUTO-DETECT user type from job description when coming from Job Details
      if (state.jobDescription) {
        const detectedUserType = detectUserTypeFromJD(state.jobDescription);
        setUserType(detectedUserType);
      }
    }
  }, [location.state]);




  // Renamed analyzeResume to _analyzeResumeInternal
  const _analyzeResumeInternal = useCallback(async () => {

    // Ensure user is available before attempting to fetch subscription
    if (!user?.id) {
      console.error('_analyzeResumeInternal: User ID not available, cannot proceed with analysis.');
      onShowAlert('Authentication Required', 'User data not fully loaded. Please try again or sign in.', 'error', 'Sign In', onShowAuth);
      return;
    }

    // Re-fetch subscription to get the latest state for decrementing usage
    const latestUserSubscription = await paymentService.getUserSubscription(user.id);
    if (!latestUserSubscription || (latestUserSubscription.scoreChecksTotal - latestUserSubscription.scoreChecksUsed) <= 0) {
      console.error('_analyzeResumeInternal: Credits unexpectedly exhausted during internal analysis. This should not happen if pre-check worked.');
      onShowAlert('Credits Exhausted', 'Your credits were used up before analysis could complete. Please upgrade.', 'error', 'Upgrade Plan', () => onShowSubscriptionPlans('score-checker'));
      setAnalysisInterrupted(true);
      return;
    }

    if (!extractionResult.text.trim()) {
      onShowAlert('Missing Resume', 'Please upload your resume first to get a score.', 'warning');
      return;
    }

    if (scoringMode === 'jd_based') {
      if (!jobDescription.trim()) {
        onShowAlert('Missing Job Description', 'Job description is required for JD-based scoring.', 'warning');
        return;
      }
      if (!jobTitle.trim()) {
        onShowAlert('Missing Job Title', 'Job title is required for JD-based scoring.', 'warning');
        return;
      }
    }

    setScoreResult(null);
    setIsAnalyzing(true);
    setLoadingStep('Extracting & cleaning your resume...');
    const scoreRunId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `score-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let creditReservationId: string | null = null;
    let creditFinalized = false;

    try {
      const reservation = await paymentService.reserveScoreCheck(user.id, scoreRunId);
      if (!reservation.success || !reservation.reservationId) {
        console.error('Failed to reserve score check credit:', reservation.error);
        onShowAlert('Credits Exhausted', 'No score credits available. Please upgrade.', 'error', 'Upgrade Plan', () => onShowSubscriptionPlans('score-checker'));
        setIsAnalyzing(false);
        setLoadingStep('');
        return;
      }
      creditReservationId = reservation.reservationId;
      await refreshUserSubscription();
      if (scoringMode === 'jd_based') {
        setLoadingStep(`Comparing with Job Title: ${jobTitle}...`);
      }
      
      setLoadingStep('Scoring across 30 evidence-backed ATS checks...');

      let result: ATSScore16Parameter;
      
      // Use the canonical JD scoring engine when a job description is provided.
      if (scoringMode === 'jd_based' && jobDescription.trim()) {
        if (!parsedResumeData) {
          throw new Error('The parsed resume is required for canonical JD scoring. Please upload the resume again.');
        }
        result = await ATSScoreChecker16Parameter.evaluateWithUnified16AndParsedData(
          extractionResult.text,
          jobDescription,
          parsedResumeData,
          jobTitle || undefined,
          userType || 'fresher',
        );
      } else {
        // Use legacy scoring for general mode
        result = await ATSScoreChecker16Parameter.evaluateResume(
          extractionResult.text,
          undefined,
          uploadedFilename || undefined,
          uploadedFile || undefined,
          true // Enable enhanced processing (OCR) if file is available
        );
      }
      
      // The canonical backend now owns both the official score and the visible
      // parameter breakdown. Do not mix in a second premium/legacy scorer.
      setPremiumResult(null);

      const finalized = await paymentService.finalizeCreditReservation(creditReservationId);
      if (!finalized.success) {
        throw new Error(finalized.error || 'Unable to finalize the reserved score-check usage.');
      }
      creditFinalized = true;
      await refreshUserSubscription();

      setScoreResult(result);
      setCurrentStep(2);
    } catch (error: any) {
      console.error('_analyzeResumeInternal: Error in try block:', error);
      if (creditReservationId && !creditFinalized) {
        const refund = await paymentService.refundCreditReservation(creditReservationId);
        if (!refund.success) {
          console.error('Failed to restore reserved score-check usage:', refund.error);
        } else {
          await refreshUserSubscription();
        }
      }
      onShowAlert('Analysis Failed', `Failed to analyze resume: ${error.message || 'Unknown error'}. Please try again.`, 'error');
    } finally {
      setIsAnalyzing(false);
      setLoadingStep('');
    }
  }, [extractionResult, parsedResumeData, jobDescription, jobTitle, scoringMode, isAuthenticated, onShowAuth, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription, user, uploadedFilename, isOptimizedResume, userType]);


  // New public function called by the button click
  const analyzeResume = useCallback(async () => {
    if (scoringMode === null) {
      onShowAlert('Choose a Scoring Method', 'Please select "Score Against a Job" to continue.', 'warning');
      return;
    }

    if (!isAuthenticated) {
      onShowAlert('Authentication Required', 'Please sign in to get your resume score.', 'error', 'Sign In', onShowAuth);
      return;
    }

    if (!user?.id) {
      onShowAlert('Authentication Required', 'User data not fully loaded. Please try again or sign in.', 'error', 'Sign In', onShowAuth);
      return;
    }

    if (!extractionResult.text.trim()) {
      onShowAlert('Missing Resume', 'Please upload your resume first to get a score.', 'warning');
      return;
    }

    if (scoringMode === 'jd_based') {
      if (!jobDescription.trim()) {
        onShowAlert('Missing Job Description', 'Job description is required for JD-based scoring.', 'warning');
        return;
      }
      if (!jobTitle.trim()) {
        onShowAlert('Missing Job Title', 'Job title is required for JD-based scoring.', 'warning');
        return;
      }
    }

    // --- Credit Check Logic ---
const currentSubscription = await paymentService.getUserSubscription(user.id);
const subscriptionCredits = currentSubscription
  ? currentSubscription.scoreChecksTotal - currentSubscription.scoreChecksUsed
  : 0;

const addOnCredits = await paymentService.getAddOnCreditsByType(user.id, 'score_check');
const totalCredits = Math.max(0, subscriptionCredits) + addOnCredits;
const hasScoreCheckCredits = totalCredits > 0;

const liteCheckPlan = paymentService.getPlanById("lite_check");
const hasFreeTrialAvailable =
  liteCheckPlan &&
  (!currentSubscription || currentSubscription.planId !== "lite_check");

if (hasScoreCheckCredits) {
  _analyzeResumeInternal();
} else if (hasFreeTrialAvailable) {
  onShowAlert(
    "Activating Free Trial",
    "Activating your free trial for Resume Score Check...",
    "info"
  );
  try {
    await paymentService.activateFreeTrial(user.id);
    await refreshUserSubscription();
    onShowAlert(
      "Free Trial Activated!",
      "Your free trial has been activated. Analyzing your resume now.",
      "success"
    );
    _analyzeResumeInternal();
  } catch (error: any) {
    onShowAlert(
      "Free Trial Activation Failed",
      "Failed to activate free trial: " + (error.message || "Unknown error"),
      "error"
    );
  }
} else {
  const planName = currentSubscription
    ? paymentService.getPlanById(currentSubscription.planId)?.name ||
      "your current plan"
    : "your account";

  let message = "";
  if (subscriptionCredits <= 0 && addOnCredits <= 0) {
    if (currentSubscription) {
      message = `You have used all your Resume Score Credits from ${planName}.`;
    } else {
      message = "You don't have any active plan or add-on credits for Resume Score Credits.";
    }
    message += " Please purchase credits or upgrade your plan to continue.";
  } else {
    message = "Your Resume Score Credits are exhausted. Please purchase more credits.";
  }

  onShowAlert(
    "Resume Score Credits Exhausted",
    message,
    "warning",
    "Get Credits",
    () => onShowSubscriptionPlans("score-checker")
  );

  setAnalysisInterrupted(true);
}

  }, [extractionResult, jobDescription, jobTitle, scoringMode, isAuthenticated, onShowAuth, onShowSubscriptionPlans, onShowAlert, refreshUserSubscription, user, _analyzeResumeInternal]); // Depend on _analyzeResumeInternal


  // The useEffect for re-triggering should remain as is, but now calls _analyzeResumeInternal with retries
  useEffect(() => {
    // Only attempt to re-trigger if analysis was interrupted and user is authenticated
    // AND if credits are now available.
    if (analysisInterrupted && isAuthenticated && userSubscription && (userSubscription.scoreChecksTotal - userSubscription.scoreChecksUsed) > 0) {
      setAnalysisInterrupted(false); // Reset the flag immediately

      let retryCount = 0;
      let delay = 500;
      const MAX_RETRIES_INTERNAL = 6; // Max retries for internal re-trigger

      const attemptAnalysis = async () => {
        while (retryCount < MAX_RETRIES_INTERNAL) {
          const latestSub = await paymentService.getUserSubscription(user!.id); // Re-fetch to be sure
          if (latestSub && (latestSub.scoreChecksTotal - latestSub.scoreChecksUsed) > 0) {
            _analyzeResumeInternal(); // Now call the internal analysis function
            return;
          }
          retryCount++;
          if (retryCount < MAX_RETRIES_INTERNAL) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
          }
        }
        console.error('ResumeScoreChecker: Failed to re-trigger analysis after purchase due to persistent credit check failure.');
        onShowAlert('Analysis Not Started', 'We could not confirm your new credits. Please try again manually.', 'error');
      };

      attemptAnalysis();
    }
  }, [analysisInterrupted, isAuthenticated, userSubscription, _analyzeResumeInternal, onShowAlert, user]); // Depend on _analyzeResumeInternal

  useEffect(() => {
    setToolProcessTrigger(() => analyzeResume);
    return () => {
      setToolProcessTrigger(null);
    };
  }, [setToolProcessTrigger, analyzeResume]);

  const handleFileUpload = (result: ExtractionResult, file?: File) => {
    setExtractionResult(result);
    setUploadedFile(file || null);
    setUploadedFilename(result.filename || null);
    
    // Auto-detect if resume was optimized by our JD Optimizer based on filename or content markers
    const filename = (result.filename || '').toLowerCase();
    const text = (result.text || '').toLowerCase();
    const isOptimized = 
      filename.includes('optimized') || 
      filename.includes('jd_optimized') ||
      filename.includes('jd-optimized') ||
      text.includes('<!-- jd_optimized -->') || // Hidden marker in exported resumes
      text.includes('origin: jd_optimized');
    setIsOptimizedResume(isOptimized);
  };
  
  const handleParsedResume = (parsedResume: ParsedResume | null) => {
    setParsedResumeData(parsedResume);
  };



  // Auto-detect user type from job description
  const detectUserTypeFromJD = (jobDescription: string): 'fresher' | 'experienced' | 'student' => {
    const jdLower = jobDescription.toLowerCase();
    
    // Check for explicit experience requirements (highest priority)
    const experiencePatterns = [
      /(\d+)\+?\s*years?\s*(of\s*)?(work\s*|software\s*development\s*)?experience/gi,
      /minimum\s*(\d+)\+?\s*years?/gi,
      /at\s*least\s*(\d+)\+?\s*years?/gi,
      /(\d+)\s*[-–to]\s*(\d+)\s*years?/gi,
      /(\d+)\+\s*years?/gi
    ];
    
    let minRequiredYears = 0;
    let hasExperienceRequirement = false;
    
    for (const pattern of experiencePatterns) {
      const matches = [...jdLower.matchAll(pattern)];
      if (matches.length > 0) {
        hasExperienceRequirement = true;
        matches.forEach(match => {
          const yearMatch = match[1];
          if (yearMatch) {
            const years = parseInt(yearMatch);
            if (years > minRequiredYears) {
              minRequiredYears = years;
            }
          }
        });
      }
    }
    
    // If JD explicitly requires 2+ years, it's experienced role
    if (hasExperienceRequirement && minRequiredYears >= 2) {
      return 'experienced';
    }
    
    // Check for strong fresher indicators
    const strongFresherKeywords = /fresher|entry.level|graduate\s+program|junior|0.1\s*year|new\s*grad|campus|intern|trainee|associate|no\s*experience|recent\s*graduate|freshers?\s+allowed/i;
    
    if (strongFresherKeywords.test(jdLower)) {
      return 'fresher';
    }
    
    // Check for student-specific keywords (higher priority than fresher)
    const studentKeywords = /internship|intern\s+position|student|academic|university|college|thesis|dissertation|summer\s+program/i;
    
    if (studentKeywords.test(jdLower)) {
      return 'student';
    }
    
    // Check for 0-2 years experience (should be fresher, not experienced)
    const lowExperiencePattern = /0\s*[-–to]\s*2\s*years?|1\s*[-–to]\s*2\s*years?/i;
    if (lowExperiencePattern.test(jdLower)) {
      return 'fresher';
    }
    
    // If no experience requirement or 0-1 years, check for fresher context
    if (!hasExperienceRequirement || minRequiredYears <= 1) {
      const fresherContext = /project.based|academic|learning|training|development.program|graduate.program/i;
      if (fresherContext.test(jdLower)) {
        return 'fresher';
      }
      
      // If no experience requirement and has educational requirements, likely fresher
      const educationKeywords = /b\.tech|b\.e\.|bachelor|degree|computer.science|engineering|graduate/i;
      if (!hasExperienceRequirement && educationKeywords.test(jdLower)) {
        return 'fresher';
      }
    }
    
    // Default to experienced if unclear
    return 'experienced';
  };

  const handleOptimizeResume = () => {
    // Hand over the exact input the checker scored, so the optimizer's
    // "before" score is computed on the same resume + JD + candidate type.
    const scoreHandoff: ScoreCheckerHandoff | null = parsedResumeData && scoreResult
      ? {
          parsedResume: parsedResumeData,
          resumeText: extractionResult.text,
          filename: uploadedFilename,
          candidateType: userType || 'fresher', // same fallback the scorer call uses
          jobDescription,
          jobTitle,
          score: scoreResult.overallScore,
        }
      : null;
    if (scoreHandoff) saveScoreCheckerHandoff(scoreHandoff);
    navigate('/optimizer', {
      state: {
        jobDescription: jobDescription,
        roleTitle: jobTitle,
        fromScoreChecker: true,
        scoreHandoff,
      },
    });
  };

  const handleCheckAnotherResume = () => {
    setScoreResult(null);
    setPremiumResult(null);
    setExtractionResult({ text: '', extraction_mode: 'TEXT', trimmed: false });
    setJobDescription('');
    setJobTitle('');
    setUserType(null);
    setCurrentStep(0);
    setIsOptimizedResume(false);
  };

  const reduceMotion = useReducedMotion();
  const fadeIn = (delay = 0) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay } };

  const creditsLeft = userSubscription
    ? userSubscription.scoreChecksTotal - userSubscription.scoreChecksUsed
    : null;
  const missingInputs = [
    !extractionResult.text.trim() && 'your resume',
    !jobTitle.trim() && 'the job title',
    !jobDescription.trim() && 'the job description',
    !userType && 'your experience level',
  ].filter(Boolean) as string[];
  const isReady = scoringMode !== null && missingInputs.length === 0;
  const showResult = currentStep === 2 && scoreResult && !isAnalyzing;

  const missingSkills = scoreResult
    ? [...new Set([...scoreResult.missingKeywords.critical, ...scoreResult.missingKeywords.important])].slice(0, 8)
    : [];
  const topIssues = scoreResult ? getTopIssues(scoreResult, missingSkills.length ? 4 : 5, missingSkills.length > 0) : [];
  const band = scoreResult ? getScoreBand(scoreResult.overallScore) : null;
  const activeLoadingStep = loadingStepIndex(loadingStep);

  return (
    <>
      <Seo
        title="ATS Resume Score Checker - Resume Analysis & ATS Compatibility Test"
        description="Check your resume ATS score against 30 deterministic, evidence-backed checks. Get detailed keyword analysis, formatting validation, and actionable improvement suggestions."
        keywords="ATS resume score, ATS resume checker, ATS resume score checker, ATS resume analysis, ATS resume scan, ATS resume test, ATS resume compatibility, ATS resume screening, ATS resume parsing test, ATS resume keyword checker, ATS resume keyword analysis, ATS resume keyword optimization, ATS resume scoring system, ATS resume AI, resume score checker, resume keyword score, resume keyword heatmap, resume keyword report, resume ATS compatibility test, resume optimization score, ATS resume India, ATS resume fresher, ATS resume experienced, PrimoBoost AI"
        canonicalPath="/score-checker"
      />
      <div className="min-h-screen bg-surface-deepest text-slate-100 lg:pl-16">
        {/* Slim top bar */}
        <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface-deepest/90 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
            <button
              onClick={onNavigateBack}
              aria-label="Back to home"
              className="-ml-2 grid h-11 w-11 place-items-center rounded-xl text-slate-300 hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-slate-200">Resume Score Checker</span>
            {isAuthenticated && creditsLeft !== null && (
              <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                {creditsLeft} {creditsLeft === 1 ? 'check' : 'checks'} left
              </span>
            )}
          </div>
        </div>

        <main className={`mx-auto max-w-2xl px-4 py-6 sm:py-10 ${showResult ? 'pb-44 sm:pb-10' : ''}`}>
          {isAnalyzing ? (
            /* ---------- Loading ---------- */
            <motion.section {...fadeIn()} className={`${cardClass} p-6 sm:p-8`} aria-live="polite" aria-busy="true">
              <h1 className="text-xl font-semibold text-slate-100">Checking your resume…</h1>
              <p className="mt-1 text-sm text-slate-400">This can take a minute or two. Please keep this tab open.</p>
              <ol className="mt-6 space-y-4">
                {LOADING_STEPS.map((label, index) => {
                  const done = index < activeLoadingStep;
                  const active = index === activeLoadingStep;
                  return (
                    <li key={label} className="flex items-center gap-3">
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                          done
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : active
                              ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300'
                              : 'border-slate-700 text-slate-500'
                        }`}
                      >
                        {done ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : active ? (
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                        ) : (
                          <span className="text-xs font-semibold">{index + 1}</span>
                        )}
                      </span>
                      <span className={`text-sm ${done || active ? 'text-slate-100' : 'text-slate-500'}`}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          ) : showResult && scoreResult && band ? (
            premiumResult ? (
              <PremiumResultsDashboard
                result={premiumResult}
                onCheckAnother={handleCheckAnotherResume}
                onNavigateBack={onNavigateBack}
                onOptimizeResume={handleOptimizeResume}
              />
            ) : (
              /* ---------- Result ---------- */
              <div className="space-y-4">
                <motion.section {...fadeIn()} className={`${cardClass} p-6 text-center sm:p-8`}>
                  <div className="relative mx-auto h-40 w-40">
                    <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#1e293b" strokeWidth="10" />
                      <motion.circle
                        cx="60" cy="60" r="50" fill="none" strokeWidth="10" strokeLinecap="round"
                        className={band.stroke}
                        initial={reduceMotion ? false : { strokeDasharray: '0 314' }}
                        animate={{ strokeDasharray: `${(scoreResult.overallScore / 100) * 314} 314` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-5xl font-bold ${band.text}`}>{scoreResult.overallScore}</span>
                      <span className="text-sm text-slate-400">out of 100</span>
                    </div>
                  </div>
                  <h1 className="mt-4 text-2xl font-bold text-slate-100">{band.label}</h1>
                  <p className="mt-1 text-slate-300">{band.note}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                    <span className={`rounded-full border px-3 py-1 font-medium ${band.chip}`}>
                      Shortlist chance: {scoreResult.canonicalInterviewProbability || scoreResult.interviewChance}
                    </span>
                    {jobTitle && (
                      <span className="max-w-full truncate rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                        For: {jobTitle}
                      </span>
                    )}
                  </div>
                </motion.section>

                {/* Primary CTA: fixed to the bottom on phones, inline card from sm up */}
                <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.08] bg-surface-deepest/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:static sm:rounded-2xl sm:border sm:border-emerald-400/20 sm:bg-emerald-500/[0.06] sm:p-6 sm:backdrop-blur-none">
                  <button
                    onClick={handleOptimizeResume}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:from-emerald-400 hover:to-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-deepest"
                  >
                    <Target className="h-5 w-5" aria-hidden="true" />
                    Fix my resume for this job
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-400">
                    JD-based optimizer: adds the right keywords, rewrites bullets, re-scores
                  </p>
                </div>

                <motion.section {...fadeIn(0.05)} aria-labelledby="top-issues-heading">
                  <h2 id="top-issues-heading" className="mb-3 px-1 text-base font-semibold text-slate-100">
                    {topIssues.length || missingSkills.length ? 'What to fix first' : 'Looking good'}
                  </h2>
                  <ul className="space-y-3">
                    {missingSkills.length > 0 && (
                      <li className={`${cardClass} p-4`}>
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-100">Missing key skills from the job</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {missingSkills.map(skill => (
                                <span key={skill} className="rounded-md border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-200">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </li>
                    )}
                    {topIssues.map(issue => (
                      <li key={issue.key} className={`${cardClass} p-4`}>
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="font-medium text-slate-100">{issue.title}</p>
                              {issue.scoreLabel && <span className="shrink-0 text-xs text-slate-500">{issue.scoreLabel}</span>}
                            </div>
                            {issue.detail && <p className="mt-1 text-sm leading-relaxed text-slate-400">{issue.detail}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                    {!topIssues.length && !missingSkills.length && (
                      <li className={`${cardClass} p-4 text-sm text-slate-300`}>No major issues found. Your resume matches this job well.</li>
                    )}
                  </ul>
                </motion.section>

                <details className={`${cardClass} group`}>
                  <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between rounded-2xl px-4 font-medium text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 [&::-webkit-details-marker]:hidden">
                    See full breakdown
                    <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="space-y-6 border-t border-white/[0.06] p-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">Match: {scoreResult.matchQuality}</span>
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                        <Shield className="mr-1 inline h-3 w-3" aria-hidden="true" />
                        {scoreResult.confidence} confidence
                      </span>
                      {extractionResult.extraction_mode === 'OCR' && (
                        <span className="rounded-full border border-amber-400/30 px-3 py-1 text-amber-300">
                          <Eye className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          OCR used
                        </span>
                      )}
                    </div>
                    {scoreResult.summary && <p className="text-sm leading-relaxed text-slate-300">{scoreResult.summary}</p>}

                    {scoreResult.canonicalCategories && scoreResult.canonicalCategories.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-sm font-semibold text-slate-200">By category</h3>
                        <ul className="space-y-3">
                          {scoreResult.canonicalCategories.map(category => (
                            <li key={category.name}>
                              <div className="mb-1 flex justify-between gap-3 text-sm">
                                <span className="text-slate-300">{category.name}</span>
                                <span className="text-slate-400">{Math.round(category.percentage)}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-800">
                                <div className={`h-2 rounded-full ${barColor(category.percentage)}`} style={{ width: `${Math.min(category.percentage, 100)}%` }} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-200">Every check</h3>
                      <ul className="divide-y divide-white/[0.06]">
                        {getVisibleScoreParameters(scoreResult).map(({ key, name, score, maxScore, percentage, evidence, applicable }) => (
                          <li key={key} className="py-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-slate-200">{name}</span>
                              <span className="shrink-0 text-slate-400">{applicable ? `${score}/${maxScore}` : 'N/A'}</span>
                            </div>
                            {applicable ? (
                              <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                                <div className={`h-1.5 rounded-full ${barColor(percentage)}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-slate-500">Excluded from the final score</p>
                            )}
                            {evidence.slice(0, 2).map((excerpt, evidenceIndex) => (
                              <p key={`${key}-evidence-${evidenceIndex}`} className="mt-1 text-xs leading-5 text-slate-500">“{excerpt}”</p>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {scoreResult.strengths.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-200">Strengths</h3>
                        <ul className="space-y-1 text-sm text-slate-300">
                          {scoreResult.strengths.map((strength, index) => (
                            <li key={index} className="flex gap-2"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />{strength}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {scoreResult.areasToImprove.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-slate-200">All recommendations</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                          {scoreResult.areasToImprove.map((rec, index) => <li key={index}>{rec}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>

                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
                  <button
                    onClick={handleCheckAnotherResume}
                    className="min-h-[44px] rounded-xl border border-slate-700 px-6 font-medium text-slate-200 hover:bg-white/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Check another resume
                  </button>
                  <button
                    onClick={onNavigateBack}
                    className="min-h-[44px] rounded-xl px-6 font-medium text-slate-400 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    Back to home
                  </button>
                </div>
              </div>
            )
          ) : (
            /* ---------- Input ---------- */
            <>
              <motion.header {...fadeIn()} className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">Check your resume against a job</h1>
                <p className="mt-2 text-slate-400">See your ATS score and what to fix. Takes about 2 minutes.</p>
              </motion.header>

              <motion.section {...fadeIn(0.05)} className={`${cardClass} space-y-8 p-4 sm:p-6`}>
                {/* Step 1 */}
                <div>
                  <h2 className="mb-3 flex items-center gap-3 text-base font-semibold text-slate-100 sm:text-lg">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-sm text-emerald-300">1</span>
                    Upload your resume
                  </h2>
                  <FileUpload
                    compact
                    onFileUpload={handleFileUpload}
                    onParsedResume={handleParsedResume}
                    isAuthenticated={isAuthenticated}
                    onShowAuth={onShowAuth}
                    requireAuth={true}
                    userId={user?.id}
                    creditType="score_check"
                    onShowSubscriptionPlans={onShowSubscriptionPlans}
                    onCreditCheckPassed={() => {
                      // Credits available - user still needs to fill JD and click analyze
                    }}
                  />
                </div>

                {/* Step 2 */}
                {scoringMode === 'jd_based' && (
                  <div className="space-y-4">
                    <h2 className="flex items-center gap-3 text-base font-semibold text-slate-100 sm:text-lg">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/15 text-sm text-emerald-300">2</span>
                      Add the job you're applying for
                    </h2>
                    <div>
                      <label htmlFor="rsc-job-title" className="mb-1.5 block text-sm font-medium text-slate-300">Job title</label>
                      <input
                        id="rsc-job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        placeholder="e.g. Software Engineer"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="rsc-jd" className="mb-1.5 block text-sm font-medium text-slate-300">Job description</label>
                      <textarea
                        id="rsc-jd"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description here"
                        rows={6}
                        className={`${inputClass} min-h-[160px] resize-y`}
                      />
                      <p className="mt-1 text-right text-xs text-slate-500">{jobDescription.length} characters</p>
                    </div>
                    <fieldset>
                      <legend className="mb-1.5 text-sm font-medium text-slate-300">Your experience level</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {USER_TYPES.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={userType === option.id}
                            onClick={() => setUserType(option.id)}
                            className={`min-h-[52px] rounded-xl border px-2 py-2 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                              userType === option.id
                                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                                : 'border-slate-700/60 bg-slate-900/40 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <span className="block text-sm font-medium">{option.label}</span>
                            <span className="block text-xs text-slate-500">{option.hint}</span>
                          </button>
                        ))}
                      </div>
                      {userType && location.state && (location.state as { jobDescription?: string }).jobDescription && (
                        <p className="mt-2 text-xs text-emerald-400/80">Auto-detected from the job description. Change it if it's wrong.</p>
                      )}
                    </fieldset>
                  </div>
                )}

                <div>
                  <button
                    onClick={() => analyzeResume()}
                    disabled={isAuthenticated && !isReady}
                    className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:from-emerald-400 hover:to-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-deepest disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {isAuthenticated ? 'Check my score' : 'Sign in to check my score'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {isAuthenticated && missingInputs.length > 0
                      ? `Add ${missingInputs.join(', ')} to continue.`
                      : 'Each check uses 1 score credit.'}
                  </p>
                </div>
              </motion.section>
            </>
          )}
        </main>
      </div>
    </>
  );
};
