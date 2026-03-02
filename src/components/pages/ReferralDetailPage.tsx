import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  MapPin,
  Briefcase,
  IndianRupee,
  Code,
  ArrowLeft,
  Search,
  Star,
  Shield,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  UserCheck,
  CalendarCheck,
  X,
} from 'lucide-react';
import { referralService } from '../../services/referralService';
import { SlotBookingPanel } from '../referral/SlotBookingPanel';
import type { ReferralListing, ReferralPricing, ReferralSlotType } from '../../types/referral';

interface ReferralDetailPageProps {
  onShowAuth: (callback?: () => void) => void;
}

interface ServiceCardInfo {
  key: ReferralSlotType;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  cardIcon: React.ReactNode;
  accentColor: string;
  borderColor: string;
  bgGradient: string;
  iconBg: string;
  getPrice: (p: ReferralPricing, listing?: ReferralListing) => number;
}

const serviceCards: ServiceCardInfo[] = [
  {
    key: 'query',
    title: 'Referral Query',
    subtitle: '15-min slots | Get referrer contact details',
    description: 'Connect directly with the referrer to get your profile referred for this role.',
    features: ['Direct referrer contact', 'Profile forwarding', '15-min call slot'],
    icon: <Search className="w-5 h-5 text-blue-400" />,
    cardIcon: <MessageCircle className="w-6 h-6" />,
    accentColor: 'text-blue-400',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    bgGradient: 'from-blue-500/5 to-blue-600/10',
    iconBg: 'bg-blue-500/10',
    getPrice: (p, l) => l?.query_price ?? p.query_price,
  },
  {
    key: 'profile',
    title: 'Profile Monetization',
    subtitle: '1-hour session | Profile shared with referrer',
    description: 'Your resume and profile are shared with the referrer for a detailed review and referral.',
    features: ['Resume shared with referrer', 'Detailed profile review', 'Priority referral'],
    icon: <Star className="w-5 h-5 text-amber-400" />,
    cardIcon: <UserCheck className="w-6 h-6" />,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/30 hover:border-amber-500/60',
    bgGradient: 'from-amber-500/5 to-amber-600/10',
    iconBg: 'bg-amber-500/10',
    getPrice: (p, l) => l?.profile_price ?? p.profile_price,
  },
  {
    key: 'consultation',
    title: 'Consultation Slot',
    subtitle: '15-min slots | Resume review session',
    description: 'Book a one-on-one consultation to get expert guidance on your resume and interview prep.',
    features: ['1-on-1 expert guidance', 'Resume & interview tips', 'Personalized feedback'],
    icon: <Shield className="w-5 h-5 text-emerald-400" />,
    cardIcon: <CalendarCheck className="w-6 h-6" />,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    bgGradient: 'from-emerald-500/5 to-emerald-600/10',
    iconBg: 'bg-emerald-500/10',
    getPrice: (p, l) => l?.slot_price ?? p.slot_price,
  },
];

export const ReferralDetailPage: React.FC<ReferralDetailPageProps> = ({ onShowAuth }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [listing, setListing] = useState<ReferralListing | null>(null);
  const [pricing, setPricing] = useState<ReferralPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReferralSlotType | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);

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

  const activeConfig = activeTab ? serviceCards.find((c) => c.key === activeTab) : null;

  return (
    <div className="min-h-screen pb-20 md:pl-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
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
          className="bg-gradient-to-br from-[#0d1f2d] to-[#0a1a24] border border-slate-700/50 rounded-2xl overflow-hidden mb-8"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4 mb-6">
              {listing.company_logo_url ? (
                <img
                  src={listing.company_logo_url}
                  alt={listing.company_name}
                  className="w-16 h-16 rounded-xl object-contain bg-white/5 p-2 flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 text-emerald-400" />
                </div>
              )}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{listing.company_name}</h1>
                <p className="text-slate-300 text-lg font-medium">{listing.role_title}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-6">
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

            {listing.tech_stack.length > 0 && (
              <div className="mb-6">
                <p className="text-slate-400 text-sm font-medium mb-2">Tech Stack</p>
                <div className="flex flex-wrap gap-2">
                  {listing.tech_stack.map((tech) => (
                    <span
                      key={tech}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-sm font-medium"
                    >
                      <Code className="w-3.5 h-3.5" />
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {listing.job_description && (
              <div>
                <p className="text-slate-400 text-sm font-medium mb-2">Job Description</p>
                <div className="bg-slate-800/40 rounded-xl p-4 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {listing.job_description}
                </div>
              </div>
            )}

            {listing.referrer_name && (
              <div className="mt-6 pt-4 border-t border-slate-700/40 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                  {listing.referrer_name[0]}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">Referred by {listing.referrer_name}</p>
                  {listing.referrer_designation && (
                    <p className="text-slate-400 text-xs">{listing.referrer_designation}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {!activeTab && (
          <>
            <h2 className="text-white font-bold text-xl mb-4">Choose a Service</h2>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              {serviceCards.map((card) => {
                const price = pricing ? card.getPrice(pricing, listing) / 100 : 0;
                return (
                  <motion.button
                    key={card.key}
                    onClick={() => setActiveTab(card.key)}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative text-left p-5 rounded-2xl border bg-[#0d1f2d]/80 border-slate-700/40 hover:border-slate-600/60 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center ${card.accentColor}`}>
                        {card.cardIcon}
                      </div>
                      {pricing && price > 0 && (
                        <span className={`text-lg font-bold ${card.accentColor}`}>
                          {'\u20B9'}{price}
                        </span>
                      )}
                    </div>
                    <h3 className="text-white font-bold text-base mb-1">{card.title}</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mb-3">{card.description}</p>
                    <ul className="space-y-1.5 mb-4">
                      {card.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                          <div className={`w-1.5 h-1.5 rounded-full ${card.iconBg} flex-shrink-0`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                      Book Now
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}

        {activeTab && activeConfig && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${activeConfig.iconBg} flex items-center justify-center ${activeConfig.accentColor}`}>
                  {activeConfig.cardIcon}
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">{activeConfig.title}</h2>
                  <p className="text-slate-400 text-xs">{activeConfig.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowSwitcher(!showSwitcher)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-300 text-xs font-medium hover:border-slate-600 transition-colors"
                  >
                    Switch
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSwitcher ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showSwitcher && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute right-0 top-full mt-1 z-20 w-52 bg-[#0d1f2d] border border-slate-700/60 rounded-xl overflow-hidden shadow-xl"
                      >
                        {serviceCards.filter((c) => c.key !== activeTab).map((card) => {
                          const price = pricing ? card.getPrice(pricing, listing) / 100 : 0;
                          return (
                            <button
                              key={card.key}
                              onClick={() => { setActiveTab(card.key); setShowSwitcher(false); }}
                              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-slate-800/60 transition-colors text-left"
                            >
                              <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center ${card.accentColor} flex-shrink-0`}>
                                {card.cardIcon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{card.title}</p>
                                {pricing && price > 0 && (
                                  <p className="text-slate-500 text-xs">{'\u20B9'}{price}</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => { setActiveTab(null); setShowSwitcher(false); }}
                  className="p-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="bg-gradient-to-br from-[#0d1f2d] to-[#0a1a24] border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                <SlotBookingPanel
                  listingId={listing.id}
                  slotType={activeTab}
                  title={activeConfig.title}
                  subtitle={activeConfig.subtitle}
                  icon={activeConfig.icon}
                  accentColor={activeConfig.iconBg}
                  onShowAuth={() => onShowAuth(() => navigate(`/referrals/${id}`))}
                  listingQueryPrice={listing.query_price}
                  listingProfilePrice={listing.profile_price}
                  listingSlotPrice={listing.slot_price}
                />
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};
