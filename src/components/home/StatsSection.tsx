import React from 'react';
import { motion, useInView } from 'framer-motion';
import { TrendingUp, FileText, Star, Calendar } from 'lucide-react';
import { Card } from '../common/Card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
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
      number: scoreChecksCompleted.toLocaleString(),
      label: 'Resume Score Checks',
      icon: <TrendingUp className="w-5 h-5" />,
      microcopy: 'Completed by members to optimize their resumes',
      accentBg: 'from-emerald-500/8 to-cyan-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-emerald-400',
    },
    {
      number: globalResumesCreated.toLocaleString(),
      label: 'Resumes Created',
      icon: <FileText className="w-5 h-5" />,
      microcopy: 'Trusted by thousands of job seekers worldwide',
      accentBg: 'from-sky-500/8 to-cyan-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-sky-400',
    },
    {
      number: '95%',
      label: 'Success Rate',
      icon: <TrendingUp className="w-5 h-5" />,
      microcopy: 'Achieved by our AI-driven approach',
      accentBg: 'from-emerald-500/8 to-lime-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-emerald-400',
    },
    {
      number: '200+',
      label: 'Sessions Completed',
      icon: <Calendar className="w-5 h-5" />,
      microcopy: '1:1 expert sessions with career guidance',
      accentBg: 'from-teal-500/8 to-emerald-500/8',
      accentRing: 'border-slate-700/40',
      accentText: 'text-teal-400',
    },
    {
      number: '4.9/5',
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
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300 }}
            >
              <Card
                padding="lg"
                className="card-surface text-left flex flex-col sm:flex-row items-start gap-3 sm:gap-4 bg-[#0D1B2A]/80 border border-[#1f2a3c] shadow-lg hover:bg-[#0D1B2A] hover:border-[#2a3a4f] transition-all duration-300 group h-full backdrop-blur-sm"
              >
                <motion.div
                  className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl bg-gradient-to-b ${stat.accentBg} ${stat.accentRing} border flex-shrink-0`}
                  whileHover={{ scale: 1.05 }}
                >
                  {React.cloneElement(stat.icon, {
                    className: `w-4 h-4 sm:w-5 sm:h-5 ${stat.accentText}`,
                  })}
                </motion.div>
                <div className="space-y-0.5 sm:space-y-1 min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                    {stat.number}
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
