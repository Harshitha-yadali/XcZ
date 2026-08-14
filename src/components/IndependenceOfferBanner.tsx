// src/components/IndependenceOfferBanner.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IndiaFlag } from './ui/IndependenceTheme';
import { INDEPENDENCE_OFFER } from '../config/independenceOffer';

interface IndependenceOfferBannerProps {
  onCTAClick: () => void;
  onClose: () => void;
}

export const IndependenceOfferBanner: React.FC<IndependenceOfferBannerProps> = ({
  onCTAClick,
  onClose,
}) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Ends 15 Aug, end of day
  const offerEndTs = useMemo(() => {
    const end = new Date();
    end.setMonth(7, 15);
    end.setHours(23, 59, 59, 0);
    return end.getTime();
  }, []);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, offerEndTs - Date.now());

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });

      if (diff === 0) onClose(); // auto-hide on expiry
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [offerEndTs, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-0 left-0 right-0 z-50 text-white shadow-2xl"
        style={{
          background:
            'linear-gradient(90deg, #FF9933 0%, #f5f5f5 50%, #138808 100%)',
        }}
      >
        {/* Readability layer over the white middle of the tricolour */}
        <div className="bg-slate-950/70">
          {/* w-full, not `container`: the xs:320px breakpoint caps .container at 320px on phones */}
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <IndiaFlag width={26} className="flex-shrink-0" />
              <Sparkles className="hidden sm:block w-5 h-5 animate-pulse text-orange-300 flex-shrink-0" />

              <div className="min-w-0">
                <h3 className="hidden sm:block text-base md:text-lg font-bold leading-tight">
                  Independence Day Special
                </h3>
                <div className="flex items-center gap-1.5 sm:gap-2 sm:mt-1">
                  <span className="text-base sm:text-xl font-extrabold bg-white text-orange-600 px-1.5 sm:px-2.5 py-0.5 rounded-md shadow whitespace-nowrap flex-shrink-0">
                    {INDEPENDENCE_OFFER.discountPercentage}% OFF
                  </span>
                  <span className="hidden sm:inline text-sm text-white/80 whitespace-nowrap">Code</span>
                  <span className="font-bold bg-white text-green-700 px-1.5 sm:px-2 py-0.5 rounded text-[11px] sm:text-sm whitespace-nowrap flex-shrink-0">
                    {INDEPENDENCE_OFFER.code}
                  </span>
                </div>
              </div>

              {/* Countdown - md and up */}
              <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                {[
                  { value: timeLeft.days, label: timeLeft.days === 1 ? 'Day' : 'Days' },
                  { value: timeLeft.hours, label: 'Hours' },
                  { value: timeLeft.minutes, label: 'Mins' },
                  { value: timeLeft.seconds, label: 'Secs' },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="text-center bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm"
                  >
                    <div className="text-lg font-bold leading-tight">{value}</div>
                    <div className="text-[10px]">{label}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={onCTAClick}
                className="ml-auto bg-white text-orange-600 font-bold px-2.5 py-1.5 sm:px-5 sm:py-2 rounded-lg hover:bg-orange-50 transition-colors shadow-lg text-xs sm:text-base whitespace-nowrap flex-shrink-0"
              >
                Claim<span className="hidden sm:inline"> Now</span>
              </button>

              <button
                onClick={onClose}
                className="text-white/70 hover:text-white transition-colors flex-shrink-0 p-0.5"
                aria-label="Close banner"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IndependenceOfferBanner;
