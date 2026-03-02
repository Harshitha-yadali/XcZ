import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { CategoryScore } from '../../services/premiumScoreEngine';

interface CategoryBreakdownProps {
  categories: CategoryScore[];
}

const statusConfig: Record<string, { color: string; bg: string; border: string; barColor: string; label: string }> = {
  excellent: { color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', barColor: '#10b981', label: 'Excellent' },
  good:      { color: '#06b6d4', bg: 'rgba(6,182,212,0.06)',  border: 'rgba(6,182,212,0.2)',  barColor: '#06b6d4', label: 'Good' },
  needs_work:{ color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', barColor: '#f59e0b', label: 'Needs Work' },
  poor:      { color: '#ef4444', bg: 'rgba(239,68,68,0.06)',  border: 'rgba(239,68,68,0.2)',  barColor: '#ef4444', label: 'Poor' },
};

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ categories }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#0f172a', borderColor: '#1e293b' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
        <h3 className="text-base font-semibold text-slate-100">Score Breakdown</h3>
        <p className="text-xs text-slate-500 mt-0.5">Click a category to see what passed and what to fix</p>
      </div>

      <div className="p-4 space-y-2">
        {categories.map((cat, index) => {
          const cfg = statusConfig[cat.status] ?? statusConfig.poor;
          const isExpanded = expandedId === cat.id;

          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.28, delay: 0.2 + index * 0.04 }}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isExpanded ? cfg.border : '#1e293b'}` }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                className="w-full text-left p-4 transition-colors"
                style={{ background: isExpanded ? cfg.bg : 'rgba(30,41,59,0.4)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">{cat.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                        >
                          {cfg.label}
                        </span>
                        <span className="text-sm font-bold" style={{ color: cfg.color }}>{cat.percentage}%</span>
                        <span className="text-xs text-slate-600">{cat.weight}% wt</span>
                        <ChevronDown
                          className="w-3.5 h-3.5 text-slate-500 transition-transform"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                        />
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: '#1e293b' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(cat.percentage, 100)}%` }}
                        transition={{ duration: 0.8, delay: 0.3 + index * 0.04 }}
                        className="h-1.5 rounded-full"
                        style={{ background: cfg.barColor }}
                      />
                    </div>
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-2" style={{ background: '#0c1420' }}>
                      {cat.subChecks.map(check => (
                        <div
                          key={check.id}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{
                            background: check.passed ? 'rgba(16,185,129,0.04)' :
                              check.severity === 'critical' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                            border: `1px solid ${check.passed ? 'rgba(16,185,129,0.15)' :
                              check.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`
                          }}
                        >
                          {check.passed ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                          ) : check.severity === 'critical' ? (
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-200">{check.label}</span>
                              {!check.passed && check.severity === 'critical' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 font-semibold uppercase tracking-wide">Critical</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{check.detail}</p>
                            {check.fix && !check.passed && (
                              <p className="text-xs text-cyan-400 mt-1">
                                <span className="font-medium">Fix:</span> {check.fix}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}

                      {cat.suggestions.length > 0 && (
                        <div className="pt-2 border-t" style={{ borderColor: '#1e293b' }}>
                          <p className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">Suggestions</p>
                          {cat.suggestions.map((s, i) => (
                            <p key={i} className="text-sm text-slate-400 mb-1 pl-2 border-l-2 border-slate-700">{s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
