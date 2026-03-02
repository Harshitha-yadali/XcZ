import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, ArrowLeft, FileText, Info, Wand2, AlertCircle, User, Phone, Linkedin, Github } from 'lucide-react';
import type { PremiumScoreResult } from '../../services/premiumScoreEngine';
import { ScoreOverviewCard } from './ScoreOverviewCard';
import { CategoryBreakdown } from './CategoryBreakdown';
import { SkillBucketsPanel } from './SkillBucketsPanel';
import { QuickWinsPanel } from './QuickWinsPanel';
import { ProjectScoresPanel } from './ProjectScoresPanel';
import { WeightDonutChart } from './WeightDonutChart';

interface PremiumResultsDashboardProps {
  result: PremiumScoreResult;
  onCheckAnother: () => void;
  onNavigateBack: () => void;
  onOptimizeResume?: () => void;
}

export const PremiumResultsDashboard: React.FC<PremiumResultsDashboardProps> = ({
  result,
  onCheckAnother,
  onNavigateBack,
  onOptimizeResume,
}) => {
  const showProjects = result.userType !== 'experienced' || result.projectScores.length > 0;

  const missingContactFields = useMemo(() => {
    const fields: { label: string; icon: React.ReactNode; required: boolean }[] = [];
    const contactFlag = result.redFlags.find(f => f.id === 'missing_contact');
    if (contactFlag) {
      const desc = contactFlag.description.toLowerCase();
      if (desc.includes('email')) {
        fields.push({ label: 'Email address', icon: <User className="w-4 h-4" />, required: true });
      }
      if (desc.includes('phone')) {
        fields.push({ label: 'Phone number', icon: <Phone className="w-4 h-4" />, required: true });
      }
    }
    if (!result.onlinePresence.linkedin) {
      fields.push({ label: 'LinkedIn URL', icon: <Linkedin className="w-4 h-4" />, required: true });
    }
    if (!result.onlinePresence.github) {
      fields.push({ label: 'GitHub URL', icon: <Github className="w-4 h-4" />, required: true });
    }
    if (!result.onlinePresence.portfolio) {
      fields.push({ label: 'Portfolio website', icon: <FileText className="w-4 h-4" />, required: false });
    }
    return fields;
  }, [result]);

  return (
    <div className="max-w-5xl mx-auto space-y-4 pb-10">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-center justify-between pb-1"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-medium text-slate-400">
            JD Match Analysis &mdash;{' '}
            <span className="text-slate-300 capitalize">{result.userType} profile</span>
          </span>
        </div>
        <button
          onClick={onNavigateBack}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </motion.div>

      {missingContactFields.filter(f => f.required).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-xl border p-4"
          style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)' }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-amber-300">Missing Contact Information</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Your resume is missing the following details. Add them to your resume's header/contact section to improve your score.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {missingContactFields.map((field, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
                      field.required
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                        : 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                    }`}
                  >
                    {field.icon}
                    {field.label}
                    {field.required && <span className="text-[10px] opacity-60">(required)</span>}
                    {!field.required && <span className="text-[10px] opacity-60">(optional)</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div
        className="flex items-start gap-2.5 p-3 rounded-xl border text-sm"
        style={{ background: 'rgba(6,182,212,0.04)', borderColor: 'rgba(6,182,212,0.15)' }}
      >
        <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <p className="text-slate-400 leading-relaxed text-xs">
          This score uses the <span className="text-slate-200 font-medium">same 20-parameter scoring engine</span> as the JD Optimizer.
          Your &ldquo;Before&rdquo; score in the JD Optimizer will match this score.
          Use the Score Checker to understand gaps, and the JD Optimizer to fix them.
        </p>
      </div>

      <ScoreOverviewCard result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CategoryBreakdown categories={result.categories} />
        </div>
        <div className="space-y-4">
          <WeightDonutChart categories={result.categories} />
          <QuickWinsPanel
            quickWins={result.quickWins}
            redFlags={result.redFlags}
            projectedScore={result.projectedScore}
            currentScore={result.overallScore}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkillBucketsPanel buckets={result.skillBuckets} />
        {showProjects && <ProjectScoresPanel projects={result.projectScores} />}
      </div>

      {onOptimizeResume && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-2xl border p-6"
          style={{ background: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.2)' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-lg font-semibold text-slate-100">Ready to fix these gaps automatically?</h3>
              <p className="text-sm text-slate-400 mt-1">
                Our AI optimizer will rewrite your resume to address missing keywords, weak sections, and red flags based on this analysis.
              </p>
            </div>
            <button
              onClick={onOptimizeResume}
              className="shrink-0 px-8 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-all duration-200 hover:scale-105 shadow-lg"
              style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 8px 30px rgba(16,185,129,0.3)' }}
            >
              <Wand2 className="w-5 h-5" />
              Optimize My Resume
            </button>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2"
      >
        <button
          onClick={onCheckAnother}
          className="w-full sm:w-auto px-7 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90"
          style={{ background: 'linear-gradient(to right, #10b981, #06b6d4)' }}
        >
          <RotateCcw className="w-4 h-4" />
          Check Another Resume
        </button>
      </motion.div>
    </div>
  );
};
