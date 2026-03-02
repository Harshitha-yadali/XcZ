import React from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  X,
  AlertCircle,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

export const BeforeAfterSection: React.FC = () => {
  return (
    <section className="relative py-16 sm:py-24 bg-gradient-to-b from-slate-950 to-[#0a0f1c]">
      <div className="container-responsive">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
            <Zap className="w-4 h-4" />
            <span>AI-Powered Section Reordering</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-white px-4">
            We Automatically Reorder Resume Sections
            <span className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
              Following ATS Best Practices
            </span>
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto px-4">
            Based on your experience level and the job description, our AI rearranges
            your resume sections to maximize ATS compatibility and recruiter impact.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 max-w-6xl mx-auto px-4 sm:px-0">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">Before Optimization</div>
                <div className="text-sm text-red-400">Wrong section order</div>
              </div>
            </div>

            {[
              { title: 'EDUCATION', subtitle: 'B.Tech Computer Science (Final Year)' },
              { title: 'PROJECTS', subtitle: '1 mini project listed' },
              { title: 'SKILLS', subtitle: 'Basic HTML, CSS, JavaScript' },
              { title: 'HOBBIES', subtitle: 'Movies, music, etc.' },
              { title: 'PERSONAL DETAILS', subtitle: 'Full address, date of birth at the top' },
            ].map((section, i) => (
              <motion.div
                key={`before-${i}`}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-3 sm:p-4 rounded-xl border backdrop-blur bg-red-500/5 border-red-500/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white text-sm sm:text-base">{section.title}</div>
                    <div className="text-xs sm:text-sm text-slate-400">{section.subtitle}</div>
                  </div>
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg sm:text-xl font-bold text-white">After Optimization</div>
                <div className="text-sm text-emerald-400">ATS-compliant order</div>
              </div>
            </div>

            {[
              { title: 'SKILLS', subtitle: 'React, TypeScript, Tailwind CSS...', highlight: true },
              { title: 'PROJECTS', subtitle: '3 academic & personal projects', highlight: true },
              { title: 'EDUCATION', subtitle: 'B.Tech Computer Science', highlight: false },
              { title: 'CERTIFICATIONS', subtitle: 'Frontend / coding certifications', highlight: false },
            ].map((section, i) => (
              <motion.div
                key={`after-${i}`}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                whileHover={{ scale: 1.02 }}
                className={`relative p-3 sm:p-4 rounded-xl border backdrop-blur overflow-hidden ${
                  section.highlight
                    ? 'bg-emerald-500/10 border-emerald-400/40 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800/50 border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <div className="font-semibold text-white text-sm sm:text-base">{section.title}</div>
                    <div className="text-xs sm:text-sm text-slate-400">{section.subtitle}</div>
                  </div>
                  <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
                </div>
                {section.highlight && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-emerald-400/10 to-emerald-400/0"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  />
                )}
              </motion.div>
            ))}

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl border bg-emerald-500/10 border-emerald-400/40"
            >
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
              <div>
                <div className="text-xs sm:text-sm font-medium text-emerald-300">ATS Score Increased</div>
                <div className="text-xl sm:text-2xl font-bold text-white">72% &rarr; 95%</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 sm:mt-16 p-6 sm:p-8 bg-slate-900/70 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl mx-auto"
        >
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Keyword Matching & Highlighting
            </h3>
            <p className="text-sm sm:text-base text-slate-300">
              We identify missing keywords and highlight where to add them
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3">
              <div className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Missing Keywords
              </div>
              {['Responsive Design', 'CI/CD', 'Agile'].map((keyword, i) => (
                <motion.div
                  key={keyword}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="px-3 sm:px-4 py-2 bg-amber-500/10 border border-amber-400/30 rounded-lg text-amber-300 font-medium text-sm sm:text-base"
                >
                  {keyword}
                </motion.div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="text-xs sm:text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Matched Keywords
              </div>
              {['React', 'TypeScript', 'REST APIs'].map((keyword, i) => (
                <motion.div
                  key={keyword}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  className="px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center gap-2 border text-sm sm:text-base bg-emerald-500/10 border-emerald-400/30 text-emerald-300"
                >
                  <CheckCircle className="w-4 h-4" />
                  {keyword}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
