import React from 'react';
import { motion } from 'framer-motion';
import { Code2, CheckCircle, XCircle } from 'lucide-react';
import type { ProjectScore } from '../../services/premiumScoreEngine';

interface ProjectScoresPanelProps {
  projects: ProjectScore[];
}

export const ProjectScoresPanel: React.FC<ProjectScoresPanelProps> = ({ projects }) => {
  if (projects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-amber-500/30 overflow-hidden"
      >
        <div className="p-5 border-b border-amber-500/20">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-semibold text-slate-100">Projects Analysis</h3>
          </div>
        </div>
        <div className="p-8 text-center">
          <p className="text-slate-400">No projects detected in your resume.</p>
          <p className="text-sm text-amber-400 mt-2">
            Adding 2-4 projects with measurable results can significantly boost your score.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden"
    >
      <div className="p-5 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <Code2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-slate-100">Projects Analysis</h3>
          <span className="ml-auto text-xs text-slate-500">{projects.length} project(s)</span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {projects.map((proj, i) => {
          const pct = Math.round((proj.score / proj.maxScore) * 100);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="bg-slate-800/40 rounded-xl border border-slate-700/40 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-200 truncate pr-4">{proj.title}</h4>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-lg font-bold ${
                    pct >= 70 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {proj.score}
                  </span>
                  <span className="text-xs text-slate-500">/{proj.maxScore}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
                {[
                  { key: 'realWorldProblem', label: 'Problem' },
                  { key: 'toolsMentioned', label: 'Tools' },
                  { key: 'measurableResults', label: 'Metrics' },
                  { key: 'businessImpact', label: 'Impact' },
                ].map(({ key, label }) => {
                  const passed = proj.checks[key as keyof typeof proj.checks];
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
                        passed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700/30 text-slate-500'
                      }`}
                    >
                      {passed ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {label}
                    </div>
                  );
                })}
              </div>

              {proj.suggestions.length > 0 && (
                <div className="space-y-1">
                  {proj.suggestions.map((s, j) => (
                    <p key={j} className="text-xs text-cyan-400/70">- {s}</p>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
