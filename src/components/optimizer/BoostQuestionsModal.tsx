import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Sparkles, X, XCircle } from 'lucide-react';
import type { ResumeData, UserType } from '../../types/resume';
import {
  METRIC_KINDS,
  applyCandidateBoost,
  boostCanContinue,
  boostSkillChoices,
  buildMetricQuestions,
  hasBoost,
  metricText,
  scoreLikeServer,
  type CandidateBoost,
  type ConfirmedSkill,
} from '../../services/candidateBoost';
import { getJdOptimizationTier, type JdOptimizationTierId } from '../../config/jdOptimizationTiers';
import { predictTierScore, type ScorePrediction } from '../../services/scorePrediction';
import SkillGapPlan from './SkillGapPlan';

interface BoostQuestionsModalProps {
  resume: ResumeData;
  jobDescription: string;
  candidateType: UserType;
  /** Sets how many questions are asked: Deep lists every missing JD skill and more numbers. */
  tier: JdOptimizationTierId;
  /**
   * Before a paid run: Deep cannot skip the questions, and Smart/Deep show a
   * predicted score before Continue leads to the payment / credit step.
   */
  beforeRun?: boolean;
  /** Continue to the paid step; null when nothing was confirmed. */
  onContinue: (boost: CandidateBoost | null) => void;
  /** Close without continuing (before a run: back to choosing a tier). */
  onClose: () => void;
}

type SkillAnswer = { where: string; other: string };

export const BoostQuestionsModal: React.FC<BoostQuestionsModalProps> = ({
  resume, jobDescription, candidateType, tier, beforeRun = false, onContinue, onClose,
}) => {
  const tierConfig = getJdOptimizationTier(tier);
  const required = beforeRun && tierConfig.boostRequired;
  const predict = beforeRun && tier !== 'quick';
  const setup = useMemo(() => {
    try {
      const limits = getJdOptimizationTier(tier).boostLimits;
      return {
        skills: boostSkillChoices(resume, jobDescription, limits.skills ?? Number.MAX_SAFE_INTEGER),
        questions: buildMetricQuestions(resume, limits.metrics),
        baseline: scoreLikeServer(resume, jobDescription, candidateType),
      };
    } catch (error) {
      console.warn('Boost questions unavailable:', error);
      return null;
    }
  }, [resume, jobDescription, candidateType, tier]);

  const [ticked, setTicked] = useState<Record<string, SkillAnswer>>({});
  const [numbers, setNumbers] = useState<Record<number, string>>({});
  const [saidNone, setSaidNone] = useState(false);
  const [step, setStep] = useState<'questions' | 'prediction'>('questions');

  const whereOptions = useMemo(() => [
    ...(resume.projects || []).map((p, i) => ({ value: `project:${i}`, label: p.title, kind: 'project' as const })),
    ...(resume.workExperience || []).map((j, i) => ({ value: `experience:${i}`, label: [j.role, j.company].filter(Boolean).join(' at '), kind: 'experience' as const })),
  ].filter(option => option.label.trim()), [resume]);

  const boost = useMemo<CandidateBoost>(() => ({
    skills: Object.entries(ticked).map(([skill, answer]): ConfirmedSkill => {
      if (answer.where === 'other') return answer.other.trim() ? { skill, where: { kind: 'other', label: answer.other } } : { skill };
      const option = whereOptions.find(item => item.value === answer.where);
      return option ? { skill, where: { kind: option.kind, label: option.label } } : { skill };
    }),
    metrics: (setup?.questions || []).flatMap((q, index) => {
      const text = numbers[index] ? metricText(q.kind, numbers[index]) : null;
      return text ? [{ section: q.section, entryIndex: q.entryIndex, bulletIndex: q.bulletIndex, bulletText: q.bulletText, text }] : [];
    }),
  }), [ticked, numbers, setup, whereOptions]);

  const estimate = useMemo(() => {
    if (!setup || !hasBoost(boost)) return setup?.baseline ?? 0;
    try {
      return scoreLikeServer(applyCandidateBoost(resume, boost), jobDescription, candidateType);
    } catch {
      return setup.baseline;
    }
  }, [boost, setup, resume, jobDescription, candidateType]);

  const nothingToAsk = !setup || (setup.skills.length === 0 && setup.questions.length === 0);
  const showPrediction = predict && Boolean(setup) && (step === 'prediction' || nothingToAsk);
  useEffect(() => {
    if (nothingToAsk && !(predict && setup)) onContinue(null);
  }, [nothingToAsk, predict, setup, onContinue]);

  const prediction = useMemo<ScorePrediction | null>(() => {
    if (!showPrediction) return null;
    try {
      return predictTierScore({ resume, jobDescription, candidateType, boost: hasBoost(boost) ? boost : null, tier });
    } catch (error) {
      console.warn('Score prediction unavailable:', error);
      return null;
    }
  }, [showPrediction, resume, jobDescription, candidateType, boost, tier]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!setup || (nothingToAsk && !showPrediction)) return null;

  const confirmed = hasBoost(boost) ? boost : null;
  const canContinue = boostCanContinue(beforeRun ? tier : 'quick', setup.skills.length, Object.keys(ticked).length, saidNone);
  const toggleSkill = (skill: string) => {
    setSaidNone(false);
    setTicked(current => {
      const next = { ...current };
      if (next[skill]) delete next[skill];
      else next[skill] = { where: '', other: '' };
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="boost-title"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-slate-700/70 bg-slate-900 text-slate-100 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
          <Sparkles className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-300" aria-hidden="true" />
          <div className="flex-1">
            <h2 id="boost-title" className="text-lg font-semibold">{showPrediction ? `Your predicted score with ${tierConfig.name}` : 'Boost your score — 30 seconds'}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {showPrediction
                ? 'Before you pay: what this job match can honestly reach with what your resume shows and what you confirmed.'
                : required
                  ? `${tierConfig.name} aims for ${tierConfig.target.points}. Answer the skills question so we know what we can honestly write in.`
                  : 'Your score only counts what your resume shows. Confirm what is true and we will write it in.'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {showPrediction ? (
          <PredictionBody prediction={prediction} tierName={tierConfig.name} />
        ) : (
        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm" aria-live="polite">
            {estimate > setup.baseline ? (
              <span>Your answers take this job match from <strong>{setup.baseline}</strong> to <strong className="text-emerald-300">~{estimate}</strong>, before the AI rewrite.</span>
            ) : (
              <span>Your job match now: <strong>{setup.baseline}</strong>. Each true answer below can raise it.</span>
            )}
          </div>

          {setup.skills.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-200">Tick the skills you actually have</legend>
              <p className="mt-1 text-xs text-slate-500">The job asks for these and your resume does not show them yet.</p>
              <div className="mt-3 space-y-2">
                {setup.skills.map(skill => {
                  const answer = ticked[skill];
                  return (
                    <div key={skill} className={`rounded-lg border ${answer ? 'border-emerald-400/40 bg-slate-800/70' : 'border-slate-800 bg-slate-800/30'}`}>
                      <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3">
                        <input type="checkbox" checked={Boolean(answer)} onChange={() => toggleSkill(skill)} className="h-5 w-5 accent-emerald-400" />
                        <span className="text-sm">{skill}</span>
                      </label>
                      {answer && (
                        <div className="flex flex-col gap-2 px-3 pb-3 sm:flex-row">
                          <select
                            aria-label={`Where did you use ${skill}?`}
                            value={answer.where}
                            onChange={event => setTicked(current => ({ ...current, [skill]: { ...answer, where: event.target.value } }))}
                            className="min-h-[44px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                          >
                            <option value="">Where did you use it? (optional)</option>
                            {whereOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            <option value="other">Somewhere else…</option>
                          </select>
                          {answer.where === 'other' && (
                            <input
                              type="text"
                              maxLength={80}
                              value={answer.other}
                              onChange={event => setTicked(current => ({ ...current, [skill]: { ...answer, other: event.target.value } }))}
                              placeholder="e.g. college hackathon"
                              aria-label={`Where you used ${skill}`}
                              className="min-h-[44px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {required && (
                <label className={`mt-2 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 ${saidNone ? 'border-amber-400/40 bg-slate-800/70' : 'border-slate-800 bg-slate-800/30'}`}>
                  <input
                    type="checkbox"
                    checked={saidNone}
                    onChange={() => { setSaidNone(!saidNone); setTicked({}); }}
                    className="h-5 w-5 accent-amber-400"
                  />
                  <span className="text-sm">I have none of these</span>
                </label>
              )}
            </fieldset>
          )}

          {setup.questions.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold text-slate-200">Add a few numbers</legend>
              <p className="mt-1 text-xs text-slate-500">Skip any you do not know. Use your real numbers.</p>
              <div className="mt-3 space-y-4">
                {setup.questions.map((q, index) => {
                  const kind = METRIC_KINDS[q.kind];
                  const value = numbers[index] || '';
                  const setValue = (next: string) => setNumbers(current => ({ ...current, [index]: next }));
                  return (
                    <div key={`${q.section}-${q.entryIndex}-${q.bulletIndex}`} className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
                      <p className="text-sm font-medium text-slate-200">{kind.question}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{q.entryTitle}: “{q.bulletText}”</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {kind.chips.map(chip => (
                          <button
                            key={chip}
                            type="button"
                            aria-pressed={value === chip}
                            onClick={() => setValue(value === chip ? '' : chip)}
                            className={`min-h-[44px] min-w-[56px] rounded-lg border px-3 text-sm ${value === chip ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                          >
                            {chip}
                          </button>
                        ))}
                        <input
                          type="text"
                          inputMode="decimal"
                          maxLength={12}
                          value={kind.chips.includes(value) ? '' : value}
                          onChange={event => setValue(event.target.value)}
                          placeholder="Other"
                          aria-label={`${kind.question} Other value`}
                          className="min-h-[44px] w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}

          <p className="text-xs text-amber-200/80">Only tick what's true — recruiters may ask about it.</p>
        </div>
        )}

        {showPrediction ? (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {!nothingToAsk && (
                <button type="button" onClick={() => setStep('questions')} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm text-slate-300 hover:bg-slate-800">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Confirm more
                </button>
              )}
              <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg px-4 text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
                Choose another tier
              </button>
            </div>
            <button
              type="button"
              onClick={() => onContinue(confirmed)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              {prediction && !prediction.reachesTarget ? 'Continue anyway' : `Continue with ${tierConfig.name}`} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {required ? (
              <p className="text-xs text-slate-500 sm:max-w-[60%]">{canContinue ? 'Next: your predicted score, before any payment.' : 'Tick your skills, or "I have none of these", to continue.'}</p>
            ) : (
              <button type="button" onClick={() => onContinue(null)} className="min-h-[44px] rounded-lg px-4 text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline">
                Skip
              </button>
            )}
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => (predict ? setStep('prediction') : onContinue(confirmed))}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const PredictionBody: React.FC<{ prediction: ScorePrediction | null; tierName: string }> = ({ prediction, tierName }) => {
  if (!prediction) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5 text-sm text-slate-300 sm:px-6">
        We could not estimate the score for this job just now. You can still continue.
      </div>
    );
  }
  const { current, predicted, target, reachesTarget, missingSkills, gapPlan } = prediction;
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
      <div className={`rounded-xl border px-4 py-4 ${reachesTarget ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-amber-400/40 bg-amber-400/10'}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          {reachesTarget ? (
            <><CheckCircle className="h-5 w-5 text-emerald-300" aria-hidden="true" /><span className="text-emerald-200">Reaches the {target} target</span></>
          ) : (
            <><XCircle className="h-5 w-5 text-amber-300" aria-hidden="true" /><span className="text-amber-200">Max ~{predicted}, target {target}</span></>
          )}
        </div>
        <p className="mt-3 text-base text-slate-100">
          {reachesTarget ? (
            <>With {tierName}, your resume can reach <strong className="text-emerald-300">~{predicted}</strong> for this job (now {current}).</>
          ) : (
            <>
              Max possible for this job: <strong className="text-amber-300">~{predicted}</strong> (now {current})
              {missingSkills.length > 0 && <> — you're missing {missingSkills.slice(0, 3).join(', ')} (not confirmed)</>}.
            </>
          )}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Estimate from our scorer, using only what your resume shows and what you confirmed. The AI rewrite may add a few points.
          {!reachesTarget && ' Nothing is invented to hit the target.'}
        </p>
      </div>
      {!reachesTarget && <SkillGapPlan cards={gapPlan} />}
    </div>
  );
};

export default BoostQuestionsModal;
