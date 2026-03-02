import React, { useState } from 'react';
import { FileText, ArrowLeft, CheckCircle, Send, BarChart3, Pencil, Eye, Download } from 'lucide-react';
import { ResumeData, UserType } from '../types/resume';
import { ExportOptions, defaultExportOptions } from '../types/export';
import type { OptimizationSessionResult } from '../services/optimizationLoopController';
import ScoreDeltaDisplay from './ScoreDeltaDisplay';
import { Parameter16ScoreDisplay } from './Parameter16ScoreDisplay';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  resumeData?: ResumeData;
  userType?: UserType;
}

interface MobileOptimizedInterfaceProps {
  sections: Section[];
  onStartNewResume: () => void;
  exportOptions?: ExportOptions;
  jobContext?: {
    jobId?: string;
    roleTitle?: string;
    companyName?: string;
    fromJobApplication?: boolean;
  } | null;
  onApplyNow?: () => void;
  jdOptimizationResult?: OptimizationSessionResult | null;
  parameter16Scores?: {
    beforeScores: any[];
    afterScores: any[];
    overallBefore: number;
    overallAfter: number;
    improvement: number;
  } | null;
  onEditResume?: () => void;
  onExportResume?: () => void;
  editorMode?: 'preview' | 'edit';
  onEditorModeChange?: (mode: 'preview' | 'edit') => void;
  resumeEditor?: React.ReactNode;
}

export const MobileOptimizedInterface: React.FC<MobileOptimizedInterfaceProps> = ({
  sections,
  onStartNewResume,
  exportOptions = defaultExportOptions,
  jobContext,
  onApplyNow,
  jdOptimizationResult,
  parameter16Scores,
  onEditResume,
  onExportResume,
  editorMode = 'preview',
  onEditorModeChange,
  resumeEditor
}) => {
  const hasScores = !!(jdOptimizationResult || parameter16Scores);
  const [activeTab, setActiveTab] = useState<'preview' | 'scores' | 'export'>('preview');
  const isEditing = editorMode === 'edit';

  const resumeSection = sections.find(s => s.id === 'resume');

  const handleEditToggle = () => {
    if (isEditing) {
      onEditorModeChange?.('preview');
    } else {
      onEditResume?.();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-[#020617] pb-24">
      <div className="bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm('Start a new resume? Current progress will be cleared.')) {
                onStartNewResume();
              }
            }}
            className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">New Resume</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-800/60 rounded-lg border border-slate-700/50 p-0.5">
              <button
                onClick={() => {
                  onEditorModeChange?.('preview');
                  setActiveTab('preview');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  !isEditing
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                onClick={handleEditToggle}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  isEditing
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400'
                }`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
          </div>
        </div>

        {!isEditing && (
          <div className="flex border-t border-slate-700/50">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ minHeight: '44px' }}
            >
              Preview
            </button>
            {hasScores && (
              <button
                onClick={() => setActiveTab('scores')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'scores'
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ minHeight: '44px' }}
              >
                Scores
              </button>
            )}
            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === 'export'
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{ minHeight: '44px' }}
            >
              Download
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {isEditing ? (
          <div className="space-y-4">
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
              {resumeEditor}
            </div>

            <button
              onClick={onExportResume}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition-all duration-300"
            >
              <Download className="w-5 h-5" />
              Export Resume
            </button>
          </div>
        ) : activeTab === 'scores' && hasScores ? (
          <div className="space-y-4">
            <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-700/50 p-4">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-emerald-400" />
                Score Improvements
              </h2>
              {jdOptimizationResult ? (
                <ScoreDeltaDisplay
                  result={jdOptimizationResult}
                  userActionCards={jdOptimizationResult.gapClassification.userActionCards}
                />
              ) : parameter16Scores ? (
                <Parameter16ScoreDisplay
                  beforeScores={parameter16Scores.beforeScores}
                  afterScores={parameter16Scores.afterScores}
                  overallBefore={parameter16Scores.overallBefore}
                  overallAfter={parameter16Scores.overallAfter}
                  improvement={parameter16Scores.improvement}
                  compact={true}
                />
              ) : null}
            </div>
          </div>
        ) : activeTab === 'preview' ? (
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-lg border border-slate-700/50 p-3">
            <h2 className="text-base font-bold text-white mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-emerald-400" />
              Your Optimized Resume
            </h2>
            <div
              className="relative w-full bg-slate-800/50 rounded-xl overflow-hidden border border-slate-600/50"
              style={{
                height: 'calc(100vh - 300px)',
                minHeight: '450px'
              }}
            >
              <div
                className="w-full h-full overflow-auto flex items-start justify-center p-4"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                <div
                  className="transform-gpu"
                  style={{
                    transform: 'scale(0.45)',
                    transformOrigin: 'top center',
                    minWidth: '210mm'
                  }}
                >
                  {resumeSection?.component}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">
              Scroll to view full resume
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobContext?.fromJobApplication && jobContext?.roleTitle && (
              <div className="bg-gradient-to-r from-emerald-900/30 to-green-900/30 rounded-xl p-4 border border-emerald-500/30">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-white mb-1">Resume Ready!</h3>
                    <p className="text-sm text-slate-300">
                      Optimized for {jobContext.roleTitle}{jobContext.companyName ? ` at ${jobContext.companyName}` : ''}
                    </p>
                  </div>
                </div>
                {onApplyNow && (
                  <button
                    onClick={onApplyNow}
                    className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20"
                    style={{ minHeight: '48px' }}
                  >
                    <Send className="w-5 h-5" />
                    <span>Apply Now</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onExportResume}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300"
              style={{ minHeight: '56px', fontSize: '16px' }}
            >
              <Download className="w-5 h-5" />
              Export Resume (PDF / Word)
            </button>

            <p className="text-xs text-slate-400 text-center">
              Choose font, paper size, template, and spacing before downloading
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
