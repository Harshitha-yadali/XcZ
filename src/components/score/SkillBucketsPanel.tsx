import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';
import type { SkillBucket } from '../../services/premiumScoreEngine';

interface SkillBucketsPanelProps {
  buckets: SkillBucket;
}

export const SkillBucketsPanel: React.FC<SkillBucketsPanelProps> = ({ buckets }) => {
  const totalJD = buckets.mustHave.length + buckets.missing.filter(s => s.importance === 'critical').length;
  const matchPct = totalJD > 0 ? Math.round((buckets.mustHave.length / totalJD) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden"
    >
      <div className="p-5 border-b border-slate-700/40">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Skill Match Analysis</h3>
            <p className="text-sm text-slate-400 mt-1">How your skills align with the job description</p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${matchPct >= 60 ? 'text-emerald-400' : matchPct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {matchPct}%
            </div>
            <div className="text-xs text-slate-500">match rate</div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {buckets.mustHave.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">Must-Have Skills (Matched)</span>
              <span className="ml-auto text-xs text-slate-500">{buckets.mustHave.length} found</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {buckets.mustHave.map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                >
                  {s.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {buckets.supporting.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MinusCircle className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-medium text-cyan-300">Supporting Skills (Related)</span>
              <span className="ml-auto text-xs text-slate-500">{buckets.supporting.length} found</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {buckets.supporting.map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                >
                  {s.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {buckets.missing.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-300">Missing from Resume</span>
              <span className="ml-auto text-xs text-slate-500">{buckets.missing.length} missing</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {buckets.missing.map((s, i) => (
                <span
                  key={i}
                  className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    s.importance === 'critical'
                      ? 'bg-red-500/15 text-red-300 border-red-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {s.skill}
                  {s.importance === 'critical' && (
                    <AlertTriangle className="w-3 h-3 inline ml-1" />
                  )}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Add these skills to your resume if you have experience with them
            </p>
          </div>
        )}

        {buckets.irrelevant.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MinusCircle className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-400">Not Mentioned in JD</span>
              <span className="ml-auto text-xs text-slate-500">{buckets.irrelevant.length} skills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {buckets.irrelevant.slice(0, 10).map((s, i) => (
                <span
                  key={i}
                  className="px-3 py-1 text-xs font-medium rounded-full bg-slate-800/50 text-slate-500 border border-slate-700/40"
                >
                  {s.skill}
                </span>
              ))}
              {buckets.irrelevant.length > 10 && (
                <span className="px-3 py-1 text-xs text-slate-500">
                  +{buckets.irrelevant.length - 10} more
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              These skills from your resume are not in this job description, but may be relevant for other roles
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
