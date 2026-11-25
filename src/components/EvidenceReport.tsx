import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, Pencil, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ResumeData } from '../types/resume';
import { buildEvidenceReport, type EvidenceLine, type EvidenceStatus } from '../utils/evidenceReport';

interface EvidenceReportProps {
  submitted: ResumeData;
  resume: ResumeData;
  onUpdate: (resume: ResumeData) => void;
}

const STATUS: Record<EvidenceStatus, { label: string; className: string }> = {
  check: { label: 'Check this', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  rewritten: { label: 'Reworded', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  kept: { label: 'Your words', className: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
};
const ORDER: EvidenceStatus[] = ['check', 'rewritten', 'kept'];
const BUTTON = 'inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 rounded px-1 py-1 disabled:opacity-40';

const ReportLine: React.FC<{ line: EvidenceLine; onSave: (text: string) => void }> = ({ line, onSave }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const status = STATUS[line.status];
  const { original } = line;

  return (
    <li className="p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400 truncate">{line.heading}</span>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${status.className}`}>{status.label}</span>
      </div>

      {draft === null ? (
        <p className="text-sm text-slate-100 break-words">{line.text}</p>
      ) : (
        <textarea
          aria-label={`Edit line: ${line.text}`}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className="w-full rounded-lg bg-slate-800 border border-slate-600 p-2 text-sm text-white"
        />
      )}

      {original && line.status !== 'kept' && (
        <p className="text-xs text-slate-400 break-words">
          <span className="font-semibold">You wrote:</span> {original}
        </p>
      )}
      {line.claims.length > 0 && (
        <p className="text-xs text-amber-300 break-words">Not in the resume you submitted: {line.claims.join(', ')}</p>
      )}
      {!original && line.claims.length === 0 && (
        <p className="text-xs text-amber-300">We could not match this to a line you wrote. Keep it only if it is true.</p>
      )}

      <div className="flex flex-wrap gap-3">
        {draft === null ? (
          <>
            <button type="button" className={BUTTON} onClick={() => setDraft(line.text)}>
              <Pencil className="w-3 h-3" /> {/\d/.test(line.text) ? 'Edit' : 'Edit or add a real number'}
            </button>
            {original && line.status !== 'kept' && (
              <button type="button" className={BUTTON} onClick={() => onSave(original)}>
                <RotateCcw className="w-3 h-3" /> Use my original
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className={BUTTON}
              disabled={!draft.trim()}
              onClick={() => { onSave(draft.trim()); setDraft(null); }}
            >
              Save
            </button>
            <button type="button" className={BUTTON} onClick={() => setDraft(null)}>Cancel</button>
          </>
        )}
      </div>
    </li>
  );
};

export const EvidenceReport: React.FC<EvidenceReportProps> = ({ submitted, resume, onUpdate }) => {
  const lines = useMemo(() => buildEvidenceReport(submitted, resume), [submitted, resume]);
  const [showAll, setShowAll] = useState(false);
  if (lines.length === 0) return null;

  const count = (status: EvidenceStatus) => lines.filter((line) => line.status === status).length;
  const toCheck = count('check');
  // Sorting is stable, so lines keep their resume order within a status.
  const sorted = [...lines].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));
  const changed = sorted.filter((line) => line.status !== 'kept');
  const visible = showAll ? sorted : changed;

  return (
    <section
      aria-label="Where each line came from"
      className="bg-slate-900/80 rounded-xl shadow-lg border border-slate-700/50 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-700/50 space-y-1">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Where each line came from
        </h3>
        <p className="text-xs text-slate-400">
          Your summary, jobs, projects and extra sections, compared with the resume you submitted. Be ready to explain each line in an interview.
        </p>
        <p className={`text-sm flex items-center gap-2 ${toCheck ? 'text-amber-300' : 'text-emerald-300'}`}>
          {toCheck ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          {toCheck ? `${toCheck} to check` : 'Nothing flagged'} · {count('rewritten')} reworded · {count('kept')} in your words
        </p>
      </div>
      {visible.length > 0 && (
        <ul className="divide-y divide-slate-700/50 max-h-[520px] overflow-y-auto">
          {visible.map((line) => (
            <ReportLine key={line.id} line={line} onSave={(text) => onUpdate(line.replace(resume, text))} />
          ))}
        </ul>
      )}
      {changed.length < lines.length && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="w-full p-3 text-xs text-slate-300 hover:text-white border-t border-slate-700/50"
        >
          {showAll ? 'Show changed lines only' : `Show all ${lines.length} lines`}
        </button>
      )}
    </section>
  );
};
