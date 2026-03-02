import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Target, BarChart3, ArrowRight } from 'lucide-react';
import type { ParameterDelta, CategoryDelta, OptimizationSessionResult } from '../services/optimizationLoopController';
import type { UserActionCard } from '../services/gapClassificationEngine';

interface ScoreDeltaDisplayProps {
  result: OptimizationSessionResult;
  userActionCards?: UserActionCard[];
}

const ScoreDeltaDisplay: React.FC<ScoreDeltaDisplayProps> = ({ result, userActionCards }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllParameters, setShowAllParameters] = useState(false);

  const { beforeScore, afterScore, parameterDeltas, categoryDeltas, reachedTarget, totalChanges } = result;

  const toggleCategory = (name: string) => {
    setExpandedCategory(expandedCategory === name ? null : name);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScoreCard label="Before" score={beforeScore.overallScore} band={beforeScore.matchBand} probability={beforeScore.interviewProbability} variant="before" />
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-8 h-8 text-gray-400 hidden md:block" />
            <span className={`text-2xl font-bold ${afterScore.overallScore - beforeScore.overallScore > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
              {afterScore.overallScore - beforeScore.overallScore > 0 ? '+' : ''}{afterScore.overallScore - beforeScore.overallScore}
            </span>
            <span className="text-xs text-gray-500">points</span>
          </div>
        </div>
        <ScoreCard label="After" score={afterScore.overallScore} band={afterScore.matchBand} probability={afterScore.interviewProbability} variant="after" />
      </div>

      {reachedTarget ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-800">Target Score Reached</p>
            <p className="text-sm text-emerald-600">Your resume scores {afterScore.overallScore}/100 -- ready for submission.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-800">Some Gaps Need Your Input</p>
            <p className="text-sm text-amber-600">AI optimization brought you to {afterScore.overallScore}/100. See action items below to reach 90+.</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-800 text-lg">Category Breakdown</h3>
        </div>
        {categoryDeltas.map(cat => {
          const isExpanded = expandedCategory === cat.name;
          const catParams = parameterDeltas.filter(p => p.category === cat.name);
          return (
            <div key={cat.name} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => toggleCategory(cat.name)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 w-10">{cat.weight}%</span>
                  <span className="font-medium text-gray-800">{cat.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">{cat.beforePercentage}%</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span className={`font-semibold ${cat.afterPercentage >= 80 ? 'text-emerald-600' : cat.afterPercentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                      {cat.afterPercentage}%
                    </span>
                  </div>
                  <DeltaBadge delta={cat.delta} />
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {catParams.map(param => (
                    <div key={param.id} className="flex items-center justify-between px-6 py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-6">#{param.id}</span>
                        <span className="text-sm text-gray-700">{param.name}</span>
                        {!param.fixable && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">Manual</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-400 tabular-nums">{param.beforePercentage}%</span>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <span className={`font-medium tabular-nums ${param.afterPercentage >= 80 ? 'text-emerald-600' : param.afterPercentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {param.afterPercentage}%
                          </span>
                        </div>
                        <DeltaBadge delta={param.delta} small />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAllParameters && (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <h4 className="font-medium text-gray-800">All 20 Parameters</h4>
          </div>
          <div className="divide-y divide-gray-100">
            {parameterDeltas.map(param => (
              <div key={param.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-gray-400 w-6 flex-shrink-0">#{param.id}</span>
                  <span className="text-sm text-gray-700 truncate">{param.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">{param.category}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ProgressBar before={param.beforePercentage} after={param.afterPercentage} />
                  <DeltaBadge delta={param.delta} small />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowAllParameters(!showAllParameters)}
        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        {showAllParameters ? 'Hide detailed parameters' : 'Show all 20 parameters'}
      </button>

      {userActionCards && userActionCards.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Actions Required for 90+
          </h3>
          {userActionCards.map(card => (
            <div key={card.parameterId} className={`p-4 rounded-xl border ${
              card.priority === 'critical' ? 'border-red-200 bg-red-50' :
              card.priority === 'high' ? 'border-amber-200 bg-amber-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  card.priority === 'critical' ? 'text-red-500' :
                  card.priority === 'high' ? 'text-amber-500' :
                  'text-blue-500'
                }`} />
                <div>
                  <p className="font-medium text-gray-800">{card.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{card.description}</p>
                  <p className="text-sm font-medium text-gray-700 mt-2">{card.actionRequired}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.impact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalChanges.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          {totalChanges.length} improvements applied across {result.iterations.length} optimization pass{result.iterations.length !== 1 ? 'es' : ''}
          {result.processingTimeMs > 0 && ` in ${(result.processingTimeMs / 1000).toFixed(1)}s`}
        </div>
      )}
    </div>
  );
};

const ScoreCard: React.FC<{ label: string; score: number; band: string; probability: string; variant: 'before' | 'after' }> = ({ label, score, band, probability, variant }) => {
  const isBefore = variant === 'before';
  const ringColor = score >= 90 ? 'text-emerald-500' : score >= 70 ? 'text-blue-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const bgColor = isBefore ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50/50 border-emerald-200';

  return (
    <div className={`p-5 rounded-xl border ${bgColor} text-center`}>
      <p className="text-sm font-medium text-gray-500 mb-3">{label} Optimization</p>
      <div className="relative w-24 h-24 mx-auto mb-3">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
          <path className="text-gray-200" strokeDasharray="100, 100" d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
          <path className={ringColor} strokeDasharray={`${score}, 100`} d="M18 2.0845a15.9155 15.9155 0 0 1 0 31.831a15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">{score}</span>
        </div>
      </div>
      <p className={`text-sm font-semibold ${score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-red-700'}`}>{band}</p>
      <p className="text-xs text-gray-500 mt-1">Interview: {probability}</p>
    </div>
  );
};

const DeltaBadge: React.FC<{ delta: number; small?: boolean }> = ({ delta, small }) => {
  const size = small ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  if (delta > 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${size} bg-emerald-100 text-emerald-700 rounded-full font-medium`}>
        <TrendingUp className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${size} bg-red-100 text-red-700 rounded-full font-medium`}>
        <TrendingDown className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {delta}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${size} bg-gray-100 text-gray-500 rounded-full font-medium`}>
      <Minus className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      0
    </span>
  );
};

const ProgressBar: React.FC<{ before: number; after: number }> = ({ before, after }) => {
  const color = after >= 80 ? 'bg-emerald-500' : after >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden relative">
      <div className="absolute inset-0 bg-gray-300 rounded-full" style={{ width: `${before}%` }} />
      <div className={`absolute inset-0 ${color} rounded-full transition-all duration-500`} style={{ width: `${after}%` }} />
    </div>
  );
};

export default ScoreDeltaDisplay;
