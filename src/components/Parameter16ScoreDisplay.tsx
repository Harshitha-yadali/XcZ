/**
 * 16-Parameter Score Display Component
 * Shows the optimization scores for all 16 ATS parameters
 */

import React from 'react';
import { CheckCircle, AlertCircle, TrendingUp, Target } from 'lucide-react';

interface Parameter16Score {
  parameter: string;
  parameterNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  suggestions: string[];
}

interface Parameter16ScoreDisplayProps {
  beforeScores?: Parameter16Score[];
  afterScores?: Parameter16Score[];
  overallBefore?: number;
  overallAfter?: number;
  improvement?: number;
  compact?: boolean;
  mode?: 'comparison' | 'scan';
}

const PARAMETER_ICONS: Record<number, string> = {
  1: '📇', // Contact & Title
  2: '📝', // Summary
  3: '🎯', // Role Title Match
  4: '💻', // Hard Skills
  5: '🤝', // Soft Skills
  6: '📋', // Section Order
  7: '🔤', // Word Variety
  8: '📊', // Quantified Results
  9: '⚡', // Action Verbs
  10: '🔑', // Keyword Density
  11: '📐', // Formatting
  12: '✅', // Section Completeness
  13: '📅', // Chronology
  14: '🎯', // Relevance Filtering
  15: '🔧', // Tools & Versions
  16: '🔬', // Project Technical Depth
};

export const Parameter16ScoreDisplay: React.FC<Parameter16ScoreDisplayProps> = ({
  beforeScores,
  afterScores,
  overallBefore,
  overallAfter,
  improvement,
  compact = false,
  mode = 'comparison',
}) => {
  const isScan = mode === 'scan';
  const scores = isScan ? (beforeScores || afterScores || []) : (afterScores || beforeScores || []);
  const currentScore = overallBefore ?? overallAfter ?? 0;
  
  const getScoreColor = (percentage: number): string => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };
  
  const getScoreBgColor = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  const getOverallGrade = (score: number): { grade: string; color: string } => {
    if (score >= 90) return { grade: 'A+', color: 'text-green-500' };
    if (score >= 80) return { grade: 'A', color: 'text-green-500' };
    if (score >= 70) return { grade: 'B', color: 'text-yellow-500' };
    if (score >= 60) return { grade: 'C', color: 'text-orange-500' };
    return { grade: 'D', color: 'text-red-500' };
  };

  if (isScan) {
    return (
      <div className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 rounded-lg p-4 border border-cyan-500/30">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          Quick Scan Complete
        </h3>
        <p className="mt-2 text-sm text-gray-300">Review the matched areas and improvement suggestions below.</p>
        {scores.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {scores.map((score) => (
              <div key={score.parameterNumber} className="rounded-md border border-gray-700 bg-gray-900/40 p-3">
                <div className="text-sm font-medium text-white">
                  {PARAMETER_ICONS[score.parameterNumber]} {score.parameter}
                </div>
                {score.suggestions[0] && <div className="mt-1 text-xs text-gray-400">{score.suggestions[0]}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-4 border border-purple-500/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            {isScan ? 'Quick Scan JD Match' : '16-Parameter ATS Score'}
          </h3>
          {!isScan && improvement !== undefined && improvement > 0 && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +{improvement}%
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {/* Quick shows one current score; optimization tiers show Before → After. */}
          <div className="flex items-center gap-2">
            {!isScan && overallBefore !== undefined && overallBefore > 0 && (
              <>
                <div className="text-center">
                  <div className={`text-lg font-bold ${getScoreColor(overallBefore)} opacity-60`}>
                    {overallBefore}%
                  </div>
                  <div className="text-xs text-gray-500">Before</div>
                </div>
                <span className="text-gray-500">→</span>
              </>
            )}
            <div className="text-center">
              <div className={`text-2xl font-bold ${getScoreColor(isScan ? currentScore : (overallAfter || 0))}`}>
                {isScan ? currentScore : (overallAfter || 0)}%
              </div>
              <div className="text-xs text-gray-400">
                {isScan ? 'Current Match' : overallBefore !== undefined && overallBefore > 0 ? 'After' : 'Overall'}
              </div>
            </div>
          </div>
          
          <div className="flex-1 grid grid-cols-8 gap-1">
            {scores.slice(0, 16).map((score) => (
              <div
                key={score.parameterNumber}
                className="relative group"
                title={`${score.parameter}: ${score.percentage}%`}
              >
                <div
                  className={`w-full h-2 rounded-full ${getScoreBgColor(score.percentage)} opacity-70`}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {score.parameter}: {score.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-700">
      {/* Header with Overall Score */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            16-Parameter ATS Optimization
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {isScan ? 'Current resume match against the job description' : 'Full resume rewrite based on job description analysis'}
          </p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-4">
            {!isScan && overallBefore !== undefined && (
              <div className="text-center">
                <div className="text-sm text-gray-400">Before</div>
                <div className={`text-xl font-bold ${getScoreColor(overallBefore)}`}>
                  {overallBefore}%
                </div>
              </div>
            )}
            
            {!isScan && improvement !== undefined && improvement > 0 && (
              <div className="text-green-400">
                <TrendingUp className="w-6 h-6" />
              </div>
            )}
            
            {isScan ? (
              <div className="text-center">
                <div className="text-sm text-gray-400">Current Match</div>
                <div className={`text-3xl font-bold ${getScoreColor(currentScore)}`}>
                  {currentScore}%
                </div>
                <div className={`text-sm font-semibold ${getOverallGrade(currentScore).color}`}>
                  Grade: {getOverallGrade(currentScore).grade}
                </div>
              </div>
            ) : overallAfter !== undefined && (
              <div className="text-center">
                <div className="text-sm text-gray-400">After</div>
                <div className={`text-3xl font-bold ${getScoreColor(overallAfter)}`}>
                  {overallAfter}%
                </div>
                <div className={`text-sm font-semibold ${getOverallGrade(overallAfter).color}`}>
                  Grade: {getOverallGrade(overallAfter).grade}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Parameter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {scores.map((score) => {
          const beforeScore = beforeScores?.find(s => s.parameterNumber === score.parameterNumber);
          const improved = !isScan && beforeScore && score.percentage > beforeScore.percentage;
          
          return (
            <div
              key={score.parameterNumber}
              className="bg-gray-800/50 rounded-lg p-3 border border-gray-700 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{PARAMETER_ICONS[score.parameterNumber]}</span>
                  <span className="text-sm font-medium text-white">
                    {score.parameterNumber}. {score.parameter}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  {improved && (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  )}
                  <span className={`text-sm font-bold ${getScoreColor(score.percentage)}`}>
                    {score.percentage}%
                  </span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getScoreBgColor(score.percentage)} transition-all duration-500`}
                  style={{ width: `${score.percentage}%` }}
                />
              </div>
              
              {/* Suggestions (if score is low) */}
              {score.percentage < 70 && score.suggestions.length > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  <AlertCircle className="w-3 h-3 inline mr-1 text-yellow-500" />
                  {score.suggestions[0]}
                </div>
              )}
              
              {score.percentage >= 80 && (
                <div className="mt-2 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3 inline mr-1" />
                  Optimized
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>80%+ Excellent</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>60-79% Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>40-59% Needs Work</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>&lt;40% Critical</span>
        </div>
      </div>
    </div>
  );
};

export default Parameter16ScoreDisplay;
