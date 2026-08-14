// src/components/ui/IndependenceTheme.tsx
// Independence Day (15 Aug) theme components - tricolour flag + confetti.
// Note: the 🇮🇳 emoji does not render on Windows, so the flag is drawn with CSS.
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const SAFFRON = '#FF9933';
const GREEN = '#138808';
const NAVY = '#000080';

// Ashoka Chakra - 24 spokes
const AshokaChakra: React.FC<{ size?: number; spin?: boolean }> = ({ size = 14, spin = true }) => (
  <motion.svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    className="shrink-0"
    animate={spin ? { rotate: 360 } : undefined}
    transition={spin ? { duration: 12, repeat: Infinity, ease: 'linear' } : undefined}
  >
    <circle cx="50" cy="50" r="46" fill="none" stroke={NAVY} strokeWidth="6" />
    <circle cx="50" cy="50" r="8" fill={NAVY} />
    {[...Array(24)].map((_, i) => (
      <line
        key={i}
        x1="50"
        y1="50"
        x2="50"
        y2="6"
        stroke={NAVY}
        strokeWidth="3"
        transform={`rotate(${i * 15} 50 50)`}
      />
    ))}
  </motion.svg>
);

// Waving tricolour flag - stripes skew on a stagger to fake the wave
export const IndiaFlag: React.FC<{ width?: number; className?: string }> = ({
  width = 42,
  className = '',
}) => {
  const reduceMotion = useReducedMotion();
  const stripeHeight = width / 4.5;
  const stripes = [SAFFRON, '#FFFFFF', GREEN];

  return (
    <div
      className={`inline-flex flex-col overflow-hidden rounded-[2px] shadow-md ${className}`}
      style={{ width }}
      role="img"
      aria-label="Flag of India"
    >
      {stripes.map((color, i) => (
        <motion.div
          key={color}
          className="flex items-center justify-center"
          style={{ height: stripeHeight, backgroundColor: color }}
          animate={reduceMotion ? undefined : { skewY: [0, 2.5, 0, -2.5, 0] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }
          }
        >
          {i === 1 && <AshokaChakra size={stripeHeight * 0.85} spin={!reduceMotion} />}
        </motion.div>
      ))}
    </div>
  );
};

// Falling tricolour confetti - same approach as SnowEffect
const ConfettiPiece: React.FC<{ delay: number; duration: number; color: string }> = ({
  delay,
  duration,
  color,
}) => {
  const startX = Math.random() * 100;
  const drift = (Math.random() - 0.5) * 40;

  return (
    <motion.div
      className="fixed pointer-events-none z-40"
      style={{ left: `${startX}%`, top: -20, width: 6, height: 10, backgroundColor: color }}
      initial={{ y: -20, opacity: 0, rotate: 0 }}
      animate={{
        y: ['0vh', '105vh'],
        x: [0, drift * 0.4, drift, drift * 0.7],
        opacity: [0, 0.85, 0.85, 0],
        rotate: [0, 360],
      }}
      transition={{ duration, repeat: Infinity, delay, ease: 'linear' }}
    />
  );
};

export const TricolorConfetti: React.FC<{ intensity?: 'light' | 'medium' }> = ({
  intensity = 'light',
}) => {
  const reduceMotion = useReducedMotion();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const count = intensity === 'light' ? (isMobile ? 10 : 20) : isMobile ? 18 : 36;
  const colors = [SAFFRON, '#FFFFFF', GREEN];

  if (reduceMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {[...Array(count)].map((_, i) => (
        <ConfettiPiece
          key={i}
          delay={Math.random() * 10}
          duration={9 + Math.random() * 8}
          color={colors[i % colors.length]}
        />
      ))}
    </div>
  );
};
