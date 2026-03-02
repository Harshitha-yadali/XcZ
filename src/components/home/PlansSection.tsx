import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface PlansSectionProps {
  isAuthenticated: boolean;
  userSubscription: any;
  onShowSubscriptionPlans: (featureId?: string, expandAddons?: boolean) => void;
  onShowSubscriptionPlansDirectly: () => void;
}

export const PlansSection: React.FC<PlansSectionProps> = ({
  isAuthenticated,
  userSubscription,
  onShowSubscriptionPlans,
  onShowSubscriptionPlansDirectly,
}) => {
  const [showPlanDetails, setShowPlanDetails] = useState(false);

  if (!isAuthenticated) return null;

  return (
    <section className="bg-slate-950 py-12 sm:py-16 border-b border-slate-800/40">
      <div className="container-responsive">
        <div className="max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="relative inline-block text-left w-full">
            <motion.button
              onClick={() => setShowPlanDetails(!showPlanDetails)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-white/5 text-slate-100 font-semibold py-3 px-4 sm:px-6 rounded-xl flex items-center justify-between shadow-sm border border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="flex items-center text-sm sm:text-base">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-300 mr-2" />
                {userSubscription ? (
                  <span>
                    Optimizations Left:{' '}
                    <span className="font-bold">
                      {userSubscription.optimizationsTotal - userSubscription.optimizationsUsed}
                    </span>
                  </span>
                ) : (
                  <span>No Active Plan. Upgrade to use all features.</span>
                )}
              </span>
              {showPlanDetails ? (
                <ChevronUp className="w-5 h-5 ml-2" />
              ) : (
                <ChevronDown className="w-5 h-5 ml-2" />
              )}
            </motion.button>

            <AnimatePresence>
              {showPlanDetails && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute z-10 mt-2 w-full origin-top-right rounded-xl bg-[#0c111b] shadow-2xl border border-white/10"
                >
                  <div className="py-1">
                    {userSubscription ? (
                      <>
                        <div className="block px-4 py-2 text-sm text-slate-200">
                          <p className="font-semibold">{userSubscription.name} Plan</p>
                          <p className="text-xs text-slate-400">
                            Details for your current subscription.
                          </p>
                        </div>
                        <hr className="my-1 border-white/10" />
                        <div className="px-4 py-2 text-sm text-slate-200 space-y-1">
                          <div className="flex justify-between items-center">
                            <span>Optimizations:</span>
                            <span className="font-medium">
                              {userSubscription.optimizationsTotal -
                                userSubscription.optimizationsUsed}{' '}
                              / {userSubscription.optimizationsTotal}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span>Score Checks:</span>
                            <span className="font-medium">
                              {userSubscription.scoreChecksTotal -
                                userSubscription.scoreChecksUsed}{' '}
                              / {userSubscription.scoreChecksTotal}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="block px-4 py-2 text-sm text-slate-200">
                        You currently don't have an active subscription.
                      </div>
                    )}
                    <div className="p-4 border-t border-white/10">
                      <button
                        onClick={() => onShowSubscriptionPlans(undefined, true)}
                        className="w-full btn-primary py-2"
                      >
                        {userSubscription ? 'Upgrade Plan' : 'Choose Your Plan'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="text-center mt-8 sm:mt-12">
          <motion.button
            onClick={onShowSubscriptionPlansDirectly}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary px-6 sm:px-8 py-2.5 sm:py-3 border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 text-sm sm:text-base"
          >
            View All Plans & Add-ons
          </motion.button>
        </div>
      </div>
    </section>
  );
};
