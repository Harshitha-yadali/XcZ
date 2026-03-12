import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Building2,
  Code,
  IndianRupee,
  MapPin,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { referralService } from '../../services/referralService';
import { ReferralSubmissionPanel } from '../referral/ReferralSubmissionPanel';
import type { ReferralListing, ReferralPricing } from '../../types/referral';

interface ReferralDetailPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const ReferralDetailPage: React.FC<ReferralDetailPageProps> = ({ onShowAuth }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<ReferralListing | null>(null);
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      const [listingData, pricingData] = await Promise.all([
        referralService.getListingById(id),
        referralService.getPricing(),
      ]);

      setListing(listingData);
      setPricing(pricingData);
      setLoading(false);
    };

    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-slate-400 text-lg">Referral not found.</p>
      </div>
    );
  }

  const amountPaise = referralService.getResolvedReferralPrice(listing, pricing);
  const amountDisplay = amountPaise > 0 ? amountPaise / 100 : null;
  const scrollToSubmissionFlow = () => {
    const submissionPanel = document.getElementById('referral-submit-flow');
    submissionPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <button
          onClick={() => navigate('/referrals')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Referrals
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#0d1f2d] to-[#0a1a24] border border-slate-700/50 rounded-3xl overflow-hidden mb-8"
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              <div className="flex items-start gap-4">
                {listing.company_logo_url ? (
                  <img
                    src={listing.company_logo_url}
                    alt={listing.company_name}
                    className="w-16 h-16 rounded-2xl object-contain bg-white/5 p-2 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-8 h-8 text-emerald-400" />
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <p className="text-emerald-300 text-xs font-semibold uppercase tracking-[0.24em] mb-2">
                      Paid Referral Listing
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white">{listing.company_name}</h1>
                    <p className="text-slate-300 text-lg font-medium">{listing.role_title}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {listing.experience_range && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-300 text-sm">
                        <Briefcase className="w-4 h-4" />
                        {listing.experience_range}
                      </span>
                    )}
                    {listing.package_range && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-300 text-sm">
                        <IndianRupee className="w-4 h-4" />
                        {listing.package_range}
                      </span>
                    )}
                    {listing.location && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 text-slate-300 text-sm">
                        <MapPin className="w-4 h-4" />
                        {listing.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 min-w-[180px]">
                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-[0.2em] mb-1">
                  Referral Price
                </p>
                <p className="text-white text-3xl font-bold">
                  {amountDisplay !== null ? `\u20B9${amountDisplay}` : 'Not set'}
                </p>
                <p className="text-slate-400 text-xs mt-2">
                  Admin-configured price for this listing.
                </p>
                <button
                  type="button"
                  onClick={scrollToSubmissionFlow}
                  className="mt-4 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Refer Me
                </button>
                <p className="text-slate-500 text-[11px] mt-2">
                  Pay first. The email ID and resume upload open on the next page.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] gap-6 items-start">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6"
            >
              <h2 className="text-white font-bold text-lg mb-4">What happens after you pay</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    title: 'Secure payment',
                    description: 'Click Refer Me and pay the referral amount configured by the admin.',
                    icon: <IndianRupee className="w-5 h-5" />,
                  },
                  {
                    title: 'Open next page',
                    description: 'After payment, continue to the separate page for submission.',
                    icon: <ShieldCheck className="w-5 h-5" />,
                  },
                  {
                    title: 'Submit email + PDF',
                    description: 'Enter your email ID and upload your resume PDF there.',
                    icon: <BadgeCheck className="w-5 h-5" />,
                  },
                ].map((step) => (
                  <div
                    key={step.title}
                    className="rounded-xl border border-slate-700/40 bg-slate-950/50 p-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-3">
                      {step.icon}
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {listing.tech_stack.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6"
              >
                <h2 className="text-white font-bold text-lg mb-4">Tech Stack</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 text-sm font-medium"
                    >
                      <Code className="w-3.5 h-3.5" />
                      {tech}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6"
            >
              <h2 className="text-white font-bold text-lg mb-4">Job Description</h2>
              <div className="bg-slate-950/50 border border-slate-700/30 rounded-xl p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {listing.job_description || 'No extra description was added for this referral listing.'}
              </div>
            </motion.div>

            {listing.referrer_name && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-300 flex-shrink-0">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg mb-1">Referrer Details</h2>
                    <p className="text-slate-300 text-sm">
                      {listing.referrer_name}
                      {listing.referrer_designation ? ` - ${listing.referrer_designation}` : ''}
                    </p>
                    <p className="text-slate-500 text-xs mt-2">
                      After you submit the paid referral request, the admin reviews your email and PDF before processing the referral.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <ReferralSubmissionPanel
              listing={listing}
              stage="payment"
              onShowAuth={() => onShowAuth(() => navigate(`/referrals/${listing.id}`))}
              onPaymentComplete={() => navigate(`/referrals/${listing.id}/submit`)}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
