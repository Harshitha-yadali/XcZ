// src/components/pages/JobsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  Sparkles,
  TrendingUp,
  Users,
  MapPin,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedCard, GradientButton, SectionHeader, FloatingParticles, ChristmasSnow } from '../ui';
import { JobListing, JobFilters, OptimizedResume } from '../../types/jobs';
import { jobsService } from '../../services/jobsService';
import { JobCard } from '../jobs/JobCard';
import { JobFilters as JobFiltersComponent } from '../jobs/JobFilters';
import { OptimizedResumePreviewModal } from '../modals/OptimizedResumePreviewModal';
import { ApplicationConfirmationModal } from '../modals/ApplicationConfirmationModal';
import { AutoApplyStatusModal } from '../modals/AutoApplyStatusModal';
import { AutoApplyQuestionsModal } from '../modals/AutoApplyQuestionsModal';
import { AutoApplyLoginModal } from '../modals/AutoApplyLoginModal';
import { Pagination } from '../common/Pagination';
import { JobPreferencesOnboardingModal } from '../modals/JobPreferencesOnboardingModal';
import { ProjectSuggestionModal } from '../modals/ProjectSuggestionModal';
import { userPreferencesService } from '../../services/userPreferencesService';
import { aiJobMatchingService } from '../../services/aiJobMatchingService';
import { useAutoApply } from '../../hooks/useAutoApply';
import { Seo } from '../../seo/Seo';
import { ApplyAgentModal } from '../modals/ApplyAgentModal';
import { autoApplyOrchestratorService } from '../../services/autoApplyOrchestratorService';
import { buildSearchParamsFromFilters, readFiltersFromSearchParams } from '../../utils/jobSearchParams';

interface JobsPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile?: (mode?: 'profile' | 'wallet') => void; // NEW: Function to open profile management
  onShowSubscriptionPlans?: (featureId?: string, expandAddons?: boolean) => void;
  onShowAlert?: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error', actionText?: string, onAction?: () => void) => void;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile,
  onShowSubscriptionPlans,
  onShowAlert
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isChristmasMode, colors } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [jobsJsonLd, setJobsJsonLd] = useState<Record<string, unknown> | null>(null);
  const [filters, setFilters] = useState<JobFilters>(() => readFiltersFromSearchParams(searchParams));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);

  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  });

  // Modal states
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [showApplicationConfirmation, setShowApplicationConfirmation] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobListing | null>(null);
  const [selectedResume, setSelectedResume] = useState<OptimizedResume | null>(null);

  // Auto-apply hook
  const {
    isProcessing: isAutoApplying,
    showStatusModal,
    showProjectModal,
    currentStatus,
    projectSuggestions,
    currentJob: autoApplyJob,
    result: autoApplyResult,
    questions: autoApplyQuestions,
    submitAnswers: submitAutoApplyAnswers,
    loginRequest: autoApplyLoginRequest,
    submitLogin: submitAutoApplyLogin,
    startAutoApply,
    handleProjectSelection,
    closeModals: closeAutoApplyModals,
  } = useAutoApply();

  // AI Recommendations state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [showingRecommendations, setShowingRecommendations] = useState(() => {
    const stored = localStorage.getItem('primoboost_ai_matches_enabled');
    return stored === null ? false : stored === 'true';
  });
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const pageSize = 12;

  // Check onboarding status on mount
  useEffect(() => {
    const checkOnboarding = async () => {
      if (user?.id) {
        const completed = await userPreferencesService.hasCompletedOnboarding(user.id);
        setHasCompletedOnboarding(completed);

        if (!completed) {
          setTimeout(() => setShowOnboarding(true), 1000);
        } else {
          loadAIRecommendations();
        }
      }
    };
    checkOnboarding();
  }, [user?.id]);

  const loadAIRecommendations = async (forceEnable = false) => {
    if (!user?.id) return;

    setLoadingRecommendations(true);
    try {
      const recommendations = await aiJobMatchingService.getRecommendations(user.id, 40);
      setAiRecommendations(recommendations);
      if (forceEnable && recommendations.length > 0) {
        setShowingRecommendations(true);
        localStorage.setItem('primoboost_ai_matches_enabled', 'true');
      }
    } catch (error) {
      console.error('Error loading AI recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleRefreshRecommendations = async () => {
    if (!user?.id) return;

    setLoadingRecommendations(true);
    try {
      const preferences = await userPreferencesService.getUserPreferences(user.id);
      if (!preferences) return;

      const allJobs = await jobsService.getAllJobs();
      await aiJobMatchingService.analyzeAndMatch(
        user.id,
        {
          resumeText: preferences.resume_text || '',
          passoutYear: preferences.passout_year || 2024,
          roleType: preferences.role_type || 'both',
          techInterests: preferences.tech_interests || [],
          preferredModes: preferences.preferred_modes || [],
        },
        allJobs
      );

      await loadAIRecommendations(true);
    } catch (error) {
      console.error('Error refreshing recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    loadAIRecommendations(true);
  };

 const loadJobs = useCallback(async (page = 1, newFilters = filters) => {
  setIsLoading(true);
  setError(null);

  try {
    const safePage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const offset = (safePage - 1) * pageSize;
    const result = await jobsService.getJobListings(newFilters, pageSize, offset);

    setJobs(result.jobs);
    setTotal(result.total);
    setHasMore(result.hasMore);
    setTotalPages(result.totalPages);
    setTotalCompanies(result.totalCompanies);
    setCurrentPage(safePage);

    setSearchParams(buildSearchParamsFromFilters(newFilters, safePage));

    if (result.jobs.length > 0) {
      const jobPostings = result.jobs.slice(0, 10).map((j: JobListing) => ({
        '@type': 'JobPosting',
        title: j.role_title || '',
        description: (j.short_description || j.description || '').substring(0, 500),
        datePosted: j.posted_date || j.created_at || '',
        hiringOrganization: {
          '@type': 'Organization',
          name: j.company_name || '',
          ...(j.company_logo_url ? { logo: j.company_logo_url } : {}),
          ...(j.company_website ? { sameAs: j.company_website } : {}),
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: j.location_city || '',
            addressCountry: 'IN',
          },
        },
        employmentType: 'FULL_TIME',
        ...(j.package_amount ? {
          baseSalary: {
            '@type': 'MonetarySalary',
            currency: j.package_currency || 'INR',
            value: {
              '@type': 'QuantitativeValue',
              value: j.package_amount,
            },
          },
        } : {}),
        ...(j.skills && j.skills.length > 0 ? { skills: j.skills.join(', ') } : {}),
        url: `https://primoboostai.in/jobs/${j.id}`,
      }));
      setJobsJsonLd({
        '@context': 'https://schema.org',
        '@graph': jobPostings,
      });
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to load jobs');
  } finally {
    setIsLoading(false);
  }
}, [filters, pageSize, setSearchParams]);


  useEffect(() => {
    loadJobs(currentPage, filters);
  }, [filters]);

  const handleFiltersChange = (newFilters: JobFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
    setSearchParams(buildSearchParamsFromFilters(newFilters, 1));
  };

  const handlePageChange = (page: number) => {
    loadJobs(page, filters);
  };

  const handleManualApply = (job: JobListing, optimizedResume: OptimizedResume) => {
    setSelectedJob(job);
    setSelectedResume(optimizedResume);
    setShowResumePreview(true);
  };

  const [agreeingFor, setAgreeingFor] = useState<JobListing | null>(null);

  const handleAutoApply = async (job: JobListing) => {
    // Check if user has a resume uploaded
    if (!user?.id) {
      onShowAuth();
      return;
    }

    try {
      // Auto-apply tailors the uploaded resume, so ask for one if it is missing.
      const preferences = await userPreferencesService.getUserPreferences(user.id);
      if (!preferences?.resume_text?.trim()) {
        setShowOnboarding(true);
        return;
      }

      // Nothing is sent in the user's name until they have agreed to it, once.
      if (!(await autoApplyOrchestratorService.getAgent())?.active) {
        setAgreeingFor(job);
        return;
      }

      // Runs in the background; true tells the card to show "Applied".
      const outcome = await startAutoApply(job);
      if (outcome?.error === 'NO_CREDITS') {
        const buy = () => onShowSubscriptionPlans?.('optimizer', true);
        if (onShowAlert) {
          onShowAlert(
            'No Quick credits left',
            'Auto Apply and Smart Apply use 1 Quick credit per job: we tailor your resume for that job and apply. Buy Quick credits to keep applying.',
            'warning',
            'Buy Quick credits',
            buy
          );
        } else buy();
        return false;
      }
      return outcome?.error === 'QUEUED';
    } catch (error) {
      console.error('Error starting auto-apply:', error);
      alert('Failed to start auto-apply. Please try again.');
    }
    return false;
  };

  const handleResumePreviewConfirm = () => {
    setShowResumePreview(false);
    if (selectedJob && selectedResume) {
      // Open job application link in new tab
      window.open(selectedJob.application_link, '_blank');

      // Show success message
      setSelectedJob(null);
      setSelectedResume(null);
    }
  };

  // Handle auto-apply completion
  useEffect(() => {
    // Already running, or waiting on the user: that page says which and asks
    // for whatever is needed.
    if (autoApplyResult?.error === 'ALREADY_IN_HAND') {
      closeAutoApplyModals();
      navigate('/jobs/auto-applied');
      return;
    }
    if (autoApplyResult && !showStatusModal && !showProjectModal) {
      setSelectedJob(autoApplyJob);
      setShowApplicationConfirmation(true);
    }
  }, [autoApplyResult, showStatusModal, showProjectModal, autoApplyJob, closeAutoApplyModals, navigate]);

const stats = [
  { label: 'Total Jobs', value: total, icon: <Briefcase className="w-5 h-5" /> },
  { label: 'Remote Jobs', value: jobs.filter(j => j.location_type === 'Remote').length, icon: <MapPin className="w-5 h-5" /> },
  { label: 'Fresh Openings', value: jobs.filter(j => new Date(j.posted_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length, icon: <Clock className="w-5 h-5" /> },
  { label: 'Companies', value: totalCompanies, icon: <Users className="w-5 h-5" /> }
];

  const displayedJobs = showingRecommendations && aiRecommendations.length > 0
    ? aiRecommendations.map((rec) => ({
        ...rec.job_data,
        match_score: rec.match_score,
        match_reason: rec.match_reason,
        skills_matched: rec.skills_matched,
      }))
    : jobs;


  return (
    <>
    <Seo
      title="Latest Jobs - Fresher & Experienced Openings at Top Companies"
      description="Browse latest job openings at Google, TCS, Infosys, Wipro, Amazon & more top companies in India. Find fresher jobs, experienced roles, remote positions. Apply directly or use AI-powered auto-apply on PrimoBoost AI."
      keywords="latest jobs India, fresher jobs, experienced jobs, remote jobs India, IT jobs India, software engineer jobs, data analyst jobs, full stack developer jobs, frontend developer jobs, backend developer jobs, DevOps jobs, cloud engineer jobs, QA tester jobs, business analyst jobs, product manager jobs, fresher IT jobs, entry level IT jobs, job portals India, ATS resume job matching, AI job matching, job search India, PrimoBoost AI"
      canonicalPath="/jobs"
      ogType="website"
      jsonLd={jobsJsonLd ?? undefined}
    />
    <div className={`min-h-screen relative overflow-hidden lg:pl-16 ${
      isChristmasMode
        ? 'bg-gradient-to-b from-[#1a0a0f] via-[#0f1a0f] to-surface-deepest'
        : 'bg-gradient-to-b from-teal-dark-900 via-surface-sunken to-surface-deepest'
    }`}>
      {/* Radial Glow Overlay */}
      <div className={`pointer-events-none absolute inset-0 ${
        isChristmasMode
          ? 'bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(34,197,94,0.15),transparent_50%)]'
          : 'bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.15),transparent_50%)]'
      }`} />

      {/* Floating Particles */}
      <FloatingParticles count={12} />

      {/* Christmas Snow */}
      {isChristmasMode && <ChristmasSnow count={30} />}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-12 sm:py-12">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-12"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.88, rotate: -5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 20, delay: 0.08 }}
            className={`hidden sm:flex w-20 h-20 rounded-3xl items-center justify-center mx-auto mb-6 shadow-lg ${
            isChristmasMode
              ? 'bg-gradient-to-br from-red-500 via-emerald-500 to-green-600 shadow-green-500/50'
              : 'bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-emerald-500/50'
          }`}>
            <Briefcase className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-2 sm:mb-4 tracking-tight">
            {showingRecommendations ? (
              'Your Recommended Jobs'
            ) : (
              <>
                Find Your{' '}
                <span className={`bg-gradient-to-r bg-clip-text text-transparent ${
                  isChristmasMode
                    ? 'from-red-400 via-green-400 to-emerald-400'
                    : 'from-emerald-400 via-cyan-400 to-teal-400'
                }`}>
                  Dream Job
                </span>
              </>
            )}
          </h1>
          <p className="text-sm sm:text-xl text-slate-300 max-w-3xl mx-auto">
            {showingRecommendations
              ? 'AI-powered recommendations based on your profile and preferences'
              : 'Discover opportunities, apply with AI-optimized resumes, and track your applications all in one place.'}
          </p>

          {hasCompletedOnboarding && (
            <div className="flex items-center justify-start sm:justify-center flex-nowrap sm:flex-wrap overflow-x-auto gap-2 sm:gap-4 mt-4 sm:mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none]">
              <GradientButton
                onClick={() => {
                  const next = !showingRecommendations;
                  setShowingRecommendations(next);
                  localStorage.setItem('primoboost_ai_matches_enabled', String(next));
                }}
                variant={showingRecommendations ? 'primary' : 'secondary'}
                size="md"
                icon={Sparkles}
              >
                <span>{showingRecommendations ? 'Showing AI Matches' : 'Show AI Matches'}</span>
                {aiRecommendations.length > 0 && (
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                    {aiRecommendations.length}
                  </span>
                )}
              </GradientButton>

              <GradientButton
                onClick={handleRefreshRecommendations}
                disabled={loadingRecommendations}
                variant="secondary"
                size="md"
                icon={RefreshCw}
                className={loadingRecommendations ? 'animate-spin' : ''}
              >
                <span className="hidden sm:inline">Refresh</span>
              </GradientButton>

              <GradientButton
                onClick={() => setShowOnboarding(true)}
                variant="secondary"
                size="md"
              >
                ⚙️
                <span className="hidden sm:inline">Preferences</span>
              </GradientButton>

              <GradientButton
                onClick={() => navigate('/jobs/auto-applied')}
                variant="secondary"
                size="md"
                icon={Briefcase}
              >
                <span>My Auto Applications</span>
              </GradientButton>
            </div>
          )}
        </motion.div>

        {/* Stats */}
        {/* Numbers about the board: useful on a wide screen, in the way of the jobs on a phone. */}
        <div className="hidden sm:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat, index) => (
            <AnimatedCard
              key={index}
              glow
              hoverLift={8}
              delay={index * 0.1}
              className="p-6 text-center"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                isChristmasMode
                  ? 'bg-gradient-to-br from-red-500/20 to-green-500/20 text-green-400'
                  : 'bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400'
              }`}>
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </AnimatedCard>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          className="mb-8"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: prefersReducedMotion ? 0 : 0.18 }}
        >
          <JobFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isLoading={isLoading}
          />
        </motion.div>

        {/* Error State */}
        {error && (
          <AnimatedCard className="p-6 mb-8 border-red-500/50 bg-red-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="w-6 h-6 text-red-400 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-red-300">Error Loading Jobs</h3>
                  <p className="text-red-400">{error}</p>
                </div>
              </div>
              <GradientButton
                onClick={() => loadJobs(currentPage || 1)}
                variant="secondary"
                size="sm"
                icon={RefreshCw}
              >
                Retry
              </GradientButton>
            </div>
          </AnimatedCard>
        )}

        {/* Jobs Grid */}
        {!error && (
          <>
           <motion.div
             layout
             animate={{ opacity: isLoading ? 0.58 : 1 }}
             transition={{ duration: 0.2 }}
             className="w-full max-w-full mx-auto px-0 sm:px-0 py-8 space-y-4"
           >
            <AnimatePresence initial={false} mode="sync">
              {displayedJobs.map((job: any, index: number) => (
                <JobCard
                  key={job.id}
                  job={job}
                  animationDelay={prefersReducedMotion ? 0 : Math.min(index * 0.045, 0.27)}
                  onManualApply={handleManualApply}
                  onAutoApply={handleAutoApply}
                  isAuthenticated={isAuthenticated}
                  onShowAuth={onShowAuth}
                  onCompleteProfile={() => onShowProfile && onShowProfile('profile')} // NEW: Pass profile completion handler
                />
              ))}
            </AnimatePresence>
           </motion.div>

            {/* Loading State */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
                  className="relative overflow-hidden flex items-center justify-center gap-3 py-5 px-6 rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-md"
                  role="status"
                  aria-live="polite"
                >
                  <Loader2 className={`w-5 h-5 text-emerald-400 ${prefersReducedMotion ? '' : 'animate-spin'}`} />
                  <span className="text-sm font-medium text-slate-300">Updating the latest jobs...</span>
                  {!prefersReducedMotion && (
                    <motion.div
                      className="absolute bottom-0 left-0 h-px w-1/3 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                      animate={{ x: ['-100%', '400%'] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pagination */}
            {!isLoading && jobs.length > 0 && totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8"
              >
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, total)} of {total} jobs
                  </p>
                </div>
              </motion.div>
            )}

            {/* No Jobs Found */}
            {!isLoading && jobs.length === 0 && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="text-center py-12"
              >
                <div className="bg-slate-800/80 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-700/60">
                  <Briefcase className="w-10 h-10 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No Jobs Found</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Try adjusting your filters or search terms to find more opportunities.
                </p>
                <button
                  onClick={() => setFilters({})}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl transition-colors"
                >
                  Clear All Filters
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <OptimizedResumePreviewModal
        isOpen={showResumePreview}
        onClose={() => setShowResumePreview(false)}
        job={selectedJob}
        optimizedResume={selectedResume}
        onConfirm={handleResumePreviewConfirm}
      />

      <ApplicationConfirmationModal
        isOpen={showApplicationConfirmation}
        onClose={() => {
          setShowApplicationConfirmation(false);
          setSelectedJob(null);
          closeAutoApplyModals();
        }}
        job={selectedJob}
        result={autoApplyResult ? {
          success: autoApplyResult.success,
          message: autoApplyResult.success
            ? 'Application submitted successfully'
            // Handed to the worker. Nothing has been sent yet and nothing has
            // gone wrong, so it must read as neither.
            : autoApplyResult.error === 'QUEUED'
              ? 'We are applying for you. You can close this page.'
            : autoApplyResult.error === 'JOB_CLOSED'
              ? 'Nothing was sent. We stopped before tailoring your resume.'
            : autoApplyResult.error === 'SUBMISSION_UNCERTAIN'
              ? autoApplyResult.uncertainMessage
                || 'Submit was pressed for this job, but no confirmation was seen. The employer may already have your application.'
              : autoApplyResult.error === 'MANUAL_APPLY'
                ? `${autoApplyResult.manualReason || 'We could not submit this one for you.'} Your tailored resume is ready: download it and finish on the company's page.`
                : 'This application was not sent.',
          applicationId: autoApplyResult.applicationId || '',
          status: autoApplyResult.success ? 'submitted' : 'failed',
          resumeUrl: autoApplyResult.pdfUrl,
          manual: autoApplyResult.error === 'MANUAL_APPLY',
          uncertain: autoApplyResult.error === 'SUBMISSION_UNCERTAIN',
          error: ['MANUAL_APPLY', 'SUBMISSION_UNCERTAIN'].includes(autoApplyResult.error || '') ? undefined : autoApplyResult.error,
          // Offered only when nothing was sent. After an uncertain submit the
          // employer's link would invite a second application, and a closed
          // job's goes nowhere.
          fallbackUrl: autoApplyResult.success || ['SUBMISSION_UNCERTAIN', 'JOB_CLOSED'].includes(autoApplyResult.error || '')
            ? undefined
            : selectedJob?.application_link,
        } : null}
      />

      <AutoApplyStatusModal
        isOpen={showStatusModal}
        status={currentStatus}
        jobTitle={autoApplyJob?.role_title}
        companyName={autoApplyJob?.company_name}
      />

      <AutoApplyQuestionsModal
        questions={autoApplyQuestions}
        companyName={autoApplyJob?.company_name}
        onSubmit={submitAutoApplyAnswers}
        onClose={() => closeAutoApplyModals()}
      />

      <AutoApplyLoginModal
        site={autoApplyLoginRequest?.site ?? null}
        message={autoApplyLoginRequest?.message}
        onSubmit={submitAutoApplyLogin}
        onClose={() => closeAutoApplyModals()}
      />

      {showProjectModal && projectSuggestions && (
        <ProjectSuggestionModal
          isOpen={showProjectModal}
          onClose={() => closeAutoApplyModals()}
          job={autoApplyJob}
          suggestions={projectSuggestions}
          onSelectProject={handleProjectSelection}
          matchScore={projectSuggestions.currentMatchScore || 0}
        />
      )}

      <JobPreferencesOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />

      <ApplyAgentModal
        isOpen={agreeingFor !== null}
        onClose={() => setAgreeingFor(null)}
        onAgreed={() => {
          const job = agreeingFor;
          setAgreeingFor(null);
          if (job) handleAutoApply(job);
        }}
      />
    </div>
    </>
  );
};
