import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Award, Users } from 'lucide-react';

const GradientOrb: React.FC<{ className?: string; delay?: number }> = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.15, 0.08] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

const cards = [
  {
    icon: <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-300" />,
    title: 'AI-Powered Analysis',
    description: 'Advanced algorithms analyze and optimize your resume',
    titleClass: 'text-yellow-300',
    bg: 'bg-cyan-500/15',
  },
  {
    icon: <Award className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-300" />,
    title: 'ATS Optimization',
    description: 'Ensure your resume passes all screening systems',
    titleClass: 'text-emerald-300',
    bg: 'bg-emerald-500/15',
  },
  {
    icon: <Users className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-300" />,
    title: 'Expert Approved',
    description: 'Formats trusted by recruiters worldwide',
    titleClass: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
  },
];

export const AITechSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden text-white py-16 sm:py-20 lg:py-24 bg-gradient-to-br from-slate-900 via-slate-950 to-[#020617]">
      <GradientOrb className="w-64 h-64 -top-24 -left-24 bg-cyan-500/20" delay={0} />
      <GradientOrb className="w-72 h-72 -bottom-24 -right-24 bg-cyan-500/20" delay={2} />

      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center mb-10 sm:mb-12"
        >
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold mb-3 bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Powered by Advanced AI Technology
          </h3>
          <p className="text-sm sm:text-base lg:text-lg text-slate-300 px-4">
            Our intelligent system understands ATS requirements, job market trends, and recruiter
            preferences to give you the competitive edge.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={{ y: -6, scale: 1.02 }}
              className="text-center rounded-2xl sm:rounded-3xl p-5 sm:p-6 backdrop-blur-sm bg-white/5 border border-white/10 shadow-xl hover:shadow-2xl hover:border-white/20 transition-all duration-300"
            >
              <div className="relative mx-auto mb-4 sm:mb-5">
                <div
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto flex items-center justify-center ${card.bg}`}
                >
                  {card.icon}
                </div>
              </div>
              <h4 className={`font-semibold mb-2 text-base sm:text-lg ${card.titleClass}`}>
                {card.title}
              </h4>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {card.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
