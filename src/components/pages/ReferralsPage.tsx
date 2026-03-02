import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  Briefcase,
  IndianRupee,
  Code,
  ChevronRight,
  Search,
  Filter,
  Users,
  Star,
  Shield,
} from 'lucide-react';
import { referralService } from '../../services/referralService';
import type { ReferralListing, ReferralPricing } from '../../types/referral';

interface ReferralsPageProps {
  onShowAuth: (callback?: () => void) => void;
}

export const ReferralsPage: React.FC<ReferralsPageProps> = ({ onShowAuth }) => {
  const navigate = useNavigate();
  const [listings, setListings] = useState<ReferralListing[]>([]);
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCompany, setFilterCompany] = useState('');

  useEffect(() => {
    const load = async () => {
      const [listingsData, pricingData] = await Promise.all([
        referralService.getActiveListings(),
        referralService.getPricing(),
      ]);
      setListings(listingsData);
      setPricing(pricingData);
      setLoading(false);
    };
    load();
  }, []);

  const companies = [...new Set(listings.map((l) => l.company_name))].sort();

  const filtered = listings.filter((l) => {
    const matchesSearch =
      !searchQuery ||
      l.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.role_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.tech_stack.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCompany = !filterCompany || l.company_name === filterCompany;
    return matchesSearch && matchesCompany;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
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
            <span>Company Referrals</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
            Get Referred to Top Companies
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Access employee referrals at leading companies. Get your profile in front of hiring managers through verified referrers.
          </p>
        </motion.div>

        {pricing && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
          >
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 text-center">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 mx-auto mb-3">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">Referral Query</p>
              <p className="text-slate-500 text-xs mt-1">Get referrer contact details</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 text-center">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mx-auto mb-3">
                <Star className="w-5 h-5" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">Profile Monetization</p>
              <p className="text-slate-500 text-xs mt-1">Get your profile shared with referrer</p>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-5 text-center">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 mx-auto mb-3">
                <Shield className="w-5 h-5" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">Consultation Slot</p>
              <p className="text-slate-500 text-xs mt-1">{pricing.slot_duration_minutes}-min resume review session</p>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by company, role, or tech..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl text-white text-sm appearance-none focus:outline-none focus:border-emerald-500/50 min-w-[160px]"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No referrals available right now.</p>
            <p className="text-slate-500 text-sm mt-1">Check back soon for new opportunities!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((listing, i) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
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
                  <div className="flex flex-wrap gap-1.5">
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

                {(listing.query_price !== null || listing.profile_price !== null || listing.slot_price !== null) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {listing.query_price !== null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-xs">
                        <IndianRupee className="w-3 h-3" />
                        {listing.query_price / 100} Query
                      </span>
                    )}
                    {listing.profile_price !== null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-xs">
                        <IndianRupee className="w-3 h-3" />
                        {listing.profile_price / 100} Profile
                      </span>
                    )}
                    {listing.slot_price !== null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs">
                        <IndianRupee className="w-3 h-3" />
                        {listing.slot_price / 100} Slot
                      </span>
                    )}
                  </div>
                )}

                {listing.referrer_name && (
                  <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">
                      {listing.referrer_name[0]}
                    </div>
                    <span className="text-slate-400 text-xs">
                      Referred by <span className="text-slate-300 font-medium">{listing.referrer_name}</span>
                      {listing.referrer_designation && ` - ${listing.referrer_designation}`}
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
