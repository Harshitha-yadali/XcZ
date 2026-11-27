import React, { useState, useMemo, useEffect } from 'react';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  Sparkles,
  Zap,
  ArrowUpRight,
} from 'lucide-react';
import { JobListing } from '../../types/jobs';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatJobExpiryLabel, getJobDisplayStatus, isJobOpen } from '../../utils/jobStatus';
import { canAutoApply } from '../../../supabase/functions/_shared/applyForm';

const JOB_CATEGORY_BADGE_CLASSES: Record<string, string> = {
  Fresher: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Experienced: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Internship: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

interface JobCardProps {
  job: JobListing & {
    match_score?: number;
    match_reason?: string;
    skills_matched?: string[];
  };
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onManualApply?: (job: JobListing) => void;
  /** Resolves true once the application is queued, so the button can say "Applied". */
  onAutoApply?: (job: JobListing) => Promise<boolean | void>;
  onCompleteProfile?: () => void;
  animationDelay?: number;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  isAuthenticated,
  onShowAuth,
  onManualApply,
  onAutoApply,
  onCompleteProfile,
  animationDelay = 0,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const autoApplyEnabled = import.meta.env.VITE_ENABLE_AUTO_APPLY === 'true';

  const logoCandidates = useMemo(() => {
    const candidates: string[] = [];
    const seen = new Set<string>();
    const addCandidate = (value?: string | null) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      candidates.push(trimmed);
    };

    const toFaviconUrl = (value?: string | null) => {
      if (typeof value !== 'string' || !value.trim()) return null;

      try {
        const parsed = new URL(value.trim());
        return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsed.origin)}&sz=128`;
      } catch {
        return null;
      }
    };

    addCandidate(job.company_logo_url);
    addCandidate(job.company_logo);
    addCandidate(toFaviconUrl(job.company_website));
    addCandidate(toFaviconUrl(job.application_link));

    return candidates;
  }, [job.application_link, job.company_logo, job.company_logo_url, job.company_website]);

  const [logoIndex, setLogoIndex] = useState(0);
  const [autoState, setAutoState] = useState<'idle' | 'applying' | 'applied'>('idle');
  // Auto Apply only where the runner has test-filled this very job; anywhere
  // else (untested, blocked, unsupported site) the tailored resume (Smart Apply).
  const smart = !(canAutoApply(job.application_link || '') && job.apply_check === 'works');

  useEffect(() => {
    setLogoIndex(0);
  }, [logoCandidates]);

  const eligibleYearTags = useMemo(() => {
    const raw = job.eligible_years;
    if (!raw) return [];

    const tokens = Array.isArray(raw)
      ? raw
      : raw.includes(',') || raw.includes('|') || raw.includes('/')
        ? raw.split(/[,|/]/)
        : raw.split(/\s+/);

    return tokens
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index)
      .slice(0, 3);
  }, [job.eligible_years]);

  const handleCardClick = () => {
    navigate(`/jobs/${job.id}`);
  };

  const handleManualApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Redirect to details page for manual apply (better shareable path)
    navigate(`/jobs/${job.id}`);
  };

  const handleAutoApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!autoApplyEnabled) {
      return; // disabled with overlay
    }
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    if (onAutoApply && autoState === 'idle') {
      setAutoState('applying');
      setAutoState((await onAutoApply(job)) ? 'applied' : 'idle');
    }
  };

  const skillTags = job.skills || [];
  const postedDaysAgo = Math.floor((Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60 * 24));
  const jobDisplayStatus = getJobDisplayStatus(job);
  const jobOpen = isJobOpen(job);
  const expiryLabel = formatJobExpiryLabel(job.expires_at);

  // 3D: the card tilts toward the mouse and a soft light follows it; the logo
  // sits on a raised layer, so the tilt shows real depth. Mouse only: touch and
  // reduced-motion users get a flat card.
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const tilt = { stiffness: 260, damping: 24 };
  const rotateX = useSpring(useTransform(pointerY, [0, 1], [4, -4]), tilt);
  const rotateY = useSpring(useTransform(pointerX, [0, 1], [-5, 5]), tilt);
  const glowX = useTransform(pointerX, (value) => `${value * 100}%`);
  const glowY = useTransform(pointerY, (value) => `${value * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(420px circle at ${glowX} ${glowY}, rgba(52,211,153,0.10), transparent 60%)`;
  const depth = prefersReducedMotion ? {} : {
    style: { rotateX, rotateY, transformPerspective: 1100, transformStyle: 'preserve-3d' as const },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'mouse') return;
      const rect = event.currentTarget.getBoundingClientRect();
      pointerX.set((event.clientX - rect.left) / rect.width);
      pointerY.set((event.clientY - rect.top) / rect.height);
    },
    onPointerLeave: () => { pointerX.set(0.5); pointerY.set(0.5); },
  };
  const shownSkills = skillTags.slice(0, 4);

  return (
    <motion.div
      layout
      {...depth}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 22, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      whileHover={prefersReducedMotion ? undefined : { y: -5, scale: 1.006 }}
      transition={{
        layout: { type: 'spring', stiffness: 320, damping: 30 },
        opacity: { duration: 0.3, delay: animationDelay },
        y: { type: 'spring', stiffness: 260, damping: 24, delay: animationDelay },
      }}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardClick();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={`View ${job.role_title} at ${job.company_name}`}
      className={`relative rounded-2xl border bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-xl ${
        job.match_score
          ? 'border-emerald-400/40 shadow-lg shadow-emerald-500/15'
          : 'border-white/[0.07] shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
      } group hover:border-emerald-400/40 hover:shadow-[0_22px_60px_rgba(16,185,129,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition-[border-color,box-shadow] duration-300 cursor-pointer overflow-hidden`}
    >
      {/* Light that follows the mouse. */}
      {!prefersReducedMotion && (
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: spotlight }} />
      )}
      {/* A thin lit edge along the top. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {job.match_score && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <Sparkles className="w-4 h-4" />
            <span className="font-bold text-lg">{job.match_score}% Match</span>
          </div>
          {job.match_reason && (
            <span className="text-white text-xs bg-white/20 px-2 py-1 rounded-full">
              AI Recommended
            </span>
          )}
        </div>
      )}
      <div className="relative p-4 sm:p-5" style={prefersReducedMotion ? undefined : { transformStyle: 'preserve-3d' }}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-5">
          {/* Company logo, on a raised layer so the tilt shows depth. */}
          <div
            style={prefersReducedMotion ? undefined : { transform: 'translateZ(28px)' }}
            className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)] group-hover:ring-emerald-400/30 flex items-center justify-center p-2 overflow-hidden transition-[box-shadow] duration-300"
          >
            {logoCandidates[logoIndex] ? (
              <img
                src={logoCandidates[logoIndex]}
                alt={`${job.company_name} jobs - ${job.role_title} opening`}
                className="w-full h-full object-contain object-center transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                loading="lazy"
                onError={(e) => {
                  e.stopPropagation();
                  if (logoIndex < logoCandidates.length - 1) {
                    setLogoIndex((current) => current + 1);
                  } else {
                    setLogoIndex(logoCandidates.length);
                  }
                }}
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {job.company_name.charAt(0)}
              </div>
            )}
          </div>

          {/* Job Info */}
          <div className="flex-1 min-w-0" style={prefersReducedMotion ? undefined : { transform: 'translateZ(12px)' }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white truncate max-w-full group-hover:text-emerald-50 transition-colors">
                    {job.role_title}
                  </h3>
                  <ArrowUpRight className="hidden sm:block w-4 h-4 text-slate-600 transition-all duration-300 group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {job.job_category && (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${JOB_CATEGORY_BADGE_CLASSES[job.job_category] || 'bg-slate-700/40 text-slate-300 border-slate-600/50'}`}>
                      {job.job_category}
                    </span>
                  )}
                  {jobOpen && !smart && autoApplyEnabled && (
                    <span title="We tested this job's form: we can apply for you start to finish." className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
                      <Zap className="w-2.5 h-2.5" />
                      Auto Apply ready
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-300/90 mb-2">
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/jobs/company/${job.company_name.toLowerCase().replace(/\s+/g, '-')}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        navigate(`/jobs/company/${job.company_name.toLowerCase().replace(/\s+/g, '-')}`);
                      }
                    }}
                    className="hover:text-emerald-400 transition-colors cursor-pointer"
                  >
                    {job.company_name}
                  </span>
                </p>
              </div>

              {/* Commission Badge */}
              {job.user_has_applied && job.commission_percentage && job.commission_percentage > 0 && (
                <div className="flex-shrink-0 relative">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      className="text-slate-700"
                    />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 16}`}
                      strokeDashoffset={`${2 * Math.PI * 16 * (1 - job.commission_percentage / 100)}`}
                      className={job.user_application_method === 'auto' ? 'text-green-400' : 'text-cyan-400'}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-300">{Math.round(job.commission_percentage)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Job Details */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs text-slate-400 mb-3">
              <div className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{job.location_city || job.location_type}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Full-time</span>
              </div>
              <div className="flex items-center space-x-1">
                <Users className="w-3.5 h-3.5" />
                <span>{job.experience_required}</span>
              </div>
              {eligibleYearTags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{eligibleYearTags.join(' / ')}</span>
                </div>
              )}
            </div>

            {/* Skill Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {shownSkills.map((tag, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.04] text-slate-300 text-[11px] font-medium ring-1 ring-white/[0.07] transition-colors duration-200 group-hover:ring-emerald-400/20"
                >
                  {tag}
                </span>
              ))}
              {skillTags.length > shownSkills.length && (
                <span className="px-2 py-1 text-slate-500 text-[11px] font-medium">
                  +{skillTags.length - shownSkills.length} more
                </span>
              )}
            </div>

            {/* Actions Row */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center space-x-1.5">
                {job.has_referral && (
                  <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded text-[10px] font-semibold flex items-center shadow-sm shadow-emerald-500/20">
                    <Users className="w-2.5 h-2.5 mr-0.5" />
                    Referral
                  </span>
                )}
                {job.ai_polished && (
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px] font-medium flex items-center border border-purple-500/30">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    AI
                  </span>
                )}
                {jobDisplayStatus === 'expired' && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-300 rounded text-[10px] font-semibold border border-red-500/30">
                    Expired
                  </span>
                )}
                <span className="text-[11px] text-slate-500">
                  {postedDaysAgo === 0 ? 'Today' : `${postedDaysAgo}d ago`}
                </span>
                {expiryLabel && (
                  <span className="text-[11px] text-slate-500">
                    Deadline {expiryLabel}
                  </span>
                )}
              </div>

              {/* Apply Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                {jobOpen ? (
                  <>
                    <div className="relative w-full sm:w-auto">
                      <button
                        onClick={handleAutoApply}
                        disabled={!autoApplyEnabled || autoState !== 'idle'}
                        aria-disabled={!autoApplyEnabled || autoState !== 'idle'}
                        aria-live="polite"
                        title={smart ? 'We tailor your resume for this job; you submit it on the company site.' : 'We apply for you, start to finish.'}
                        className={`h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-sm font-semibold shadow-[0_8px_24px_rgba(52,211,153,0.25)] transition-all duration-200 flex items-center justify-center gap-1.5 w-full sm:w-auto ${autoApplyEnabled && autoState === 'idle' ? 'hover:brightness-110 hover:shadow-[0_12px_32px_rgba(52,211,153,0.35)] hover:-translate-y-0.5 active:translate-y-0' : autoApplyEnabled ? 'cursor-default' : 'opacity-50 cursor-not-allowed'}`}
                      >
                        {smart ? <Sparkles className={`w-4 h-4 ${autoState === 'applying' ? 'animate-spin' : ''}`} /> : <Zap className={`w-4 h-4 ${autoState === 'applying' ? 'animate-pulse' : ''}`} />}
                        <span>{autoState === 'applying'
                          ? (smart ? 'Preparing...' : 'Applying...')
                          : autoState === 'applied' ? 'Applied ✓' : smart ? 'Smart Apply' : 'Auto Apply'}</span>
                      </button>
                      {!autoApplyEnabled && (
                        <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-amber-500 text-[8px] font-bold text-white rounded-full leading-none whitespace-nowrap shadow-sm">
                          Soon
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleManualApply}
                      className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-200 ring-1 ring-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:ring-white/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 w-full sm:w-auto"
                    >
                      Manual Apply
                    </button>
                  </>
                ) : (
                  <button
                    disabled
                    className="px-4 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-sm font-semibold cursor-not-allowed border border-slate-600/50 w-full sm:w-auto"
                  >
                    {jobDisplayStatus === 'expired' ? 'Expired' : 'Inactive'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
