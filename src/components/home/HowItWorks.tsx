import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Upload, Cpu, CalendarCheck, Rocket } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: <Upload className="w-6 h-6" />,
    title: 'Upload & Paste',
    description: 'Upload your resume and paste the target job description.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    glow: 'rgba(6,182,212,0.35)',
    dotColor: 'bg-cyan-400',
  },
  {
    number: '02',
    icon: <Cpu className="w-6 h-6" />,
    title: 'AI Analyzes & Optimizes',
    description: 'Our AI scores your resume, identifies gaps, and optimizes every section.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'rgba(16,185,129,0.35)',
    dotColor: 'bg-emerald-400',
  },
  {
    number: '03',
    icon: <CalendarCheck className="w-6 h-6" />,
    title: 'Get Expert Guidance',
    description: 'Book a 1:1 session for personalized profile review and career strategy.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'rgba(245,158,11,0.35)',
    dotColor: 'bg-amber-400',
  },
  {
    number: '04',
    icon: <Rocket className="w-6 h-6" />,
    title: 'Apply & Get Hired',
    description: 'Use referrals and curated job updates to land interviews at top companies.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'rgba(244,63,94,0.35)',
    dotColor: 'bg-rose-400',
  },
];

export const HowItWorks: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.35 });

  return (
    <section ref={sectionRef} className="relative py-16 sm:py-24 overflow-hidden">
      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="text-center mb-12 sm:mb-16 space-y-3"
        >
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500 font-medium">
            Simple Process
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
            How It Works
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            From resume upload to job offer -- four steps to transform your career
          </p>
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          {/* Animated connector line */}
          <motion.div
            className="hidden lg:block absolute top-[3.75rem] left-[14%] right-[14%] h-[2px]"
            style={{
              background:
                'linear-gradient(to right, rgba(6,182,212,0.5), rgba(16,185,129,0.5), rgba(245,158,11,0.5), rgba(244,63,94,0.5))',
              transformOrigin: 'left center',
            }}
            initial={{ scaleX: 0 }}
            animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 1.4, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 36 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  duration: 0.55,
                  delay: i * 0.15 + 0.2,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
                className="relative group"
              >
                <motion.div
                  className={`relative rounded-2xl p-6 bg-[#0D1B2A]/80 border ${step.border} backdrop-blur-sm transition-all duration-300`}
                  whileHover={{
                    y: -6,
                    boxShadow: `0 20px 40px -8px ${step.glow}`,
                    borderColor: step.glow.replace('0.35', '0.6'),
                  }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                >
                  {/* Step dot on connector line (desktop) */}
                  <motion.div
                    className={`hidden lg:block absolute -top-[calc(3.75rem_-_1.5rem_+_1px)] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full ${step.dotColor} ring-2 ring-[#02221E]`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={isInView ? { scale: 1, opacity: 1 } : {}}
                    transition={{ delay: i * 0.15 + 0.9, type: 'spring', stiffness: 400 }}
                  />

                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      className={`w-12 h-12 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center ${step.color} transition-transform`}
                      whileHover={{ scale: 1.12, rotate: 6 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {step.icon}
                    </motion.div>
                    <span className={`text-3xl font-black ${step.color} opacity-20 select-none`}>
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                </motion.div>

                {i < steps.length - 1 && (
                  <motion.div
                    className="lg:hidden flex justify-center my-3"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={isInView ? { scaleY: 1, opacity: 1 } : {}}
                    transition={{ delay: i * 0.15 + 0.6, duration: 0.4 }}
                  >
                    <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
