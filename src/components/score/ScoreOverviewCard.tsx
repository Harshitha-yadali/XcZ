import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, CheckCircle, AlertTriangle, Target } from 'lucide-react';
import type { PremiumScoreResult } from '../../services/premiumScoreEngine';

interface ScoreOverviewCardProps {
  result: PremiumScoreResult;
}

export const ScoreOverviewCard: React.FC<ScoreOverviewCardProps> = ({ result }) => {
  const score = result.overallScore;
  const isGood = score >= 80;
  const isMedium = score >= 60 && score < 80;
  const accentColor = isGood ? '#10b981' : isMedium ? '#f59e0b' : '#ef4444';
  const accentBg = isGood ? 'rgba(16,185,129,0.08)' : isMedium ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)';
  const accentBorder = isGood ? 'rgba(16,185,129,0.2)' : isMedium ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';
  const label = isGood ? 'Excellent Match' : isMedium ? 'Good Match' : 'Needs Work';

  const criticalFlags = result.redFlags.filter(f => f.severity === 'critical');
  const strengths = result.categories.filter(c => c.status === 'excellent' || c.status === 'good').slice(0, 3);
  const circumference = 2 * Math.PI * 46;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#0f172a', borderColor: '#1e293b' }}
    >
      <div className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          <div className="flex flex-col items-center gap-4 lg:w-48 shrink-0">
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#1e293b" strokeWidth="7" />
                <motion.circle
                  cx="50" cy="50" r="46"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray: `${(score / 100) * circumference} ${circumference}` }}
                  transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
                  style={{ stroke: accentColor }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-4xl font-bold leading-none"
                  style={{ color: accentColor }}
                >
                  {score}
                </motion.span>
                <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
              </div>
            </div>

            <div
              className="px-4 py-1.5 rounded-full text-sm font-semibold border"
              style={{ background: accentBg, borderColor: accentBorder, color: accentColor }}
            >
              {label}
            </div>

            <div className="text-center">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Resume Type</div>
              <div className="text-sm font-semibold text-slate-300 capitalize">{result.userType}</div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="rounded-xl p-4 border"
              style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'rgba(16,185,129,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Shortlist Chance</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">{result.shortlistChance}</div>
              <div className="text-xs text-slate-500 mt-1">Based on current score</div>
            </div>

            <div
              className="rounded-xl p-4 border"
              style={{ background: 'rgba(6,182,212,0.05)', borderColor: 'rgba(6,182,212,0.15)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Quick Win Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-cyan-400">{result.projectedScore}</span>
                <span className="text-xs text-slate-500">after fixes</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.projectedScore}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  className="h-1.5 rounded-full"
                  style={{ background: 'linear-gradient(to right, #06b6d4, #10b981)' }}
                />
              </div>
            </div>

            <div
              className="rounded-xl p-4 border sm:col-span-1"
              style={{ background: 'rgba(30,41,59,0.6)', borderColor: '#1e293b' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Strengths</span>
              </div>
              {strengths.length > 0 ? (
                <div className="space-y-1.5">
                  {strengths.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 truncate">{c.name}</span>
                      <span className="text-emerald-400 font-semibold ml-2 shrink-0">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Complete more sections to see strengths</p>
              )}
            </div>

            <div
              className="rounded-xl p-4 border sm:col-span-1"
              style={{
                background: criticalFlags.length > 0 ? 'rgba(239,68,68,0.05)' : 'rgba(30,41,59,0.6)',
                borderColor: criticalFlags.length > 0 ? 'rgba(239,68,68,0.2)' : '#1e293b'
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                {criticalFlags.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                ) : (
                  <Target className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {criticalFlags.length > 0 ? 'Critical Issues' : 'Status'}
                </span>
              </div>
              {criticalFlags.length > 0 ? (
                <div className="space-y-1">
                  {criticalFlags.slice(0, 3).map(f => (
                    <p key={f.id} className="text-red-300 text-sm">{f.title}</p>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm">No critical issues detected</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
