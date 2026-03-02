import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  Briefcase,
  MapPin,
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { JobListing } from '../../types/jobs';
import { jobsService } from '../../services/jobsService';
import { JobCard } from '../jobs/JobCard';
import { useSEO, injectJsonLd, removeJsonLd } from '../../hooks/useSEO';
import { FloatingParticles } from '../ui';

interface CompanyJobsPageProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
  onShowProfile?: (mode?: 'profile' | 'wallet') => void;
}

export const CompanyJobsPage: React.FC<CompanyJobsPageProps> = ({
  isAuthenticated,
  onShowAuth,
  onShowProfile,
}) => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyWebsite, setCompanyWebsite] = useState<string | null>(null);
  const [companyDescription, setCompanyDescription] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = companyName || (companySlug || '').replace(/-/g, ' ');

  useSEO({
    title: `${displayName} Jobs & Openings - Apply Now`,
    description: `Browse ${total} latest job openings at ${displayName}. Find ${displayName} careers, fresher & experienced roles. Apply directly on PrimoBoost AI.`,
    canonical: `/jobs/company/${companySlug}`,
    ogType: 'website',
    ogImage: companyLogo || undefined,
    twitterCard: 'summary_large_image',
  });

  useEffect(() => {
    const fetchCompanyJobs = async () => {
      if (!companySlug) {
        navigate('/jobs');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const result = await jobsService.getJobsByCompany(companySlug);
        setJobs(result.jobs);
        setCompanyName(result.companyName);
        setCompanyLogo(result.companyLogo);
        setCompanyWebsite(result.companyWebsite);
        setCompanyDescription(result.companyDescription);
        setTotal(result.total);

        if (result.jobs.length > 0) {
          const jobPostings = result.jobs.slice(0, 20).map((j) => ({
            '@type': 'JobPosting',
            title: j.role_title,
            description: (j.short_description || j.description || '').substring(0, 500),
            datePosted: j.posted_date || j.created_at,
            hiringOrganization: {
              '@type': 'Organization',
              name: j.company_name,
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
            url: `https://primoboost.ai/jobs/${j.id}`,
          }));

          injectJsonLd('company-jobs-structured-data', {
            '@context': 'https://schema.org',
            '@graph': jobPostings,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company jobs');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyJobs();
    return () => removeJsonLd('company-jobs-structured-data');
  }, [companySlug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mb-4" />
          <p className="text-lg text-slate-300">Loading {displayName} jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden lg:pl-16 bg-gradient-to-b from-[#0a1e1e] via-[#0d1a1a] to-[#070b14]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.15),transparent_50%)]" />
      <FloatingParticles count={10} />

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-6">
          <ol className="flex items-center gap-1">
            <li>
              <button onClick={() => navigate('/jobs')} className="hover:text-emerald-400 font-medium transition-colors">
                Jobs
              </button>
            </li>
            <li className="mx-1" aria-hidden="true">/</li>
            <li className="font-semibold text-slate-200">{displayName}</li>
          </ol>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 mb-8"
        >
          <div className="flex items-start gap-6">
            {companyLogo ? (
              <img
                src={companyLogo}
                alt={`${displayName} company logo`}
                className="w-20 h-20 rounded-xl object-contain bg-slate-700/50 p-2 border border-slate-600"
                loading="eager"
                width={80}
                height={80}
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                {displayName} Jobs & Openings
              </h1>
              <p className="text-lg text-slate-300 mb-4">
                {total} open position{total !== 1 ? 's' : ''} available
              </p>
              {companyDescription && (
                <p className="text-slate-400 mb-4 line-clamp-3">{companyDescription}</p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {companyWebsite && (
                  <a
                    href={companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Company Website</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => navigate('/jobs')}
                  className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>All Jobs</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 mb-8 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!error && jobs.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-200 mb-2">No openings found</h2>
            <p className="text-slate-400 mb-6">
              We don't have any active job listings for {displayName} right now.
            </p>
            <button
              onClick={() => navigate('/jobs')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Browse All Jobs
            </button>
          </div>
        )}

        {!error && jobs.length > 0 && (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                isAuthenticated={isAuthenticated}
                onShowAuth={onShowAuth}
                onCompleteProfile={() => onShowProfile && onShowProfile('profile')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
