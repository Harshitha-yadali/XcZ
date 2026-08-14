import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  ShieldCheck,
  Sparkles,
  Target,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { INDEPENDENCE_OFFER, isIndependenceWindow } from "../config/independenceOffer";
import { IndiaFlag } from "./ui/IndependenceTheme";

interface OfferOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
  targetPath?: string;
  ctaLabel?: string;
}

const benefits = [
  "Role-specific keyword alignment",
  "Evidence-safe bullet rewrites",
  "Editable ATS-friendly resume",
  "Clear gaps before you apply"
];

const matchedSkills = ["Python", "Flask", "REST API", "MySQL"];

export const OfferOverlay: React.FC<OfferOverlayProps> = ({
  isOpen,
  onClose,
  onAction,
  targetPath = "/optimizer",
  ctaLabel = "Open JD Optimizer"
}) => {
  const navigate = useNavigate();
  const { isChristmasMode } = useTheme();
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const isIndependence = isIndependenceWindow();

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleActionClick = () => {
    if (onAction) {
      onAction();
    } else {
      navigate(targetPath);
    }
    onClose();
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(INDEPENDENCE_OFFER.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / denied) - the code is on screen to type.
    }
  };

  const theme = isIndependence
    ? {
        text: "text-orange-400",
        textSoft: "text-orange-300",
        iconBg: "bg-orange-400/10",
        panel: "border-green-400/15 bg-green-400/5",
        border: "border-orange-400/30",
        topGradient: "from-orange-500/15",
        badge: "border-orange-400/25 bg-orange-400/10 text-orange-200",
        cta: "from-orange-400 via-amber-300 to-green-400 shadow-orange-500/20",
        bottomBar: "from-[#FF9933] via-white to-[#138808]"
      }
    : isChristmasMode
    ? {
        text: "text-green-400",
        textSoft: "text-green-300",
        iconBg: "bg-green-400/10",
        panel: "border-green-400/15 bg-green-400/5",
        border: "border-green-400/30",
        topGradient: "from-green-500/15",
        badge: "border-green-400/25 bg-green-400/10 text-green-300",
        cta: "from-green-400 to-emerald-300 shadow-green-500/15",
        bottomBar: "from-green-400 via-emerald-300 to-green-500"
      }
    : {
        text: "text-emerald-400",
        textSoft: "text-emerald-300",
        iconBg: "bg-emerald-400/10",
        panel: "border-emerald-400/15 bg-emerald-400/5",
        border: "border-emerald-400/30",
        topGradient: "from-emerald-500/15",
        badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        cta: "from-emerald-400 to-cyan-400 shadow-emerald-500/15",
        bottomBar: "from-emerald-400 via-cyan-400 to-teal-400"
      };

  return (
    <AnimatePresence>
      {isOpen && ready && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close JD Optimizer offer"
            className="fixed inset-0 cursor-default bg-slate-950/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="jd-offer-title"
            aria-describedby="jd-offer-description"
            className={`relative my-auto w-full max-w-5xl overflow-hidden rounded-3xl border bg-surface-deep shadow-[0_30px_100px_rgba(0,0,0,0.65)] ${theme.border}`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b ${theme.topGradient} to-transparent`}
            />
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

            <button
              type="button"
              onClick={onClose}
              aria-label="Close offer"
              className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/80 text-slate-300 transition hover:border-white/20 hover:bg-slate-800 hover:text-white sm:right-6 sm:top-6"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative grid max-h-[90vh] overflow-y-auto lg:grid-cols-[1.05fr_0.95fr]">
              <div className="flex flex-col justify-center px-5 py-8 sm:px-9 sm:py-10 lg:px-12 lg:py-14">
                <div
                  className={`mb-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] ${theme.badge}`}
                >
                  {isIndependence ? (
                    <>
                      <IndiaFlag width={20} />
                      Independence Day Special
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      PrimoBoost · JD Optimizer
                    </>
                  )}
                </div>

                <p className="mb-3 text-sm font-semibold text-cyan-300">
                  Built for the job you want
                </p>
                <h2
                  id="jd-offer-title"
                  className="max-w-xl text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[2.75rem]"
                >
                  Turn one resume into the right resume for the role.
                </h2>
                <p
                  id="jd-offer-description"
                  className="mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7"
                >
                  Compare your resume with the job description, identify meaningful gaps,
                  and create an editable, role-focused version before you apply.
                </p>

                {isIndependence && (
                  <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-orange-400/25 bg-gradient-to-r from-orange-500/10 via-white/5 to-green-500/10 px-4 py-3">
                    <span className="text-2xl font-extrabold text-white sm:text-3xl">
                      {INDEPENDENCE_OFFER.discountPercentage}% OFF
                    </span>
                    <span className="text-sm text-slate-300">on all plans, till 15 Aug</span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-bold tracking-wider text-white transition hover:bg-white/20"
                      aria-label={`Copy coupon code ${INDEPENDENCE_OFFER.code}`}
                    >
                      {INDEPENDENCE_OFFER.code}
                      {copied ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4 opacity-70" />
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {benefits.map((benefit) => (
                    <div key={benefit} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${theme.text}`} />
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleActionClick}
                    className={`group flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-6 font-semibold text-slate-950 shadow-lg transition ${theme.cta}`}
                  >
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-11 px-4 text-sm font-medium text-slate-400 transition hover:text-white"
                  >
                    Maybe later
                  </button>
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className={`h-4 w-4 ${theme.text}`} />
                  Review every change before export. No hiring guarantees.
                </div>
              </div>

              <div className="relative border-t border-white/10 bg-slate-950/45 p-5 sm:p-9 lg:border-l lg:border-t-0 lg:p-10">
                <div className="flex h-full min-h-[390px] items-center justify-center">
                  <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface-sunken p-4 shadow-2xl sm:p-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${theme.iconBg}`}>
                          <Target className={`h-5 w-5 ${theme.text}`} />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                            JD alignment preview
                          </p>
                          <p className="mt-0.5 font-semibold text-white">Graduate Software Engineer</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
                        Preview
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-rose-400/10 bg-rose-400/5 p-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-rose-300">Before</p>
                        <p className="mt-2 text-xs leading-5 text-slate-400">Generic summary and unsupported role keywords</p>
                      </div>
                      <div className={`rounded-xl border p-3 ${theme.panel}`}>
                        <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.textSoft}`}>Optimized</p>
                        <p className="mt-2 text-xs leading-5 text-slate-300">Role-aligned content backed by resume evidence</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/70 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <FileText className="h-4 w-4 text-cyan-300" />
                        Skills found in your projects
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {matchedSkills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {["Mandatory skill gaps separated", "Project bullets strengthened", "ATS-safe structure retained"].map(
                        (item) => (
                          <div key={item} className="flex items-center gap-2.5 rounded-lg bg-white/[0.025] px-3 py-2.5 text-xs text-slate-300">
                            <CheckCircle2 className={`h-4 w-4 shrink-0 ${theme.text}`} />
                            {item}
                          </div>
                        )
                      )}
                    </div>

                    <p className="mt-4 text-center text-[10px] uppercase tracking-[0.14em] text-slate-600">
                      Illustrative product preview
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${theme.bottomBar}`} />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
