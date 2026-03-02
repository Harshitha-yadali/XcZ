import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  Briefcase,
  Target,
  Loader2,
  Building2,
  Globe,
  Mail,
  Copy,
  Check,
  Code,
  Brain,
  MessageCircle,
  UserCheck,
  Award,
  FileText,
  ExternalLink,
  Sparkles,
  Share2,
  ArrowLeft,
  IndianRupee,
  GraduationCap,
  Bookmark,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { jobsService } from '../../services/jobsService';
import { JobListing } from '../../types/jobs';
import { useAuth } from '../../contexts/AuthContext';
import { ApplicationMethodModal } from '../modals/ApplicationMethodModal';
import { useSEO, injectJsonLd, removeJsonLd } from '../../hooks/useSEO';

interface JobDetailsPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const JobDetailsPageNew: React.FC<JobDetailsPageProps> = ({ onShowAuth }) => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [copiedReferralCode, setCopiedReferralCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const eligibleYearTags = useMemo(() => {
    if (!job?.eligible_years) return [];
    const raw = job.eligible_years;
    const tokens = Array.isArray(raw)
      ? raw
      : raw.includes(',') || raw.includes('|') || raw.includes('/')
        ? raw.split(/[,|/]/)
        : raw.split(/\s+/);
    return tokens
      .map((value) => value.trim())
      .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);
  }, [job?.eligible_years]);

  const postedDaysAgo = useMemo(() => {
    if (!job?.posted_date) return 0;
    return Math.floor((Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60 * 24));
  }, [job?.posted_date]);

  const postedLabel = postedDaysAgo === 0 ? 'Today' : postedDaysAgo === 1 ? 'Yesterday' : `${postedDaysAgo} days ago`;

  useSEO({
    title: job ? `${job.role_title} at ${job.company_name} - Apply Now` : 'Job Details',
    description: job
      ? `Apply for ${job.role_title} at ${job.company_name}${job.location_city ? ` in ${job.location_city}` : ''}.${job.experience_required ? ` ${job.experience_required} experience.` : ''}${job.qualification ? ` ${job.qualification}.` : ''} ${(job.short_description || job.description || '').substring(0, 150)}`
      : 'View job details and apply on PrimoBoost AI.',
    canonical: jobId ? `/jobs/${jobId}` : '/jobs',
    ogType: 'article',
    ogImage: job?.company_logo_url || undefined,
    twitterCard: 'summary_large_image',
  });

  useEffect(() => {
    if (job) {
      const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: job.role_title || '',
        description: job.full_description || job.description || '',
        datePosted: job.posted_date || job.created_at || '',
        hiringOrganization: {
          '@type': 'Organization',
          name: job.company_name || '',
          ...(job.company_logo_url ? { logo: job.company_logo_url } : {}),
          ...(job.company_website ? { sameAs: job.company_website } : {}),
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: job.location_city || '',
            addressCountry: 'IN',
          },
        },
        employmentType: 'FULL_TIME',
        url: `https://primoboost.ai/jobs/${job.id}`,
      };
      if (job.package_amount) {
        jsonLd.baseSalary = {
          '@type': 'MonetarySalary',
          currency: job.package_currency || 'INR',
          value: { '@type': 'QuantitativeValue', value: job.package_amount },
        };
      }
      injectJsonLd('job-detail-structured-data', jsonLd);
    }
    return () => removeJsonLd('job-detail-structured-data');
  }, [job]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId) { navigate('/jobs'); return; }
      try {
        setLoading(true);
        const jobData = await jobsService.getJobListingById(jobId);
        if (jobData) { setJob(jobData); } else { navigate('/jobs'); }
      } catch { navigate('/jobs'); }
      finally { setLoading(false); }
    };
    fetchJob();
  }, [jobId, navigate]);

  const handleApplyClick = () => {
    if (!isAuthenticated) {
      onShowAuth(() => setShowApplicationModal(true));
    } else {
      setShowApplicationModal(true);
    }
  };

  const handleManualApply = async () => {
    if (job) {
      try { await jobsService.logManualApplication(job.id, '', job.application_link); } catch {}
      window.open(job.application_link, '_blank');
      setShowApplicationModal(false);
    }
  };

  const handleAIOptimizedApply = () => {
    if (!job) return;
    setShowApplicationModal(false);
    const fullJobDescription = [
      job.full_description || job.description,
      job.short_description ? `\n\nKey Points: ${job.short_description}` : '',
      job.qualification ? `\n\nQualifications: ${job.qualification}` : '',
    ].filter(Boolean).join('\n');
    navigate('/optimizer', {
      state: { jobId: job.id, jobDescription: fullJobDescription, roleTitle: job.role_title, companyName: job.company_name, fromJobApplication: true },
    });
  };

  const handleScoreCheck = () => {
    if (!job) return;
    const fullJobDescription = [
      job.full_description || job.description,
      job.short_description ? `\n\nKey Points: ${job.short_description}` : '',
      job.qualification ? `\n\nQualifications: ${job.qualification}` : '',
    ].filter(Boolean).join('\n');
    navigate('/score-checker', { state: { jobDescription: fullJobDescription, jobTitle: job.role_title } });
    setShowApplicationModal(false);
  };

  const copyReferralCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedReferralCode(true);
    setTimeout(() => setCopiedReferralCode(false), 2000);
  };

  const shareOrCopyLink = async () => {
    const url = window.location.href;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: `${job?.role_title || 'Job'} at ${job?.company_name || ''}`, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const formatSalary = (amount: number, type: string) => {
    if (type === 'CTC') return `${(amount / 100000).toFixed(1)}L per year`;
    if (type === 'stipend') return `${amount.toLocaleString()} per month`;
    if (type === 'hourly') return `${amount} per hour`;
    return `${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
          <p className="text-slate-400">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <p className="text-xl text-slate-300 mb-4">Job not found</p>
          <button onClick={() => navigate('/jobs')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-xl transition-colors">
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  const hasSelectionProcess = job.has_coding_test || job.has_aptitude_test || job.has_technical_interview || job.has_hr_interview;
  const skillTags = job.skills || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 lg:pl-16 transition-colors duration-300 pb-24 lg:pb-8">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/40">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between h-14">
            <nav className="flex items-center gap-1.5 text-sm text-slate-400 min-w-0">
              <button onClick={() => navigate('/jobs')} className="hover:text-emerald-400 transition-colors font-medium flex items-center gap-1 flex-shrink-0">
                <ArrowLeft className="w-4 h-4 lg:hidden" />
                <span>Jobs</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
              <span className="truncate max-w-[10rem] hidden sm:block">{job.company_name}</span>
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 hidden sm:block" />
              <span className="truncate max-w-[14rem] font-medium text-slate-200 hidden sm:block">{job.role_title}</span>
            </nav>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); } catch {} }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5"
              >
                {copiedLink ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
              <button
                onClick={shareOrCopyLink}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Hero Card */}
            <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/40 overflow-hidden">
              {/* Company Banner Strip */}
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500" />

              <div className="p-6 sm:p-8">
                <div className="flex items-start gap-5">
                  {job.company_logo_url ? (
                    <img
                      src={job.company_logo_url}
                      alt={`${job.company_name} logo`}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain bg-white/5 p-2 border border-slate-700/50 flex-shrink-0"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                      {job.company_name.charAt(0)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1 leading-tight">
                      {job.role_title}
                    </h1>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/jobs/company/${job.company_name.toLowerCase().replace(/\s+/g, '-')}`); }}
                      className="text-base sm:text-lg text-slate-300 hover:text-emerald-400 transition-colors font-medium"
                    >
                      {job.company_name}
                    </button>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {job.location_city && (
                        <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          {job.location_city}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                        <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                        {job.location_type}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {postedLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-lg font-medium border border-emerald-500/20">
                    {job.domain}
                  </span>
                  <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-lg font-medium border border-blue-500/20">
                    {job.location_type}
                  </span>
                  {eligibleYearTags.length > 0 && (
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-lg font-medium border border-amber-500/20 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      {eligibleYearTags.join(' / ')}
                    </span>
                  )}
                  {job.has_referral && (
                    <span className="px-2.5 py-1 bg-green-500/15 text-green-400 text-xs rounded-lg font-semibold border border-green-500/30 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Referral
                    </span>
                  )}
                  {job.ai_polished && (
                    <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded-lg font-medium border border-cyan-500/20 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Enhanced
                    </span>
                  )}
                </div>

                {/* Apply CTA - Desktop */}
                <div className="mt-6 hidden lg:flex items-center gap-3">
                  <button
                    onClick={handleApplyClick}
                    className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Zap className="w-5 h-5" />
                    Apply Now
                  </button>
                </div>
              </div>
            </div>

            {/* Key Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Experience</span>
                </div>
                <p className="text-sm font-semibold text-white">{job.experience_required}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <GraduationCap className="w-4 h-4 text-green-400" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Qualification</span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug">{job.qualification}</p>
              </div>
              {job.package_amount && job.package_type ? (
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <IndianRupee className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Package</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{formatSalary(job.package_amount, job.package_type)}</p>
                </div>
              ) : (
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Location</span>
                  </div>
                  <p className="text-sm font-semibold text-white">{job.location_city || job.location_type}</p>
                </div>
              )}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-rose-400" />
                  <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">Posted</span>
                </div>
                <p className="text-sm font-semibold text-white">{postedLabel}</p>
              </div>
            </div>

            {/* Skills */}
            {skillTags.length > 0 && (
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-cyan-400" />
                  Skills Required
                </h2>
                <div className="flex flex-wrap gap-2">
                  {skillTags.map((skill, i) => (
                    <span key={i} className="px-3 py-1.5 bg-slate-700/50 text-slate-200 rounded-lg text-sm font-medium border border-slate-600/40">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* About the Company */}
            {job.company_description && (
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
                <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  About {job.company_name}
                </h2>
                <p className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-line">
                  {job.company_description}
                </p>
                {job.company_website && (
                  <a href={job.company_website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 mt-4 text-sm font-medium transition-colors">
                    <Globe className="w-4 h-4" />
                    Visit Website
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            {/* Job Description */}
            <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                Job Description
              </h2>
              <div className="text-slate-300 leading-relaxed text-[15px] whitespace-pre-line">
                {job.full_description || job.description}
              </div>
            </div>

            {/* Selection Process */}
            {hasSelectionProcess && (
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  Selection Process
                </h2>
                <p className="text-slate-400 text-sm mb-5">
                  The hiring process includes the following stages:
                </p>

                <div className="flex flex-wrap gap-3">
                  {job.has_coding_test && (
                    <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 rounded-xl">
                      <Code className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-300">Coding Test</span>
                    </div>
                  )}
                  {job.has_aptitude_test && (
                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl">
                      <Brain className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-green-300">Aptitude Test</span>
                    </div>
                  )}
                  {job.has_technical_interview && (
                    <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 px-4 py-2.5 rounded-xl">
                      <MessageCircle className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium text-cyan-300">Technical Interview</span>
                    </div>
                  )}
                  {job.has_hr_interview && (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 px-4 py-2.5 rounded-xl">
                      <UserCheck className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium text-orange-300">HR Interview</span>
                    </div>
                  )}
                </div>

                {job.test_duration_minutes && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>Estimated duration: <span className="text-white font-medium">{job.test_duration_minutes} minutes</span></span>
                  </div>
                )}

                {job.test_requirements && (
                  <div className="mt-4 bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">What to Expect</p>
                    <p className="text-sm text-slate-300 whitespace-pre-line">{job.test_requirements}</p>
                  </div>
                )}
              </div>
            )}

            {/* Referral Section */}
            {job.has_referral && (
              <div className="bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-2xl border border-green-500/20 p-6">
                <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  Employee Referral Available
                </h2>
                <p className="text-sm text-slate-400 mb-5">
                  This position has an employee referral program. Use the referral for a better chance.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {job.referral_person_name && (
                    <div className="bg-slate-800/70 p-4 rounded-xl border border-green-500/15">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Contact</p>
                      <p className="font-semibold text-white text-sm">{job.referral_person_name}</p>
                    </div>
                  )}
                  {job.referral_email && (
                    <div className="bg-slate-800/70 p-4 rounded-xl border border-green-500/15">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Email</p>
                      <a href={`mailto:${job.referral_email}`} className="font-semibold text-green-400 hover:text-green-300 text-sm flex items-center gap-1.5 transition-colors">
                        <Mail className="w-3.5 h-3.5" />
                        {job.referral_email}
                      </a>
                    </div>
                  )}
                  {job.referral_code && (
                    <div className="bg-slate-800/70 p-4 rounded-xl border border-green-500/15">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Referral Code</p>
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-white bg-slate-700/50 px-2 py-0.5 rounded text-sm">{job.referral_code}</code>
                        <button onClick={() => copyReferralCode(job.referral_code!)} className="p-1.5 hover:bg-green-500/20 rounded-lg transition-colors">
                          {copiedReferralCode ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {job.referral_bonus_amount && (
                    <div className="bg-slate-800/70 p-4 rounded-xl border border-green-500/15">
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1">Referral Bonus</p>
                      <p className="font-bold text-green-400 text-lg">{job.referral_bonus_amount.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {job.referral_terms && (
                  <div className="mt-4 bg-slate-800/70 rounded-xl p-4 border border-green-500/15">
                    <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium mb-1.5">Terms</p>
                    <p className="text-sm text-slate-300">{job.referral_terms}</p>
                  </div>
                )}

                {job.referral_link && (
                  <a href={job.referral_link} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-medium transition-colors">
                    <ExternalLink className="w-4 h-4" />
                    Apply via Referral Link
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Apply Card */}
              <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
                <h3 className="text-base font-bold text-white mb-3">Apply for this role</h3>
                <p className="text-sm text-slate-400 mb-5">
                  Choose manual apply or optimize your resume with AI for a better match.
                </p>
                <button
                  onClick={handleApplyClick}
                  className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Zap className="w-5 h-5" />
                  Apply Now
                </button>
              </div>

              {/* Short Description */}
              {job.short_description && (
                <div className="bg-slate-800/60 rounded-2xl border border-slate-700/40 p-6">
                  <h3 className="text-base font-bold text-white mb-3">Summary</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{job.short_description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Apply (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/40 p-3 shadow-2xl z-40">
        <button
          onClick={handleApplyClick}
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Zap className="w-5 h-5" />
          Apply Now
        </button>
      </div>

      <ApplicationMethodModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        job={job}
        onManualApply={handleManualApply}
        onAIOptimizedApply={handleAIOptimizedApply}
        onScoreCheck={handleScoreCheck}
      />
    </div>
  );
};
