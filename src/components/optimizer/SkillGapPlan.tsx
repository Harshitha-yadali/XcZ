import React from 'react';
import { BookOpen, ExternalLink, Hammer, PlayCircle } from 'lucide-react';
import type { SkillGapCard } from '../../services/scorePrediction';

/** Missing JD skills worth the most points: what each is, a free way to learn it, a project that proves it. */
export const SkillGapPlan: React.FC<{ cards: SkillGapCard[] }> = ({ cards }) => {
  if (cards.length === 0) return null;
  const baseScore = cards[0].scoreIfConfirmed - cards[0].gain;
  return (
    <section aria-labelledby="skill-gap-plan-title" className="space-y-3">
      <div>
        <h3 id="skill-gap-plan-title" className="text-sm font-semibold text-slate-100">Your plan to close the gap</h3>
        <p className="mt-1 text-xs text-slate-400">
          These skills are worth the most for this job. Learn one, build the small project, then add it to your resume and re-score for free.
        </p>
      </div>
      <ul className="space-y-3">
        {cards.map(card => (
          <li key={card.skill} className="rounded-xl border border-slate-700/70 bg-slate-800/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-slate-100">{card.skill}</p>
              <span className="flex-shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                {baseScore} → ~{card.scoreIfConfirmed}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{card.what}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={card.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-slate-500"
              >
                <PlayCircle className="h-4 w-4 text-red-400" aria-hidden="true" /> Free videos
                <ExternalLink className="h-3 w-3 text-slate-500" aria-hidden="true" />
              </a>
              {card.docsUrl && (
                <a
                  href={card.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 hover:border-slate-500"
                >
                  <BookOpen className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Official guide
                  <ExternalLink className="h-3 w-3 text-slate-500" aria-hidden="true" />
                </a>
              )}
            </div>
            <p className="mt-3 flex gap-2 text-xs text-slate-300">
              <Hammer className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />
              <span><span className="font-medium text-slate-200">Prove it: </span>{card.projectIdea}</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default SkillGapPlan;
