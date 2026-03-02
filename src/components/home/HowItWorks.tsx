import React from 'react';
import { motion } from 'framer-motion';
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
    glow: 'shadow-cyan-500/10',
  },
  {
    number: '02',
    icon: <Cpu className="w-6 h-6" />,
    title: 'AI Analyzes & Optimizes',
    description: 'Our AI scores your resume, identifies gaps, and optimizes every section.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/10',
  },
  {
    number: '03',
    icon: <CalendarCheck className="w-6 h-6" />,
    title: 'Get Expert Guidance',
    description: 'Book a 1:1 session for personalized profile review and career strategy.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/10',
  },
  {
    number: '04',
    icon: <Rocket className="w-6 h-6" />,
    title: 'Apply & Get Hired',
    description: 'Use referrals and curated job updates to land interviews at top companies.',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'shadow-rose-500/10',
  },
];

export const HowItWorks: React.FC = () => {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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
          <div className="hidden lg:block absolute top-1/2 left-[12%] right-[12%] h-px bg-gradient-to-r from-cyan-500/30 via-emerald-500/30 via-amber-500/30 to-rose-500/30 -translate-y-1/2" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative group"
              >
                <div
                  className={`relative rounded-2xl p-6 bg-[#0D1B2A]/80 border ${step.border} backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:${step.glow} hover:-translate-y-1`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl ${step.bg} border ${step.border} flex items-center justify-center ${step.color} transition-transform group-hover:scale-110`}
                    >
                      {step.icon}
                    </div>
                    <span
                      className={`text-3xl font-black ${step.color} opacity-20 select-none`}
                    >
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{step.description}</p>
                </div>

                {i < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-3">
                    <div className="w-px h-8 bg-gradient-to-b from-slate-600 to-transparent" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
