import React, { useEffect, useRef } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { TrendingUp, FileText, Star, Calendar } from 'lucide-react';
import { Card } from '../common/Card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const CountUp: React.FC<{
  to: number;
  format: (v: number) => string;
  isInView: boolean;
}> = ({ to, format, isInView }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isInView || !spanRef.current) return;
    const controls = animate(0, to, {
      duration: 2,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate(v) {
        if (spanRef.current) spanRef.current.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [isInView, to, format]);

  return <span ref={spanRef}>{format(0)}</span>;
};

interface StatsSectionProps {
  statsRef: React.RefObject<HTMLDivElement>;
  scoreChecksCompleted: number;
  globalResumesCreated: number;
}

export const StatsSection: React.FC<StatsSectionProps> = ({
  statsRef,
  scoreChecksCompleted,
  globalResumesCreated,
}) => {
  const isStatsInView = useInView(statsRef, { once: true, amount: 0.3 });

  const stats = [
    {
      rawValue: scoreChecksCompleted,
      format: (v: number) => Math.round(v).toLocaleString(),
      label: 'Resume Score Checks',
      icon: <TrendingUp className="w-5 h-5" />,
      microcopy: 'Completed by members to optimize their resumes',
      accentBg: 'from-emerald-500/8 to-cyan-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-emerald-400',
    },
    {
      rawValue: globalResumesCreated,
      format: (v: number) => Math.round(v).toLocaleString(),
      label: 'Resumes Created',
      icon: <FileText className="w-5 h-5" />,
      microcopy: 'Trusted by thousands of job seekers worldwide',
      accentBg: 'from-sky-500/8 to-cyan-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-sky-400',
    },
    {
      rawValue: 95,
      format: (v: number) => `${Math.round(v)}%`,
      label: 'Success Rate',
      icon: <TrendingUp className="w-5 h-5" />,
      microcopy: 'Achieved by our AI-driven approach',
      accentBg: 'from-emerald-500/8 to-lime-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-emerald-400',
    },
    {
      rawValue: 200,
      format: (v: number) => `${Math.round(v)}+`,
      label: 'Sessions Completed',
      icon: <Calendar className="w-5 h-5" />,
      microcopy: '1:1 expert sessions with career guidance',
      accentBg: 'from-teal-500/8 to-emerald-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-teal-400',
    },
    {
      rawValue: 4.9,
      format: (v: number) => `${v.toFixed(1)}/5`,
      label: 'User Rating',
      icon: <Star className="w-5 h-5" />,
      microcopy: 'From satisfied professionals worldwide',
      accentBg: 'from-amber-500/8 to-orange-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-amber-400',
    },
  ];

  return (
    <section ref={statsRef} className="relative py-12 sm:py-16">
      <div className="container-responsive">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isStatsInView ? 'visible' : 'hidden'}
          className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 max-w-7xl mx-auto"
        >
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <Card
                padding="lg"
                className="card-surface text-left flex flex-col sm:flex-row items-start gap-3 sm:gap-4 bg-[#0D1B2A]/80 border border-[#1f2a3c] shadow-lg hover:bg-[#0D1B2A] hover:border-[#2a3a4f] transition-all duration-300 group h-full backdrop-blur-sm"
              >
                <motion.div
                  className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-b ${stat.accentBg} ${stat.accentRing} border flex-shrink-0`}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {React.cloneElement(stat.icon, {
                    className: `w-4 h-4 sm:w-5 sm:h-5 ${stat.accentText}`,
                  })}
                </motion.div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-white leading-tight tabular-nums">
                    <CountUp to={stat.rawValue} format={stat.format} isInView={isStatsInView} />
                  </div>
                  <div className="text-xs sm:text-sm font-medium text-[#C4CFDE] leading-snug">
                    {stat.label}
                  </div>
                  <p className="text-[10px] sm:text-xs text-[#C4CFDE] leading-relaxed hidden sm:block">
                    {stat.microcopy}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
