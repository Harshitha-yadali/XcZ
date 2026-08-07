import type { Transition, Variants } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';

/**
 * Shared motion language.
 *
 * Before this existed the app used 15+ different durations and 7 different
 * easing curves for the same kinds of motion, which is what made screens feel
 * subtly inconsistent as you moved between them. Everything below is derived
 * from the curves already most used in the codebase — this codifies them
 * rather than inventing a new language.
 */

export const easing = {
  /** Default for almost everything. Matches the app-level page transition. */
  standard: [0.25, 0.46, 0.45, 0.94],
  /** Decelerate hard — entrances that should feel confident, not floaty. */
  emphasized: [0.22, 1, 0.36, 1],
  /** Symmetric. Only for things that loop or reverse (accordions, toggles). */
  inOut: [0.4, 0, 0.2, 1],
} as const;

export const duration = {
  /** Hover, focus, colour changes. Fast enough to feel instant. */
  fast: 0.2,
  /** Default. Cards, buttons, small reveals. */
  base: 0.3,
  /** Section entrances, modals. */
  slow: 0.45,
  /** Hero / above-the-fold only. Anything longer reads as sluggish. */
  slower: 0.6,
} as const;

/** Distance travelled on enter. Kept small — big travel is the #1 AI-slop tell. */
export const travel = {
  sm: 8,
  base: 16,
  lg: 24,
} as const;

export const transition: Record<'fast' | 'base' | 'slow' | 'slower', Transition> = {
  fast: { duration: duration.fast, ease: easing.standard },
  base: { duration: duration.base, ease: easing.standard },
  slow: { duration: duration.slow, ease: easing.standard },
  slower: { duration: duration.slower, ease: easing.emphasized },
};

/**
 * Reduced-motion aware presets.
 *
 * Only 4 of the 96 animated files respected `prefers-reduced-motion`. Using
 * these presets makes respecting it the default rather than an extra step:
 * opacity still animates (so nothing appears to pop in broken), but all
 * travel, scale and stagger collapse to zero.
 */
export function useMotionPresets() {
  const reduce = useReducedMotion();

  const shift = (axis: 'x' | 'y', distance: number) =>
    reduce ? {} : { [axis]: distance };

  const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: transition.base },
  };

  const fadeInUp: Variants = {
    hidden: { opacity: 0, ...shift('y', travel.base) },
    visible: { opacity: 1, y: 0, transition: transition.slow },
  };

  const fadeInDown: Variants = {
    hidden: { opacity: 0, ...shift('y', -travel.base) },
    visible: { opacity: 1, y: 0, transition: transition.slow },
  };

  const scaleIn: Variants = {
    hidden: { opacity: 0, ...(reduce ? {} : { scale: 0.96 }) },
    visible: { opacity: 1, scale: 1, transition: transition.base },
  };

  /** Parent for staggered lists. Pair with `staggerItem` on each child. */
  const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
    hidden: {},
    visible: {
      transition: reduce
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: stagger, delayChildren },
    },
  });

  const staggerItem: Variants = {
    hidden: { opacity: 0, ...shift('y', travel.sm) },
    visible: { opacity: 1, y: 0, transition: transition.base },
  };

  /** Standard scroll reveal props. Spread onto a motion element. */
  const reveal = (delay = 0) => ({
    initial: 'hidden' as const,
    whileInView: 'visible' as const,
    viewport: { once: true, amount: 0.2 },
    variants: {
      hidden: { opacity: 0, ...shift('y', travel.base) },
      visible: { opacity: 1, y: 0, transition: { ...transition.slow, delay: reduce ? 0 : delay } },
    } satisfies Variants,
  });

  /** Hover lift for cards. Returns nothing when reduced motion is on. */
  const hoverLift = (distance = 4) =>
    reduce ? {} : { y: -distance, transition: transition.fast };

  const modal: Variants = {
    hidden: { opacity: 0, ...(reduce ? {} : { scale: 0.97, y: travel.sm }) },
    visible: { opacity: 1, scale: 1, y: 0, transition: transition.slow },
    exit: { opacity: 0, ...(reduce ? {} : { scale: 0.98 }), transition: transition.fast },
  };

  return {
    reduce,
    fadeIn,
    fadeInUp,
    fadeInDown,
    scaleIn,
    staggerContainer,
    staggerItem,
    reveal,
    hoverLift,
    modal,
    transition,
    easing,
    duration,
  };
}
