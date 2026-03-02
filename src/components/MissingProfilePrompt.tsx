import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Link, Linkedin, Github, TrendingDown, CheckCircle, X } from 'lucide-react';
import type { ResumeData } from '../types/resume';

interface MissingItem {
  id: string;
  label: string;
  description: string;
  impact: 'high' | 'medium';
  scoreEffect: string;
  present: boolean;
  icon: React.ReactNode;
  compulsory: boolean;
}

interface MissingProfilePromptProps {
  resumeData: ResumeData;
  onDismiss: () => void;
}

const MissingProfilePrompt: React.FC<MissingProfilePromptProps> = ({ resumeData, onDismiss }) => {
  const [collapsed, setCollapsed] = useState(false);

  const items: MissingItem[] = [
    {
      id: 'linkedin',
      label: 'LinkedIn URL',
      description: 'Recruiters check LinkedIn profiles. This is expected on every resume.',
      impact: 'high',
      scoreEffect: 'Score decreases by ~3-5 points without it',
      present: !!(resumeData.linkedin && resumeData.linkedin.trim().length > 5),
      icon: <Linkedin className="w-4 h-4" />,
      compulsory: true,
    },
    {
      id: 'github',
      label: 'GitHub / Portfolio URL',
      description: 'Shows your code quality and project work to hiring managers.',
      impact: 'high',
      scoreEffect: 'Score decreases by ~3-5 points without it',
      present: !!(resumeData.github && resumeData.github.trim().length > 5),
      icon: <Github className="w-4 h-4" />,
      compulsory: true,
    },
    {
      id: 'summary',
      label: 'Professional Summary',
      description: 'A 2-3 line summary helps recruiters quickly understand your profile.',
      impact: 'medium',
      scoreEffect: 'Score may decrease by ~2-3 points',
      present: !!(resumeData.summary && resumeData.summary.trim().length > 20),
      icon: <Link className="w-4 h-4" />,
      compulsory: false,
    },
    {
      id: 'phone',
      label: 'Phone Number',
      description: 'Contact information is essential for interview callbacks.',
      impact: 'high',
      scoreEffect: 'ATS compatibility decreases without contact info',
      present: !!(resumeData.phone && resumeData.phone.trim().length > 5),
      icon: <Link className="w-4 h-4" />,
      compulsory: true,
    },
  ];

  const missingItems = items.filter(i => !i.present);
  const compulsoryMissing = missingItems.filter(i => i.compulsory);
  const optionalMissing = missingItems.filter(i => !i.compulsory);

  if (missingItems.length === 0) return null;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: compulsoryMissing.length > 0 ? 'rgba(245,158,11,0.04)' : 'rgba(6,182,212,0.04)',
        borderColor: compulsoryMissing.length > 0 ? 'rgba(245,158,11,0.25)' : 'rgba(6,182,212,0.2)',
      }}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {compulsoryMissing.length > 0 ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
          )}
          <div>
            <h4 className="text-sm font-semibold text-slate-200">
              {compulsoryMissing.length > 0
                ? `${compulsoryMissing.length} important detail${compulsoryMissing.length > 1 ? 's' : ''} missing`
                : 'Optional improvements available'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {compulsoryMissing.length > 0
                ? 'Add these to avoid score drops when checking your resume'
                : 'Adding these may improve your score slightly'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          {compulsoryMissing.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
            >
              <div className="mt-0.5 text-amber-400">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{item.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold uppercase">Required</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="w-3 h-3 text-red-400" />
                  <span className="text-xs text-red-400">{item.scoreEffect}</span>
                </div>
              </div>
            </div>
          ))}

          {optionalMissing.map(item => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(30,41,59,0.8)' }}
            >
              <div className="mt-0.5 text-slate-400">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">{item.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 font-medium">Optional</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                <p className="text-xs text-slate-500 mt-1">{item.scoreEffect}</p>
              </div>
            </div>
          ))}

          <p className="text-xs text-slate-600 pt-1">
            You can add these in the Edit tab. If you skip them, your score in the Score Checker will be lower.
          </p>
        </div>
      )}
    </div>
  );
};

export default MissingProfilePrompt;
