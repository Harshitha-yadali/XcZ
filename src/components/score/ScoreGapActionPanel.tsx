import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Lightbulb,
  Plus,
  Shuffle,
  Target,
  XCircle,
} from 'lucide-react';
import type {
  CategoryScore,
  SkillBucket,
  RedFlagItem,
  QuickWin,
} from '../../services/premiumScoreEngine';

interface ScoreGapActionPanelProps {
  categories: CategoryScore[];
  skillBuckets: SkillBucket;
  redFlags: RedFlagItem[];
  quickWins: QuickWin[];
  overallScore: number;
  projectedScore: number;
}

interface GapItem {
  id: string;
  title: string;
  type: 'missing_skill' | 'weak_category' | 'red_flag' | 'quick_win';
  severity: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  alternative?: string;
  impact: number;
  category: string;
}

function buildGapItems(
  categories: CategoryScore[],
  skillBuckets: SkillBucket,
  redFlags: RedFlagItem[],
  quickWins: QuickWin[],
): GapItem[] {
  const items: GapItem[] = [];

  skillBuckets.missing.forEach((s, i) => {
    items.push({
      id: `missing-skill-${i}`,
      title: s.skill,
      type: 'missing_skill',
      severity: s.importance === 'critical' ? 'critical' : s.importance === 'important' ? 'high' : 'medium',
      action: `Add "${s.skill}" to your resume skills section if you have experience with it.`,
      alternative: `If you don't know ${s.skill}, mention a similar/related technology you do know.`,
      impact: s.importance === 'critical' ? 5 : s.importance === 'important' ? 3 : 1,
      category: 'Missing Skills',
    });
  });

  categories
    .filter(c => c.status === 'poor' || c.status === 'needs_work')
    .forEach(c => {
      const failedChecks = c.subChecks.filter(sc => !sc.passed);
      failedChecks.forEach(check => {
        items.push({
          id: `cat-${c.id}-${check.id}`,
          title: check.label,
          type: 'weak_category',
          severity: check.severity === 'critical' ? 'critical' : check.severity === 'important' ? 'high' : 'medium',
          action: check.fix || check.detail,
          alternative: undefined,
          impact: check.severity === 'critical' ? 4 : check.severity === 'important' ? 2 : 1,
          category: c.name,
        });
      });
    });

  redFlags.forEach(flag => {
    const alreadyExists = items.some(i => i.title === flag.title);
    if (!alreadyExists) {
      items.push({
        id: `rf-${flag.id}`,
        title: flag.title,
        type: 'red_flag',
        severity: flag.severity === 'critical' ? 'critical' : flag.severity === 'high' ? 'high' : 'medium',
        action: flag.fix,
        alternative: undefined,
        impact: flag.severity === 'critical' ? 6 : flag.severity === 'high' ? 4 : 2,
        category: flag.category,
      });
    }
  });

  quickWins.forEach(win => {
    const alreadyExists = items.some(i => i.title === win.title);
    if (!alreadyExists) {
      items.push({
        id: `qw-${win.id}`,
        title: win.title,
        type: 'quick_win',
        severity: win.effort === 'easy' ? 'low' : win.effort === 'medium' ? 'medium' : 'high',
        action: win.description,
        alternative: undefined,
        impact: win.impact,
        category: win.category,
      });
    }
  });

  items.sort((a, b) => b.impact - a.impact);
  return items;
}

const severityStyles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  critical: { bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', text: 'text-red-300', badge: 'bg-red-500/20 text-red-300' },
  high: { bg: 'rgba(249,115,22,0.06)', border: 'rgba(249,115,22,0.2)', text: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-300' },
  medium: { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-300' },
  low: { bg: 'rgba(6,182,212,0.06)', border: 'rgba(6,182,212,0.2)', text: 'text-cyan-300', badge: 'bg-cyan-500/20 text-cyan-300' },
};

const typeIcons: Record<string, React.ReactNode> = {
  missing_skill: <XCircle className="w-4 h-4 text-red-400" />,
  weak_category: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  red_flag: <AlertTriangle className="w-4 h-4 text-red-400" />,
  quick_win: <Lightbulb className="w-4 h-4 text-cyan-400" />,
};

export const ScoreGapActionPanel: React.FC<ScoreGapActionPanelProps> = ({
  categories,
  skillBuckets,
  redFlags,
  quickWins,
  overallScore,
  projectedScore,
}) => {
  const gapItems = buildGapItems(categories, skillBuckets, redFlags, quickWins);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'missing_skill' | 'weak_category' | 'red_flag' | 'quick_win'>('all');

  const filtered = filter === 'all' ? gapItems : gapItems.filter(g => g.type === filter);
  const criticalCount = gapItems.filter(g => g.severity === 'critical').length;
  const missingSkillCount = gapItems.filter(g => g.type === 'missing_skill').length;

  if (gapItems.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2 }}
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#0f172a', borderColor: '#1e293b' }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: '#1e293b' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-semibold text-slate-100">What to Fix to Increase Your Score</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {gapItems.length} items found -- fix these to go from {overallScore} to {projectedScore}+
              </p>
            </div>
          </div>
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/25">
              {criticalCount} critical
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {[
            { key: 'all' as const, label: 'All', count: gapItems.length },
            { key: 'missing_skill' as const, label: 'Missing Skills', count: missingSkillCount },
            { key: 'weak_category' as const, label: 'Weak Areas', count: gapItems.filter(g => g.type === 'weak_category').length },
            { key: 'red_flag' as const, label: 'Red Flags', count: gapItems.filter(g => g.type === 'red_flag').length },
            { key: 'quick_win' as const, label: 'Quick Wins', count: gapItems.filter(g => g.type === 'quick_win').length },
          ].filter(t => t.count > 0).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:text-slate-300'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2 max-h-[520px] overflow-y-auto">
        {filtered.map((item, i) => {
          const style = severityStyles[item.severity] || severityStyles.medium;
          const isExpanded = expandedId === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isExpanded ? style.border : '#1e293b'}` }}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full text-left p-3.5 flex items-start gap-3 transition-colors"
                style={{ background: isExpanded ? style.bg : 'rgba(30,41,59,0.4)' }}
              >
                <div className="mt-0.5 shrink-0">{typeIcons[item.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-200">{item.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${style.badge}`}>
                      {item.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto">{item.category}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{item.action}</p>
                </div>
                <ChevronDown
                  className="w-4 h-4 text-slate-500 shrink-0 mt-1 transition-transform"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                />
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
                    <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: '#0c1420' }}>
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                        <Plus className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider mb-1">Add to Your Resume</p>
                          <p className="text-sm text-slate-300 leading-relaxed">{item.action}</p>
                        </div>
                      </div>

                      {item.alternative && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/15">
                          <Shuffle className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-cyan-300 uppercase tracking-wider mb-1">Alternative</p>
                            <p className="text-sm text-slate-300 leading-relaxed">{item.alternative}</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span>Estimated impact: +{item.impact} points</span>
                      </div>
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
