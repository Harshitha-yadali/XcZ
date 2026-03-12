import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Building2, IndianRupee, UploadCloud } from 'lucide-react';
import { referralService } from '../../services/referralService';
import { ReferralSubmissionPanel } from '../referral/ReferralSubmissionPanel';
import type { ReferralListing, ReferralPricing } from '../../types/referral';

interface ReferralSubmissionPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const ReferralSubmissionPage: React.FC<ReferralSubmissionPageProps> = ({ onShowAuth }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<ReferralListing | null>(null);
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

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

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <button
          onClick={() => navigate(`/referrals/${listing.id}`)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Referral Details
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#0d1f2d] to-[#0a1a24] border border-slate-700/50 rounded-3xl overflow-hidden mb-8"
        >
          <div className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start gap-4">
                {listing.company_logo_url ? (
                  <img
                    src={listing.company_logo_url}
                    alt={listing.company_name}
                    className="w-14 h-14 rounded-2xl object-contain bg-white/5 p-2 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-emerald-400" />
                  </div>
                )}

                <div>
                  <p className="text-emerald-300 text-xs font-semibold uppercase tracking-[0.24em] mb-2">
                    Step 2 Of 2
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white">
                    Submit Email and Resume
                  </h1>
                  <p className="text-slate-300 text-base mt-2">
                    {listing.company_name} - {listing.role_title}
                  </p>
                  <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                    Payment is complete. This page is only for entering the email ID and uploading the resume PDF.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 min-w-[160px]">
                <div className="flex items-center gap-2 text-emerald-300 text-xs uppercase tracking-wide mb-1">
                  <IndianRupee className="w-3.5 h-3.5" />
                  Price Paid
                </div>
                <p className="text-white text-3xl font-bold">
                  {amountDisplay !== null ? `\u20B9${amountDisplay}` : '-'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Final step</h2>
              <p className="text-slate-400 text-sm mt-1">
                Add the client email ID and upload the resume PDF here. This is separate from the payment page.
              </p>
            </div>
          </div>
        </motion.div>

        <ReferralSubmissionPanel
          listing={listing}
          stage="submission"
          onShowAuth={() => onShowAuth(() => navigate(`/referrals/${listing.id}/submit`))}
          onReturnToPayment={() => navigate(`/referrals/${listing.id}`)}
        />
      </div>
    </div>
  );
};
