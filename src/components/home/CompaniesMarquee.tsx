import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GradientOrb: React.FC<{ className?: string; delay?: number }> = ({ className, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    animate={{ scale: [1, 1.1, 1], opacity: [0.08, 0.15, 0.08] }}
    transition={{ duration: 10, repeat: Infinity, delay, ease: 'easeInOut' }}
  />
);

const companies = [
  'Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix', 'Apple', 'NVIDIA', 'OpenAI', 'Uber', 'Airbnb',
  'Stripe', 'Coinbase', 'Salesforce', 'Adobe', 'Oracle', 'IBM', 'Intel', 'Samsung', 'Dell', 'HP',
  'Accenture', 'Infosys', 'TCS', 'Wipro', 'Capgemini', 'Zoho', 'Flipkart', 'Paytm', 'Swiggy', 'Zomato',
];

export const CompaniesMarquee: React.FC = () => {
  const navigate = useNavigate();

  const chip = (name: string, i: number) => (
    <span
      key={name + i}
      className="mx-1.5 sm:mx-2 my-1.5 sm:my-2 inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 text-slate-200 shadow-sm border border-white/10 backdrop-blur hover:bg-white/10 transition-colors"
    >
      <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
      <span className="text-xs sm:text-sm font-medium">{name}</span>
    </span>
  );

  return (
    <section className="relative isolate overflow-hidden py-12 sm:py-16 bg-slate-950 border-y border-slate-800/40">
      <GradientOrb className="w-64 h-64 -top-24 -left-24 bg-cyan-400/20" delay={1} />
      <GradientOrb className="w-72 h-72 -bottom-24 -right-24 bg-teal-400/20" delay={3} />

      <style>{`
        @keyframes marqueeX { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .marquee-track { animation: marqueeX 28s linear infinite; }
        .marquee-track.fast { animation-duration: 22s; }
        .marquee:hover .marquee-track { animation-play-state: paused; }
      `}</style>

      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 sm:mb-8"
        >
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold text-white">
            Top Companies Our Users Apply To
          </h4>
          <p className="text-xs sm:text-sm text-slate-400">
            Trusted by candidates interviewing at leading global brands
          </p>
        </motion.div>

        <div className="space-y-3 sm:space-y-4">
          <div className="marquee overflow-hidden">
            <div className="marquee-track whitespace-nowrap flex items-center">
              {[...companies, ...companies].map((c, i) => chip(c, i))}
            </div>
          </div>
          <div className="marquee overflow-hidden">
            <div className="marquee-track fast whitespace-nowrap flex items-center">
              {[...companies.slice(10), ...companies.slice(10)].map((c, i) => chip(c, i))}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mt-8 sm:mt-10"
        >
          <div className="max-w-4xl mx-auto rounded-2xl p-4 sm:p-6 bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="text-center sm:text-left">
              <h5 className="text-sm sm:text-base lg:text-lg font-semibold text-white">
                Latest Job Updates
              </h5>
              <p className="text-xs sm:text-sm text-slate-400">
                Fresh openings at top companies, curated and updated daily.
              </p>
            </div>
            <motion.button
              onClick={() => navigate('/jobs')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-lg hover:shadow-xl hover:shadow-emerald-500/30 transition-all text-sm sm:text-base whitespace-nowrap"
            >
              <Briefcase className="w-4 h-4 mr-2" />
              Browse All Jobs
              <ArrowRight className="w-4 h-4 ml-2" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
