import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Target, BarChart3, ArrowRight } from 'lucide-react';
import type { ParameterDelta, CategoryDelta, OptimizationSessionResult } from '../services/optimizationLoopController';
import type { UserActionCard } from '../services/gapClassificationEngine';

export interface ScoreSummaryOverride {
  before: {
    score: number;
    band: string;
    probability: string;
  };
  after: {
    score: number;
    band: string;
    probability: string;
  };
}

interface ScoreDeltaDisplayProps {
  result: OptimizationSessionResult;
  userActionCards?: UserActionCard[];
  scoreSummaryOverride?: ScoreSummaryOverride;
  mode?: 'comparison' | 'scan';
}

const ScoreDeltaDisplay: React.FC<ScoreDeltaDisplayProps> = ({ result, userActionCards, scoreSummaryOverride, mode = 'comparison' }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllParameters, setShowAllParameters] = useState(false);

  const { beforeScore, afterScore, parameterDeltas, categoryDeltas, reachedTarget, totalChanges } = result;
  const displayBefore = scoreSummaryOverride?.before ?? {
    score: beforeScore.overallScore,
    band: beforeScore.matchBand,
    probability: beforeScore.interviewProbability,
  };
  const displayAfter = scoreSummaryOverride?.after ?? {
    score: afterScore.overallScore,
    band: afterScore.matchBand,
    probability: afterScore.interviewProbability,
  };
  const displayedDelta = displayAfter.score - displayBefore.score;
  const showReachedTarget = reachedTarget || displayAfter.score >= 90;
  const isScan = mode === 'scan';

  const toggleCategory = (name: string) => {
    setExpandedCategory(expandedCategory === name ? null : name);
  };

  return (
    <div className="space-y-6">
      {!isScan && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScoreCard label="Before" score={displayBefore.score} band={displayBefore.band} probability={displayBefore.probability} variant="before" />
          <div className="flex items-center justify-center">
            <div className="w-full rounded-2xl border border-slate-700/60 bg-slate-950/50 px-6 py-8 flex flex-col items-center gap-2 text-center shadow-[0_20px_45px_-30px_rgba(0,0,0,0.7)]">
              <ArrowRight className="w-8 h-8 text-slate-400 hidden md:block" />
              <span className={`text-3xl font-bold ${displayedDelta > 0 ? 'text-emerald-400' : displayedDelta < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                {displayedDelta > 0 ? '+' : ''}{displayedDelta}
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">ATS points</span>
              <span className="text-sm text-slate-400">Saved before and final after optimization</span>
            </div>
          </div>
          <ScoreCard label="After" score={displayAfter.score} band={displayAfter.band} probability={displayAfter.probability} variant="after" />
        </div>
      )}

      {isScan ? (
        <div className="flex items-center gap-3 p-4 bg-cyan-500/10 border border-cyan-400/30 rounded-xl">
          <Target className="w-5 h-5 text-cyan-300 flex-shrink-0" />
          <div>
            <p className="font-semibold text-cyan-100">Quick Scan Complete</p>
            <p className="text-sm text-cyan-200/80">Review the matched areas and gaps below. Your resume was analyzed but not rewritten.</p>
          </div>
        </div>
      ) : showReachedTarget ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-100">Target Score Reached</p>
            <p className="text-sm text-emerald-200/80">Your resume scores {displayAfter.score}/100 and is ready for submission.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-400/30 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-300 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-100">Some Gaps Need Your Input</p>
            <p className="text-sm text-amber-200/80">AI optimization brought you to {displayAfter.score}/100. Review the action items below to push past 90.</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-cyan-300" />
          <h3 className="font-semibold text-white text-lg">{isScan ? 'Scan Findings' : 'Category Breakdown'}</h3>
        </div>
        {categoryDeltas.map(cat => {
          const isExpanded = expandedCategory === cat.name;
          const catParams = parameterDeltas.filter(p => p.category === cat.name);
          return (
            <div key={cat.name} className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-950/45">
              <button
                onClick={() => toggleCategory(cat.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-900/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {!isScan && <span className="text-sm font-medium text-slate-400 w-10">{cat.weight}%</span>}
                  <span className="font-medium text-slate-100">{cat.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  {!isScan && <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">{cat.beforePercentage}%</span>
                    <ArrowRight className="w-3 h-3 text-slate-500" />
                    <span className={`font-semibold ${cat.afterPercentage >= 80 ? 'text-emerald-400' : cat.afterPercentage >= 60 ? 'text-amber-300' : 'text-red-400'}`}>
                      {cat.afterPercentage}%
                    </span>
                  </div>}
                  {!isScan && <DeltaBadge delta={cat.delta} />}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-slate-800 bg-slate-900/40">
                  {catParams.map(param => (
                    <div key={param.id} className="flex items-center justify-between px-6 py-3 border-b border-slate-800/70 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-6">#{param.id}</span>
                        <span className="text-sm text-slate-200">{param.name}</span>
                        {!param.fixable && <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-200 rounded">Manual</span>}
                      </div>
                      {!isScan && <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-slate-500 tabular-nums">{param.beforePercentage}%</span>
                          <ArrowRight className="w-3 h-3 text-slate-600" />
                          <span className={`font-medium tabular-nums ${param.afterPercentage >= 80 ? 'text-emerald-400' : param.afterPercentage >= 60 ? 'text-amber-300' : 'text-red-400'}`}>
                            {param.afterPercentage}%
                          </span>
                        </div>
                        <DeltaBadge delta={param.delta} small />
                      </div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAllParameters && (
        <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-950/45">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50">
            <h4 className="font-medium text-slate-100">All 20 Parameters</h4>
          </div>
          <div className="divide-y divide-slate-800/70">
            {parameterDeltas.map(param => (
              <div key={param.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-slate-500 w-6 flex-shrink-0">#{param.id}</span>
                  <span className="text-sm text-slate-200 truncate">{param.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded flex-shrink-0">{param.category}</span>
                </div>
                {!isScan && <div className="flex items-center gap-3 flex-shrink-0">
                  <ProgressBar before={param.beforePercentage} after={param.afterPercentage} />
                  <DeltaBadge delta={param.delta} small />
                </div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowAllParameters(!showAllParameters)}
        className="w-full py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        {showAllParameters ? 'Hide detailed parameters' : 'Show all 20 parameters'}
      </button>

      {userActionCards && userActionCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-white text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            {isScan ? 'Recommended Actions' : 'Actions Required for 90+'}
          </h3>
          {userActionCards.map(card => (
            <div key={card.parameterId} className={`p-4 rounded-xl border ${
              card.priority === 'critical' ? 'border-red-400/30 bg-red-500/10' :
              card.priority === 'high' ? 'border-amber-400/30 bg-amber-500/10' :
              'border-blue-400/30 bg-blue-500/10'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  card.priority === 'critical' ? 'text-red-300' :
                  card.priority === 'high' ? 'text-amber-300' :
                  'text-blue-300'
                }`} />
                <div>
                  <p className="font-medium text-slate-100">{card.title}</p>
                  <p className="text-sm text-slate-300 mt-1">{card.description}</p>
                  <p className="text-sm font-medium text-slate-200 mt-2">{card.actionRequired}</p>
                  <p className="text-xs text-slate-400 mt-1">{card.impact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isScan && totalChanges.length > 0 && (
        <div className="text-center text-sm text-slate-400">
          {totalChanges.length} improvements applied across {result.iterations.length} optimization pass{result.iterations.length !== 1 ? 'es' : ''}
          {result.processingTimeMs > 0 && ` in ${(result.processingTimeMs / 1000).toFixed(1)}s`}
        </div>
      )}
    </div>
  );
};

const ScoreCard: React.FC<{ label: string; score: number; band: string; probability: string; variant: 'before' | 'after' }> = ({ label, score, band, probability, variant }) => {
  const isBefore = variant === 'before';
  const ringColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-cyan-400' : score >= 50 ? 'text-amber-300' : 'text-red-400';
  const bgColor = isBefore
    ? 'bg-slate-950/55 border-slate-700/70'
    : 'bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-400/35';

  return (
    <div className={`p-5 rounded-2xl border ${bgColor} text-center shadow-[0_20px_45px_-30px_rgba(0,0,0,0.7)]`}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 mb-3">{label}{label === 'Current Match' ? '' : ' Optimization'}</p>
      <div className="relative w-24 h-24 mx-auto mb-3">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-slate-700" strokeDasharray="100, 100" d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
          <path className={ringColor} strokeDasharray={`${score}, 100`} d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-bold text-white">{score}</span>
        </div>
      </div>
      <p className={`text-sm font-semibold ${score >= 80 ? 'text-emerald-300' : score >= 60 ? 'text-amber-200' : 'text-red-300'}`}>{band}</p>
      <p className="text-xs text-slate-400 mt-1">Interview: {probability}</p>
    </div>
  );
};

const DeltaBadge: React.FC<{ delta: number; small?: boolean }> = ({ delta, small }) => {
  const size = small ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  if (delta > 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${size} bg-emerald-500/15 text-emerald-300 rounded-full font-medium border border-emerald-400/20`}>
        <TrendingUp className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${size} bg-red-500/15 text-red-300 rounded-full font-medium border border-red-400/20`}>
        <TrendingDown className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {delta}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${size} bg-slate-800 text-slate-400 rounded-full font-medium border border-slate-700`}>
      <Minus className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      0
    </span>
  );
};

const ProgressBar: React.FC<{ before: number; after: number }> = ({ before, after }) => {
  const color = after >= 80 ? 'bg-emerald-400' : after >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden relative">
      <div className="absolute inset-0 bg-slate-600 rounded-full" style={{ width: `${before}%` }} />
      <div className={`absolute inset-0 ${color} rounded-full transition-all duration-500`} style={{ width: `${after}%` }} />
    </div>
  );
};

export default ScoreDeltaDisplay;
