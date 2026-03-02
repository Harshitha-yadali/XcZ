import React from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  ArrowRight,
  CheckCircle,
  Clock,
  MessageSquare,
  FileSearch,
  Compass,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SessionHighlightProps {
  isAuthenticated: boolean;
  onShowAuth: () => void;
}

const benefits = [
  { icon: <FileSearch className="w-4 h-4" />, text: 'Complete resume deep-dive & feedback' },
  { icon: <MessageSquare className="w-4 h-4" />, text: 'All your career doubts answered live' },
  { icon: <Compass className="w-4 h-4" />, text: 'Personalized career strategy planning' },
  { icon: <Users className="w-4 h-4" />, text: 'Referral & networking guidance' },
];

export const SessionHighlight: React.FC<SessionHighlightProps> = ({
  isAuthenticated,
  onShowAuth,
}) => {
  const navigate = useNavigate();

  const handleBookClick = () => {
    if (!isAuthenticated) {
      onShowAuth();
      return;
    }
    navigate('/session');
  };

  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/30 via-transparent to-teal-950/30" />

      <div className="container-responsive relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden bg-[#0D1B2A] border border-emerald-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(16,185,129,0.08),transparent_50%),radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.06),transparent_40%)]" />

            <div className="relative grid lg:grid-cols-2 gap-8 lg:gap-12 p-8 sm:p-10 lg:p-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-300">1-Hour Live Session</span>
                </div>

                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  Not Getting Shortlisted?{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                    Let's Fix That Together
                  </span>
                </h2>

                <p className="text-base text-slate-300 leading-relaxed">
                  Book a 1:1 session with our career experts. Whether it's your resume, interview
                  prep, career path, or application strategy -- get personalized, actionable guidance
                  in just one hour.
                </p>

                <motion.button
                  onClick={handleBookClick}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex items-center gap-3 h-14 px-8 rounded-full text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
                >
                  <Calendar className="w-5 h-5" />
                  <span>Book Your Session</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>

              <div className="space-y-4 lg:pt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-medium mb-4">
                  What You'll Get
                </p>
                {benefits.map((benefit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <span className="text-sm text-slate-200">{benefit.text}</span>
                    <CheckCircle className="w-4 h-4 text-emerald-400/60 ml-auto flex-shrink-0" />
                  </motion.div>
                ))}

                <div className="flex items-center gap-4 pt-3">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-[#0D1B2A] flex items-center justify-center text-xs text-slate-300 font-medium"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">200+ sessions completed</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
