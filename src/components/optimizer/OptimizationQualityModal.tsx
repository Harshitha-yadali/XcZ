import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Cpu, Loader2, Sparkles, X } from 'lucide-react';
import {
  DEFAULT_JD_OPTIMIZATION_TIER,
  JD_OPTIMIZATION_TIERS,
  type JdOptimizationPackage,
  type JdOptimizationPackageSize,
  type JdOptimizationTier,
  type JdOptimizationTierId,
} from '../../config/jdOptimizationTiers';

interface OptimizationQualityModalProps {
  isOpen: boolean;
  processingTier: JdOptimizationTierId | null;
  error?: string | null;
  onClose: () => void;
  onChoose: (tierId: JdOptimizationTierId, packageSize: JdOptimizationPackageSize) => void | Promise<void>;
}

type ComparisonRow = {
  label: string;
  value: (tier: JdOptimizationTier) => React.ReactNode;
};

const Included = ({ enabled }: { enabled: boolean }) =>
  enabled ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-300/10 font-semibold text-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.08)]">
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="inline-flex h-5 w-5 items-center justify-center text-slate-600" aria-label="Not included">—</span>
  );

const comparisonRows: ComparisonRow[] = [
  { label: 'ATS readability', value: () => <Included enabled /> },
  { label: 'JD match score', value: () => <Included enabled /> },
  { label: 'Missing keywords', value: () => <Included enabled /> },
  {
    label: 'Responsibility matching',
    value: (tier) => tier.id === 'quick' ? 'Basic' : tier.id === 'smart' ? 'Advanced' : 'Detailed',
  },
  {
    label: 'Project–JD match analysis',
    value: (tier) => tier.projectAnalysis
      ? tier.id === 'smart' ? 'Advanced' : 'Detailed'
      : <Included enabled={false} />,
  },
  { label: 'Section-by-section action plan', value: (tier) => <Included enabled={tier.id !== 'quick'} /> },
  {
    label: 'Professional summary rewriting',
    value: (tier) => tier.id === 'quick' ? 'Basic' : tier.id === 'smart' ? <Included enabled /> : 'Strategic rewrite',
  },
  {
    label: 'Experience bullet rewriting',
    value: (tier) => tier.id === 'quick' ? 'Basic' : tier.id === 'smart' ? <Included enabled /> : 'Impact-focused rewrite',
  },
  {
    label: 'Evidence-based project rewriting',
    value: (tier) => tier.id === 'quick' ? 'Basic' : tier.id === 'smart' ? <Included enabled /> : 'Detailed rewrite',
  },
  { label: 'Before/after score comparison', value: () => <Included enabled /> },
  {
    label: 'Role and seniority strategy',
    value: (tier) => tier.id === 'quick' ? <Included enabled={false} /> : tier.id === 'smart' ? 'Basic' : 'Detailed',
  },
  {
    label: 'Project improvement recommendations',
    value: (tier) => tier.id === 'quick' ? <Included enabled={false} /> : tier.id === 'smart' ? 'Basic' : 'Detailed',
  },
  {
    label: 'Unsupported-claim protection',
    value: (tier) => tier.id === 'quick' ? <Included enabled /> : tier.id === 'smart' ? 'Evidence validation' : 'Enhanced evidence audit',
  },
  {
    label: 'Processing depth',
    value: (tier) => tier.id === 'quick' ? '1 optimization stage' : tier.id === 'smart' ? '2 optimization stages' : '3 optimization stages',
  },
  { label: 'Editable optimized resume', value: () => <Included enabled /> },
  { label: 'PDF/Word export', value: () => <Included enabled /> },
  {
    label: 'Best for',
    value: (tier) => tier.id === 'quick' ? 'Fast basic rewrite' : tier.id === 'smart' ? 'Most applications' : 'Important and senior roles',
  },
];

const featureRows = comparisonRows.filter((row) => row.label !== 'Best for');
const bestForRow = comparisonRows.find((row) => row.label === 'Best for') as ComparisonRow;

const tierPalette: Record<JdOptimizationTierId, {
  accent: string;
  border: string;
  glow: string;
  soft: string;
  tab: string;
}> = {
  quick: {
    accent: 'text-cyan-300',
    border: 'border-cyan-300/25',
    glow: 'from-cyan-400/20 via-sky-400/5 to-transparent',
    soft: 'bg-cyan-300/10',
    tab: 'from-cyan-300 to-sky-400',
  },
  smart: {
    accent: 'text-emerald-300',
    border: 'border-emerald-300/30',
    glow: 'from-emerald-400/20 via-cyan-400/5 to-transparent',
    soft: 'bg-emerald-300/10',
    tab: 'from-emerald-300 to-cyan-400',
  },
  deep: {
    accent: 'text-violet-300',
    border: 'border-violet-300/30',
    glow: 'from-violet-500/20 via-blue-500/5 to-transparent',
    soft: 'bg-violet-300/10',
    tab: 'from-violet-400 to-blue-400',
  },
};

const PriceBlock = ({ tier, optimizationPackage, compact = false }: { tier: JdOptimizationTier; optimizationPackage: JdOptimizationPackage; compact?: boolean }) => (
  <div className={compact ? 'text-right' : 'mt-1'}>
    <div className="flex items-end gap-1.5 tabular-nums">
      <span className={`font-['Poppins'] font-bold leading-none tracking-[-0.045em] text-white ${compact ? 'text-2xl sm:text-3xl' : 'text-xl xl:text-2xl'}`}>
        ₹{optimizationPackage.offerPrice.toLocaleString('en-IN')}
      </span>
      <span className="pb-0.5 text-[10px] font-medium text-slate-500 line-through sm:text-xs">₹{optimizationPackage.regularValue.toLocaleString('en-IN')}</span>
    </div>
    <div className="mt-1 text-[9px] font-semibold text-slate-400 sm:text-[10px]">
      1 {tier.unitLabel} · {optimizationPackage.discountPercentage}% off
    </div>
  </div>
);

export const OptimizationQualityModal: React.FC<OptimizationQualityModalProps> = ({
  isOpen,
  processingTier,
  error,
  onClose,
  onChoose,
}) => {
  const [selectedTier, setSelectedTier] = useState<JdOptimizationTierId>(DEFAULT_JD_OPTIMIZATION_TIER);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const processingTierRef = useRef(processingTier);
  const reduceMotion = useReducedMotion();

  onCloseRef.current = onClose;
  processingTierRef.current = processingTier;

  const activeTier = JD_OPTIMIZATION_TIERS.find((tier) => tier.id === selectedTier) || JD_OPTIMIZATION_TIERS[1];
  const getSelectedPackage = (tier: JdOptimizationTier) =>
    tier.packages.find((item) => item.size === 1) || tier.packages[0];

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTier(DEFAULT_JD_OPTIMIZATION_TIER);
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const defaultTargets = dialogRef.current?.querySelectorAll<HTMLElement>('[data-default-focus="true"]');
      const visibleTarget = Array.from(defaultTargets || []).find((element) => element.offsetParent !== null);
      visibleTarget?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !processingTierRef.current) {
        onCloseRef.current();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.offsetParent !== null);

        if (!focusableElements.length) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen]);

  const renderAction = (tier: JdOptimizationTier) => {
    const isProcessing = processingTier === tier.id;
    const optimizationPackage = getSelectedPackage(tier);
    return (
      <motion.button
        type="button"
        data-default-focus={tier.id === DEFAULT_JD_OPTIMIZATION_TIER ? 'true' : undefined}
        onClick={() => onChoose(tier.id, optimizationPackage.size)}
        disabled={Boolean(processingTier)}
        whileHover={reduceMotion || processingTier ? undefined : { y: -2, scale: 1.005 }}
        whileTap={reduceMotion || processingTier ? undefined : { scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className={`group relative isolate inline-flex min-h-12 w-full overflow-hidden rounded-xl px-4 py-3 font-['Poppins'] text-[13px] font-semibold tracking-[-0.01em] transition-shadow disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm ${
          tier.id === 'smart'
            ? 'bg-gradient-to-r from-emerald-300 to-cyan-400 text-slate-950 shadow-[0_12px_35px_rgba(52,211,153,0.24)] hover:shadow-[0_16px_45px_rgba(34,211,238,0.28)]'
            : tier.id === 'deep'
              ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-[0_12px_35px_rgba(99,102,241,0.2)] hover:shadow-[0_16px_45px_rgba(99,102,241,0.28)]'
              : 'border border-cyan-200/15 bg-white/[0.07] text-white shadow-[0_12px_35px_rgba(2,132,199,0.08)] hover:bg-white/[0.11]'
        }`}
      >
        <span className="absolute inset-0 -z-10 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" aria-hidden="true" />
        <span className="relative inline-flex items-center justify-center gap-2">
          {isProcessing ? <Loader2 className={`h-4 w-4 ${reduceMotion ? '' : 'animate-spin'}`} aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
          <span>{isProcessing ? 'Processing…' : `Continue with ${tier.name} · ₹${optimizationPackage.offerPrice}`}</span>
        </span>
      </motion.button>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020712]/90 p-2 font-sans backdrop-blur-lg sm:p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processingTier) onClose();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="optimization-quality-title"
            aria-describedby="optimization-quality-description"
            aria-busy={Boolean(processingTier)}
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 310, damping: 30, mass: 0.8 }}
            className="relative flex h-[calc(100dvh-1rem)] max-h-[940px] w-full max-w-[1360px] flex-col overflow-hidden rounded-[26px] border border-white/[0.11] bg-[linear-gradient(145deg,rgba(7,24,28,0.985),rgba(6,13,29,0.99))] shadow-[0_40px_120px_rgba(0,0,0,0.68),0_0_0_1px_rgba(52,211,153,0.025)] sm:h-[calc(100dvh-2rem)] sm:rounded-[30px]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_32%_0%,rgba(52,211,153,0.16),transparent_62%)]" />
            <div className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-blue-500/[0.07] blur-3xl" />

            <motion.button
              type="button"
              onClick={onClose}
              disabled={Boolean(processingTier)}
              aria-label="Close optimization quality selection"
              whileHover={reduceMotion ? undefined : { rotate: 90, scale: 1.06 }}
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
              className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-950/65 text-slate-400 shadow-lg backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-40 sm:right-4 sm:top-4 sm:h-11 sm:w-11"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </motion.button>

            <div className="relative shrink-0 border-b border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4 [@media(max-height:700px)]:py-2.5">
              <div className="flex items-center gap-3 pr-12 sm:gap-3.5 sm:pr-14">
                <motion.span
                  initial={reduceMotion ? false : { opacity: 0, rotate: -12, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  transition={{ delay: reduceMotion ? 0 : 0.1, type: 'spring', stiffness: 360, damping: 22 }}
                  className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-gradient-to-br from-emerald-300/15 to-cyan-300/5 text-emerald-300 shadow-[0_8px_30px_rgba(52,211,153,0.12)] sm:h-11 sm:w-11 [@media(max-height:620px)]:hidden"
                >
                  <span className="absolute inset-1 rounded-lg border border-white/[0.05]" />
                  <Cpu className="h-[18px] w-[18px]" aria-hidden="true" />
                </motion.span>
                <div className="min-w-0">
                  <h2 id="optimization-quality-title" className="font-['Poppins'] text-lg font-semibold leading-tight tracking-[-0.035em] text-white sm:text-xl">
                    Choose your optimization quality
                  </h2>
                  <p id="optimization-quality-description" className="mt-1 line-clamp-2 text-[11px] font-medium leading-4 text-slate-400 sm:text-xs [@media(max-height:650px)]:hidden">
                    Select a service below. Smart Optimize is recommended and selected by default.
                  </p>
                </div>
              </div>
              {error && (
                <div className="mt-2 line-clamp-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[11px] font-medium text-rose-200" role="alert">
                  {error}
                </div>
              )}
            </div>

            <div className="relative hidden min-h-0 flex-1 p-3 xl:block">
              <div
                className="grid h-full grid-cols-[minmax(225px,0.72fr)_repeat(3,minmax(0,1fr))] overflow-hidden rounded-2xl border border-white/[0.09] bg-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]"
                style={{ gridTemplateRows: `auto repeat(${comparisonRows.length}, minmax(0, 1fr)) auto` }}
              >
                <div className="border-b border-r border-white/[0.08] bg-white/[0.025] p-3" />
                {JD_OPTIMIZATION_TIERS.map((tier) => {
                  const palette = tierPalette[tier.id];
                  return (
                    <motion.button
                      key={tier.id}
                      type="button"
                      onClick={() => setSelectedTier(tier.id)}
                      disabled={Boolean(processingTier)}
                      aria-pressed={selectedTier === tier.id}
                      aria-label={`Select ${tier.name} for ₹${getSelectedPackage(tier).offerPrice}`}
                      whileHover={reduceMotion ? undefined : { y: -1 }}
                      className={`relative min-h-0 border-b border-r border-white/[0.08] px-4 py-3 text-left outline-none transition-colors last:border-r-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70 ${selectedTier === tier.id ? 'bg-emerald-400/[0.09]' : 'bg-white/[0.025] hover:bg-white/[0.045]'}`}
                    >
                      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${palette.tab}`} />
                      <motion.span
                        initial={false}
                        animate={selectedTier === tier.id && !reduceMotion ? { scale: [0.86, 1.08, 1] } : { scale: 1 }}
                        transition={{ duration: 0.24 }}
                        className={`absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                          selectedTier === tier.id
                            ? 'border-emerald-300 bg-emerald-300 text-slate-950 shadow-[0_0_22px_rgba(110,231,183,0.3)]'
                            : 'border-slate-500 bg-slate-950/50 text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </motion.span>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] ${palette.border} ${palette.soft} ${palette.accent}`}>
                        {tier.badge}
                      </span>
                      <h3 className="mt-1.5 font-['Poppins'] text-base font-semibold tracking-[-0.025em] text-white 2xl:text-lg">{tier.name}</h3>
                      <p className="mt-0.5 text-[9px] font-medium text-slate-500">Regular rate ₹{tier.regularRate}/{tier.unitLabel}</p>
                      <PriceBlock tier={tier} optimizationPackage={getSelectedPackage(tier)} />
                      <p className="mt-1 line-clamp-2 text-[10px] font-medium leading-3.5 text-slate-400 2xl:text-[11px] [@media(max-height:700px)]:hidden">{tier.description}</p>
                      <span className={`mt-2 inline-flex h-7 w-full items-center justify-center rounded-lg border text-[10px] font-bold uppercase tracking-[0.08em] transition-colors ${
                        selectedTier === tier.id
                          ? 'border-emerald-300/40 bg-emerald-300/15 text-emerald-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-300'
                      }`}>
                        {selectedTier === tier.id ? (
                          <><Check className="mr-1.5 h-3.5 w-3.5" strokeWidth={2.75} /> Selected</>
                        ) : (
                          `Select ${tier.name}`
                        )}
                      </span>
                    </motion.button>
                  );
                })}

                {comparisonRows.map((row) => (
                  <React.Fragment key={row.label}>
                    <div className="flex min-h-0 items-center overflow-hidden border-b border-r border-white/[0.08] bg-white/[0.018] px-4 py-0.5 text-[11px] font-medium leading-tight text-slate-400 2xl:text-xs">
                      {row.label}
                    </div>
                    {JD_OPTIMIZATION_TIERS.map((tier) => (
                      <div key={`${row.label}-${tier.id}`} className={`flex min-h-0 items-center overflow-hidden border-b border-r border-white/[0.08] px-4 py-0.5 text-[11px] font-semibold leading-tight text-slate-200 last:border-r-0 2xl:text-xs ${selectedTier === tier.id ? 'bg-emerald-400/[0.035]' : ''}`}>
                        {row.value(tier)}
                      </div>
                    ))}
                  </React.Fragment>
                ))}

                <div className="flex items-center border-r border-white/[0.08] bg-white/[0.018] px-4 py-2 text-[11px] font-semibold text-slate-400 2xl:text-xs">Selected service</div>
                <div className="col-span-3 bg-emerald-400/[0.035] p-2">
                  {renderAction(activeTier)}
                </div>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col gap-2.5 p-2.5 xl:hidden sm:gap-3 sm:p-4 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:p-2">
              <div role="tablist" aria-label="Optimization quality" className="grid shrink-0 grid-cols-3 gap-1 rounded-2xl border border-white/[0.09] bg-black/20 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] [@media(max-height:700px)]:p-1">
                {JD_OPTIMIZATION_TIERS.map((tier) => {
                  const selected = selectedTier === tier.id;
                  const palette = tierPalette[tier.id];
                  return (
                    <motion.button
                      key={`tier-tab-${tier.id}`}
                      type="button"
                      role="tab"
                      id={`optimization-tier-tab-${tier.id}`}
                      aria-controls={`optimization-tier-panel-${tier.id}`}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setSelectedTier(tier.id)}
                      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                      className={`relative isolate min-h-12 min-w-0 overflow-hidden rounded-xl px-1.5 py-2 text-center transition-colors [@media(max-height:700px)]:min-h-11 [@media(max-height:700px)]:py-1.5 ${selected ? 'text-slate-950' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="active-optimization-tier"
                          className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-r ${palette.tab} shadow-[0_8px_24px_rgba(52,211,153,0.18)]`}
                          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 34 }}
                        />
                      )}
                      <span className="flex items-center justify-center gap-1 truncate font-['Poppins'] text-[10px] font-semibold tracking-[-0.02em] xs:text-[11px] sm:text-sm">
                        {selected && <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />}
                        <span className="truncate">{tier.name}</span>
                      </span>
                      <span className={`mt-0.5 block text-[10px] font-bold tabular-nums sm:text-xs ${selected ? 'text-slate-800' : 'text-slate-500'}`}>from ₹{tier.packages[0].offerPrice}</span>
                    </motion.button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={activeTier.id}
                  id={`optimization-tier-panel-${activeTier.id}`}
                  role="tabpanel"
                  aria-labelledby={`optimization-tier-tab-${activeTier.id}`}
                  initial={reduceMotion ? false : { opacity: 0, x: 12, scale: 0.995 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, scale: 0.995 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-white/[0.025] shadow-[0_18px_55px_rgba(0,0,0,0.22)] ${tierPalette[activeTier.id].border}`}
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${tierPalette[activeTier.id].glow}`} />
                  <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${tierPalette[activeTier.id].tab}`} />

                  <div className="relative flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5 sm:px-4 sm:py-3 [@media(max-height:700px)]:py-2">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] sm:text-[9px] ${tierPalette[activeTier.id].border} ${tierPalette[activeTier.id].soft} ${tierPalette[activeTier.id].accent}`}>
                        {activeTier.badge}
                      </span>
                      <h3 className="mt-1 truncate font-['Poppins'] text-base font-semibold leading-tight tracking-[-0.03em] text-white sm:text-lg">{activeTier.name}</h3>
                      <p className="mt-0.5 text-[9px] font-medium text-slate-500">Regular rate ₹{activeTier.regularRate}/{activeTier.unitLabel}</p>
                      <p className="mt-1 line-clamp-2 max-w-[42rem] text-[9px] font-medium leading-3.5 text-slate-400 xs:text-[10px] sm:text-[11px] [@media(max-height:700px)]:hidden">{activeTier.description}</p>
                    </div>
                    <div>
                      <PriceBlock tier={activeTier} optimizationPackage={getSelectedPackage(activeTier)} compact />
                    </div>
                  </div>

                  <motion.div
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: reduceMotion ? 0 : 0.018 } },
                    }}
                    className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-px bg-white/[0.07] sm:grid-cols-4"
                  >
                    {featureRows.map((row) => (
                      <motion.div
                        key={`${activeTier.id}-compact-${row.label}`}
                        variants={{
                          hidden: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 5 },
                          show: { opacity: 1, y: 0 },
                        }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                        className="flex min-h-0 flex-col justify-center overflow-hidden bg-[#07141d]/95 px-2.5 py-1.5 sm:px-3 sm:py-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-0.5"
                      >
                        <span className="line-clamp-2 text-[9px] font-medium leading-[1.2] text-slate-500 sm:text-[10px]">{row.label}</span>
                        <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-[1.2] text-slate-100 xs:text-[10.5px] sm:text-xs [@media(max-height:700px)]:mt-0.5">{row.value(activeTier)}</span>
                      </motion.div>
                    ))}
                  </motion.div>

                  <div className="relative flex shrink-0 items-center gap-2.5 border-t border-white/[0.08] bg-white/[0.025] px-3 py-2 sm:px-4 sm:py-2.5 [@media(max-height:700px)]:py-1.5">
                    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tierPalette[activeTier.id].soft} ${tierPalette[activeTier.id].accent}`}>
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500 sm:text-[9px]">Best for</span>
                      <span className="block truncate text-[10px] font-semibold text-slate-200 sm:text-xs">{bestForRow.value(activeTier)}</span>
                    </div>
                  </div>

                  <div className="relative shrink-0 border-t border-white/[0.08] bg-slate-950/35 p-2 sm:p-2.5 [@media(max-height:700px)]:p-1.5">{renderAction(activeTier)}</div>
                </motion.section>
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OptimizationQualityModal;
