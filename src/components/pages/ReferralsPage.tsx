import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  ChevronRight,
  Code,
  Filter,
  IndianRupee,
  MapPin,
  Search,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { referralService } from '../../services/referralService';
import type { ReferralListing, ReferralPricing } from '../../types/referral';
import { useAuth } from '../../contexts/AuthContext';

interface ReferralsPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const ReferralsPage: React.FC<ReferralsPageProps> = ({ onShowAuth }) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [listings, setListings] = useState<ReferralListing[]>([]);
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated) {
        setListings([]);
        setPricing(null);
        setLoading(false);
        return;
      }

      const [listingsData, pricingData] = await Promise.all([
        referralService.getActiveListings(),
        referralService.getPricing(),
      ]);

      setListings(listingsData);
      setPricing(pricingData);
      setLoading(false);
    };

    load();
  }, [isAuthenticated]);

  const companies = [...new Set(listings.map((listing) => listing.company_name))].sort();

  const filteredListings = listings.filter((listing) => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch =
      !normalizedQuery ||
      listing.company_name.toLowerCase().includes(normalizedQuery) ||
      listing.role_title.toLowerCase().includes(normalizedQuery) ||
      listing.tech_stack.some((tech) => tech.toLowerCase().includes(normalizedQuery));

    const matchesCompany = !filterCompany || listing.company_name === filterCompany;
    return matchesSearch && matchesCompany;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen pb-20 md:pl-16 flex items-center justify-center px-4">
        <div className="max-w-xl w-full text-center space-y-4">
          <p className="text-3xl font-bold text-white">Sign in to view referrals</p>
          <p className="text-slate-400 text-sm leading-relaxed">
            Log in to open referral cards, see the admin-set price for each listing, complete payment, and upload your email + PDF resume.
          </p>
          <button
            onClick={() => onShowAuth(() => navigate('/referrals'))}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all inline-flex items-center justify-center gap-2"
          >
            Sign in to continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-5">
            <Users className="w-4 h-4" />
            <span>Referral Requests</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Submit Paid Referrals to Top Companies
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            Click any referral card to open the full job details, review the admin-set price, complete payment, and upload your email ID plus PDF resume for processing.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-4 mb-8"
        >
          {[
            {
              title: 'Open the card',
              description: 'See full role details, company info, and the referral price set by the admin.',
              icon: <BadgeCheck className="w-5 h-5" />,
            },
            {
              title: 'Pay securely',
              description: 'Complete the payment for the referral listing you want to submit.',
              icon: <ShieldCheck className="w-5 h-5" />,
            },
            {
              title: 'Upload email + PDF',
              description: 'After payment, submit your contact email and PDF resume so our team can process it.',
              icon: <UploadCloud className="w-5 h-5" />,
            },
          ].map((step) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-700/40 bg-slate-900/60 p-5 text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center mb-3">
                {step.icon}
              </div>
              <h2 className="text-white font-semibold text-base mb-1">{step.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </motion.div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by company, role, or tech..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterCompany}
              onChange={(event) => setFilterCompany(event.target.value)}
              className="pl-10 pr-8 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 min-w-[160px]"
            >
              <option value="">All Companies</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No referrals available right now.</p>
            <p className="text-slate-500 text-sm mt-1">Check back soon for new opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredListings.map((listing, index) => {
              const amountPaise = referralService.getResolvedReferralPrice(listing, pricing);
              const amountDisplay = amountPaise > 0 ? amountPaise / 100 : null;

              return (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.04 }}
                  onClick={() => navigate(`/referrals/${listing.id}`)}
                  className="bg-gradient-to-br from-[#0d1f2d] to-[#0a1a24] border border-slate-700/50 rounded-2xl p-5 sm:p-6 cursor-pointer hover:border-emerald-500/30 transition-all group"
                >
                  <div className="flex items-start gap-4 mb-4">
                    {listing.company_logo_url ? (
                      <img
                        src={listing.company_logo_url}
                        alt={listing.company_name}
                        className="w-12 h-12 rounded-xl object-contain bg-white/5 p-1.5 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-emerald-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-bold text-lg truncate group-hover:text-emerald-400 transition-colors">
                        {listing.company_name}
                      </h3>
                      <p className="text-slate-300 text-sm font-medium truncate">{listing.role_title}</p>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-emerald-400 transition-colors flex-shrink-0 mt-1" />
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {listing.experience_range && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 text-xs">
                        <Briefcase className="w-3 h-3" />
                        {listing.experience_range}
                      </span>
                    )}
                    {listing.package_range && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 text-xs">
                        <IndianRupee className="w-3 h-3" />
                        {listing.package_range}
                      </span>
                    )}
                    {listing.location && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/60 text-slate-300 text-xs">
                        <MapPin className="w-3 h-3" />
                        {listing.location}
                      </span>
                    )}
                  </div>

                  {listing.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {listing.tech_stack.slice(0, 5).map((tech) => (
                        <span
                          key={tech}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-medium"
                        >
                          <Code className="w-3 h-3" />
                          {tech}
                        </span>
                      ))}
                      {listing.tech_stack.length > 5 && (
                        <span className="text-slate-500 text-xs self-center">
                          +{listing.tech_stack.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-700/40">
                    <div>
                      <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Referral Price</p>
                      <p className="text-white font-semibold text-sm">
                        {amountDisplay !== null ? `\u20B9${amountDisplay}` : 'Price pending'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-emerald-300 text-sm font-semibold">Refer Me</p>
                      <p className="text-slate-500 text-xs">Pay, add email, upload resume</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
