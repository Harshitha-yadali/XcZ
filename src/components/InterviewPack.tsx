import React, { useState } from 'react';
import { Check, Copy, Download, MessageSquare } from 'lucide-react';
import { saveAs } from 'file-saver';
import type { InterviewPack as Pack } from '../services/interviewPackService';
import { buildInterviewPackDocx, DOCX_MIME } from '../utils/resumeDocx';

const BUTTON = 'inline-flex items-center gap-1.5 min-h-[44px] px-3 text-sm rounded-lg border border-slate-600 text-slate-200 hover:border-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400';

export const InterviewPack: React.FC<{ pack: Pack; name: string }> = ({ pack, name }) => {
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const letter = `Dear Hiring Team,\n\n${pack.coverLetter}\n\nSincerely,\n${name}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    window.setTimeout(() => setCopied(null), 2500);
  };

  const download = () =>
    saveAs(new Blob([buildInterviewPackDocx(pack.questions, letter) as BlobPart], { type: DOCX_MIME }), `${name.replace(/\s+/g, '_') || 'Interview'}_Interview_Pack.docx`);

  return (
    <section aria-label="Interview pack" className="bg-slate-900/80 rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50 space-y-3">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-300" /> Interview pack
        </h3>
        <p className="text-xs text-slate-400">
          Likely questions for this job, with notes from your own resume, and a cover letter. Download it now: it is not saved to your account.
        </p>
        <button type="button" className={BUTTON} onClick={download}><Download className="w-4 h-4" /> Download pack (Word)</button>
      </div>

      <ol className="divide-y divide-slate-700/50 max-h-[520px] overflow-y-auto">
        {pack.questions.map(({ question, answer }, index) => (
          <li key={question} className="p-4 space-y-1">
            <p className="text-sm font-medium text-slate-100 break-words">{index + 1}. {question}</p>
            <p className={`text-sm break-words ${answer ? 'text-slate-300' : 'text-amber-300'}`}>
              {answer || 'Your resume does not show this. Prepare an honest answer, such as what you are doing to learn it.'}
            </p>
          </li>
        ))}
      </ol>

      <div className="p-4 border-t border-slate-700/50 space-y-3">
        <h4 className="text-sm font-semibold text-white">Cover letter</h4>
        <p className="text-sm text-slate-300 whitespace-pre-line break-words">{letter}</p>
        <button type="button" className={BUTTON} onClick={copy}>
          {copied === 'done' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span aria-live="polite">{copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed, select the text' : 'Copy cover letter'}</span>
        </button>
      </div>
    </section>
  );
};
