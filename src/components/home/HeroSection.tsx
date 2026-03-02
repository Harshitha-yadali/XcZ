import React from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  FileText,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Star,
  Users,
  Briefcase,
  MousePointer2,
  Calendar,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

const ScrollIndicator: React.FC = () => (
  <motion.div
    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 1.5, duration: 0.5 }}
  >
    <span className="text-xs text-slate-400 uppercase tracking-widest">Scroll to explore</span>
    <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
      <MousePointer2 className="w-5 h-5 text-emerald-400" />
    </motion.div>
  </motion.div>
);

interface HeroSectionProps {
  heroRef: React.RefObject<HTMLDivElement>;
  isHeroInView: boolean;
  globalResumesCreated: number;
  onShowAuth: () => void;
  isAuthenticated: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  heroRef,
  isHeroInView,
  globalResumesCreated,
  onShowAuth,
  isAuthenticated,
}) => {
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, -50]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.8]);

  return (
    <section ref={heroRef} className="relative min-h-[100vh] flex items-center overflow-hidden">
      <motion.div
        style={{ y: heroY, opacity: heroOpacity }}
        className="container-responsive pt-24 pb-20 lg:pt-32 lg:pb-28"
      >
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={isHeroInView ? 'visible' : 'hidden'}
            className="space-y-6 lg:space-y-8"
          >
            <motion.div variants={itemVariants}>
              <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-sm bg-[rgba(0,230,184,0.12)] border border-[rgba(0,230,184,0.4)] text-[#00E6B8]">
                <Sparkles className="w-4 h-4" />
                <span className="font-medium">Your Complete Career Acceleration Platform</span>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.15] text-white"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              <span>Optimize. Score.</span>
              <br />
              <span>Get Hired With</span>
              <span className="block mt-2 text-[#00E6B8]">AI-Powered Precision</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="text-base lg:text-lg leading-relaxed max-w-lg text-[#C4CFDE]"
            >
              From JD-based resume optimization and ATS scoring to 1:1 expert sessions,
              professional referrals, and curated job updates -- everything you need to
              land your dream role, in one platform.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 pt-2">
              <motion.button
                onClick={() => navigate('/optimizer')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group h-13 px-6 rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 bg-[#00D283] hover:brightness-110 text-white transition-all duration-200 shadow-[0_0_12px_rgba(0,230,184,0.4)]"
              >
                <Target className="w-4 h-4" />
                <span>Optimize My Resume</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                onClick={() => navigate('/score-checker')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group h-13 px-6 rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 border border-[#4F5D75] bg-[#111C2E] hover:brightness-110 text-white transition-all duration-200"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Check ATS Score</span>
              </motion.button>

              <motion.button
                onClick={() => {
                  if (!isAuthenticated) {
                    onShowAuth();
                    return;
                  }
                  navigate('/session');
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group h-13 px-6 rounded-full text-sm font-semibold flex items-center justify-center gap-2.5 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-all duration-200"
              >
                <Calendar className="w-4 h-4" />
                <span>Book 1:1 Session</span>
              </motion.button>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="flex flex-wrap items-center gap-6 pt-4 text-sm text-[#C4CFDE]"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-[#00E6B8]" />
                <span>{globalResumesCreated.toLocaleString()}+ resumes optimized</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[#FFC043] fill-[#FFC043]" />
                <span>4.9/5 rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#C4CFDE]" />
                <span>10K+ active users</span>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 50 }}
            animate={isHeroInView ? { opacity: 1, scale: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' as const }}
            className="relative lg:h-[550px] flex items-center justify-center"
          >
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl px-4 sm:px-0">
              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="relative bg-[#0D1B2A] border border-[#0D1B2A] rounded-3xl p-4 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Job Description</div>
                    <div className="text-xs text-[#C4CFDE]">Senior Frontend Engineer</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {['React', 'TypeScript', 'Tailwind CSS', 'REST APIs', 'Git'].map((keyword, i) => (
                    <motion.div
                      key={keyword}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="flex items-center justify-between px-3 py-2 bg-[#111C2E] border border-[#1F2A3C] rounded-lg"
                    >
                      <span className="text-xs font-medium text-[#C4CFDE]">{keyword}</span>
                      <CheckCircle className="w-4 h-4 text-[#00E6B8]" />
                    </motion.div>
                  ))}
                </div>
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -right-6 sm:-right-8 top-1/2 -translate-y-1/2 hidden md:block text-[#00E6B8]"
                >
                  <ArrowRight className="w-6 h-6" />
                </motion.div>
              </motion.div>

              <motion.div
                whileHover={{ y: -6, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="relative bg-[#0D1B2A] rounded-3xl p-4 sm:p-6 backdrop-blur-xl border border-[#0D1B2A] shadow-[0_20px_50px_rgba(0,0,0,0.28),_0_0_18px_rgba(0,255,153,0.2)]"
              >
                <div className="flex items-center gap-3 mb-4 relative">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#00E6B8]/15">
                    <FileText className="w-5 h-5 text-[#00E6B8]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Your Resume</div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-[#00E6B8]">Optimized</div>
                      <div className="w-2 h-2 rounded-full animate-pulse bg-[#00E6B8]" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 relative">
                  {['SKILLS', 'EXPERIENCE', 'PROJECTS', 'EDUCATION'].map((section, i) => (
                    <motion.div
                      key={section}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.15 }}
                      className="flex items-center justify-between px-3 py-2 bg-[#111C2E] border border-[#1F2A3C] rounded-lg"
                    >
                      <span className="text-xs font-medium text-[#C4CFDE]">{section}</span>
                      <CheckCircle className="w-4 h-4 text-[#00E6B8]" />
                    </motion.div>
                  ))}
                </div>
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 1.5, type: 'spring', stiffness: 200 }}
                  className="absolute -top-4 -right-4 rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center font-bold text-base sm:text-lg text-white bg-gradient-to-br from-[#00D283] to-[#00E6B8] shadow-lg"
                >
                  <motion.div
                    animate={{
                      boxShadow: [
                        '0 0 0 0 rgba(0,230,184,0.6)',
                        '0 0 0 15px rgba(0,230,184,0)',
                        '0 0 0 0 rgba(0,230,184,0)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    className="absolute inset-0 rounded-full"
                  />
                  <span className="relative z-10">95%</span>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </motion.div>
      <ScrollIndicator />
    </section>
  );
};
