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
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <div className="hidden sm:flex items-center space-x-2 flex-shrink-0">
                  <IndiaFlag width={38} />
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse text-orange-300" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
                    <h3 className="text-base sm:text-lg md:text-xl font-bold truncate">
                      Independence Day Special
                    </h3>
                    <span className="text-xl sm:text-2xl md:text-3xl font-extrabold bg-white text-orange-600 px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg shadow-lg inline-block">
                      {INDEPENDENCE_OFFER.discountPercentage}% OFF
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm md:text-base mt-1">
                    Code:{' '}
                    <span className="font-bold bg-white text-green-700 px-1.5 py-0.5 sm:px-2 rounded">
                      {INDEPENDENCE_OFFER.code}
                    </span>
                  </p>
                </div>
              </div>

              {/* Countdown - md and up */}
              <div className="hidden md:flex items-center space-x-2 flex-shrink-0">
                {[
                  { value: timeLeft.days, label: 'Days' },
                  { value: timeLeft.hours, label: 'Hours' },
                  { value: timeLeft.minutes, label: 'Mins' },
                  { value: timeLeft.seconds, label: 'Secs' },
                ].map(({ value, label }) => (
                  <div
                    key={label}
                    className="text-center bg-white/20 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg backdrop-blur-sm"
                  >
                    <div className="text-lg sm:text-xl font-bold">{value}</div>
                    <div className="text-xs">{label}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={onCTAClick}
                className="bg-white text-orange-600 font-bold px-3 py-1.5 sm:px-4 sm:py-2 md:px-6 rounded-lg hover:bg-orange-50 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base flex-shrink-0"
              >
                Claim Now
              </button>

              <button
                onClick={onClose}
                className="absolute top-2 right-2 text-white/70 hover:text-white transition-colors"
                aria-label="Close banner"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default IndependenceOfferBanner;
