import React from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowUpRight, AlertTriangle } from 'lucide-react';
import type { QuickWin, RedFlagItem } from '../../services/premiumScoreEngine';

interface QuickWinsPanelProps {
  quickWins: QuickWin[];
  redFlags: RedFlagItem[];
  projectedScore: number;
  currentScore: number;
}

const effortLabels: Record<string, { text: string; color: string }> = {
  easy: { text: '2 min fix', color: 'text-emerald-400' },
  medium: { text: '10 min fix', color: 'text-amber-400' },
  hard: { text: '30 min fix', color: 'text-red-400' },
};

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export const QuickWinsPanel: React.FC<QuickWinsPanelProps> = ({
  quickWins,
  redFlags,
  projectedScore,
  currentScore,
}) => {
  const sortedFlags = [...redFlags].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="space-y-4">
      {sortedFlags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-red-500/30 overflow-hidden"
        >
          <div className="p-5 border-b border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-red-300">Red Flags ({sortedFlags.length})</h3>
            </div>
            <p className="text-sm text-red-300/60 mt-1">Issues that may cause auto-rejection</p>
          </div>
          <div className="p-4 space-y-2">
            {sortedFlags.map((flag, i) => (
              <motion.div
                key={flag.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.05 }}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  flag.severity === 'critical' ? 'bg-red-500/10 border-red-500/25' :
                  flag.severity === 'high' ? 'bg-orange-500/10 border-orange-500/25' :
                  'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mt-0.5 flex-shrink-0 ${
                  flag.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                  flag.severity === 'high' ? 'bg-orange-500/20 text-orange-300' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {flag.severity}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{flag.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{flag.description}</p>
                  <p className="text-xs text-cyan-400/80 mt-1">Fix: {flag.fix}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-cyan-500/30 overflow-hidden"
      >
        <div className="p-5 border-b border-cyan-500/20 bg-cyan-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-cyan-300">Quick Wins</h3>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">{currentScore}</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-bold">{projectedScore}</span>
            </div>
          </div>
          <p className="text-sm text-cyan-300/60 mt-1">Easiest fixes to boost your score</p>
        </div>
        <div className="p-4 space-y-2">
          {quickWins.length > 0 ? quickWins.map((win, i) => (
            <motion.div
              key={win.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-cyan-500/30 transition-colors"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex-shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{win.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs ${effortLabels[win.effort]?.color || 'text-slate-400'}`}>
                    {effortLabels[win.effort]?.text || win.effort}
                  </span>
                  <span className="text-xs text-emerald-400">+{win.impact} pts potential</span>
                </div>
              </div>
            </motion.div>
          )) : (
            <p className="text-slate-400 text-sm text-center py-4">Great job! Your resume is in good shape.</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
