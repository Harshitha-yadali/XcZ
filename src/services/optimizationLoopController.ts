import { ResumeData, type UserType } from '../types/resume';
import type { JDScoringResult, ParameterScore } from './jdScoringEngine';
import { classifyGaps, GapClassification } from './gapClassificationEngine';
import { optimizeByParameter, OptimizationChange } from './targetedParameterOptimizer';
import { validateAndRepairResume, type EvidenceViolation } from './resumeEvidenceValidator';
import {
  CanonicalJdScoringService,
  type CanonicalScoreContext,
} from './canonicalJdScoringService';
import {
  getJdOptimizationTier,
  getTierTargetScore,
  type JdOptimizationTierId,
  type RefinementSection,
} from '../config/jdOptimizationTiers';
import { applyCandidateBoost, boostSkillChoices, buildMetricQuestions, type CandidateBoost } from './candidateBoost';

export interface LoopIterationResult {
  iteration: number;
  score: JDScoringResult;
  gapClassification: GapClassification;
  changes: OptimizationChange[];
}

export interface OptimizationSessionResult {
  beforeScore: JDScoringResult;
  afterScore: JDScoringResult;
  gapClassification: GapClassification;
  optimizedResume: ResumeData;
  iterations: LoopIterationResult[];
  totalChanges: OptimizationChange[];
  parameterDeltas: ParameterDelta[];
  categoryDeltas: CategoryDelta[];
  reachedTarget: boolean;
  /** The score this run aimed for (tier target). */
  targetScore: number;
  /** Why the target was not reached, from the remaining gaps; null when it was. */
  targetGuidance: TargetGuidance | null;
  processingTimeMs: number;
  evidenceViolations: EvidenceViolation[];
  scoringVersion: string;
  beforeScoreId: string;
  afterScoreId: string;
  beforeInputHash: string;
  afterInputHash: string;
}

export interface ParameterDelta {
  id: number;
  name: string;
  category: string;
  beforeScore: number;
  afterScore: number;
  beforePercentage: number;
  afterPercentage: number;
  delta: number;
  improved: boolean;
  fixable: boolean;
}

export interface CategoryDelta {
  name: string;
  beforePercentage: number;
  afterPercentage: number;
  delta: number;
  weight: number;
}

/** What only the candidate can add to close the gap to the target. */
export interface TargetGuidance {
  /** JD skills the resume does not show; credited only if the candidate confirms them. */
  missingSkills: string[];
  /** Bullets Boost would ask a number for (one per entry, up to the tier limit). */
  bulletsWithoutNumbers: number;
  /** Highest-value remaining gaps, by weighted points. */
  topGaps: string[];
  message: string;
}

export interface OptimizationLoopOptions {
  maxLoops?: number;
  modelSequence?: string[];
  /** Tried once when the loop model errors on the AI rewrite. */
  fallbackModel?: string;
  /** Sections the AI rewrites each loop. Omitted: deterministic fixes only. */
  refinementSections?: readonly RefinementSection[];
  /** Absolute score to stop at. Default: the tier target computed from the before score. */
  targetScore?: number;
  candidateType?: UserType;
  optimizationTier?: JdOptimizationTierId;
  runId?: string;
  /** Skills and numbers the candidate confirmed: allowed evidence, kept in the resume. */
  boost?: CandidateBoost | null;
}

const MAX_LOOPS = 8;
/** A loop that gains less than this many points ends the run. */
const MIN_LOOP_GAIN = 1;

/** Overall-score points a parameter still leaves on the table (weighted max − earned, scaled to 100). */
export function remainingWeightedPoints(parameter: ParameterScore, parameters: ParameterScore[]): number {
  const applicableMax = parameters.reduce((sum, p) => sum + (p.weightedMaxPoints || 0), 0);
  if (applicableMax <= 0 || parameter.applicable === false) return 0;
  return (((parameter.weightedMaxPoints || 0) - (parameter.earnedPoints || 0)) / applicableMax) * 100;
}

/** Gaps ordered by the overall points they can still add, most first. */
export function rankGapsByWeightedPoints<T extends { parameterId: number }>(
  parameters: ParameterScore[],
  gaps: T[],
  batchSize: number = 8,
): T[] {
  const byId = new Map(parameters.map(p => [p.id, p]));
  const points = (gap: T) => {
    const parameter = byId.get(gap.parameterId);
    return parameter ? remainingWeightedPoints(parameter, parameters) : 0;
  };
  return [...gaps].sort((a, b) => points(b) - points(a)).slice(0, batchSize);
}

const listNames = (names: string[], max = 4) =>
  names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;

/** The honest "why not the target" line, from what is still missing in the delivered resume. */
export function buildTargetGuidance(
  resume: ResumeData,
  jobDescription: string,
  score: JDScoringResult,
  gaps: GapClassification,
  targetScore: number,
  tierId: JdOptimizationTierId,
): TargetGuidance | null {
  if (score.overallScore >= targetScore) return null;
  const limits = getJdOptimizationTier(tierId).boostLimits;
  let missingSkills: string[] = [];
  let bulletsWithoutNumbers = 0;
  try {
    missingSkills = boostSkillChoices(resume, jobDescription, limits.skills ?? Number.MAX_SAFE_INTEGER);
    bulletsWithoutNumbers = buildMetricQuestions(resume, limits.metrics).length;
  } catch (error) {
    console.warn('Target guidance could not list missing skills:', error);
  }
  const topGaps = rankGapsByWeightedPoints(score.parameters, [...gaps.fixableGaps, ...gaps.nonFixableGaps], 3)
    .map(gap => gap.parameterName);
  const steps = [
    missingSkills.length > 0 ? `confirm ${listNames(missingSkills)} if you have used them` : '',
    bulletsWithoutNumbers > 0 ? `add real numbers to ${bulletsWithoutNumbers} bullet${bulletsWithoutNumbers === 1 ? '' : 's'}` : '',
  ].filter(Boolean);
  const message = steps.length > 0
    ? `Reached ${score.overallScore}. To reach ${targetScore}: ${steps.join('; ')}.`
    : `Reached ${score.overallScore}. The rest of the gap to ${targetScore} is in ${listNames(topGaps)}, which needs details only you can add.`;
  return { missingSkills, bulletsWithoutNumbers, topGaps, message };
}

export async function runOptimizationLoop(
  resume: ResumeData,
  jobDescription: string,
  onProgress?: (message: string, progress: number) => void,
  baselineResume?: ResumeData,
  options: OptimizationLoopOptions = {},
): Promise<OptimizationSessionResult> {
  const startTime = Date.now();
  const iterations: LoopIterationResult[] = [];
  const allChanges: OptimizationChange[] = [];
  const evidenceViolations: EvidenceViolation[] = [];

  onProgress?.('Scoring your resume against the job description...', 10);
  const baseline = baselineResume
    ? JSON.parse(JSON.stringify(baselineResume)) as ResumeData
    : JSON.parse(JSON.stringify(resume)) as ResumeData;
  // The before score is the resume as uploaded; validation also allows what the candidate confirmed.
  const evidenceBaseline = applyCandidateBoost(baseline, options.boost);
  const candidateType = options.candidateType || 'fresher';
  const optimizationTier = options.optimizationTier || 'smart';
  const beforeContext: CanonicalScoreContext = optimizationTier === 'quick'
    ? 'quick_scan'
    : `${optimizationTier}_before`;
  const afterContext: CanonicalScoreContext = optimizationTier === 'quick'
    ? 'quick_scan'
    : `${optimizationTier}_after`;
  const beforeCanonical = await CanonicalJdScoringService.score({
    resumeData: baseline,
    jobDescription,
    candidateType,
    context: beforeContext,
    runId: options.runId,
  });
  const beforeScore = beforeCanonical.scoreResult;

  let currentResume = JSON.parse(JSON.stringify(resume)) as ResumeData;
  const sameAsBaseline = JSON.stringify(currentResume) === JSON.stringify(baseline);
  let latestAfterCanonical = sameAsBaseline
    ? beforeCanonical
    : await CanonicalJdScoringService.score({
        resumeData: currentResume,
        jobDescription,
        candidateType,
        context: afterContext,
        runId: options.runId,
      });
  let currentScore = latestAfterCanonical.scoreResult;
  let currentGaps = classifyGaps(currentScore.parameters, currentScore.overallScore);
  const maxLoops = Math.max(0, Math.min(MAX_LOOPS, Math.floor(options.maxLoops ?? MAX_LOOPS)));
  const modelSequence = options.modelSequence || [];
  const targetScore = options.targetScore ?? getTierTargetScore(optimizationTier, beforeScore.overallScore);
  const optimizeOptions = (loop: number) => ({
    model: modelSequence[loop] || modelSequence[modelSequence.length - 1],
    fallbackModel: options.fallbackModel,
    sections: options.refinementSections,
  });

  for (let loop = 0; loop < maxLoops; loop++) {
    if (currentScore.overallScore >= targetScore) break;
    if (currentGaps.fixableGaps.length === 0) break;

    const progressBase = Math.min(80, 20 + loop * Math.max(8, Math.floor(50 / Math.max(1, maxLoops))));
    const selectedGaps = rankGapsByWeightedPoints(currentScore.parameters, currentGaps.fixableGaps);
    onProgress?.(
      `Optimization pass ${loop + 1}: targeting ${selectedGaps.length} lowest-scoring fixable parameters...`,
      progressBase
    );

    const previousResumeSnapshot = JSON.parse(JSON.stringify(currentResume)) as ResumeData;
    const previousScoreSnapshot = currentScore;
    let optimizationResult = await optimizeByParameter(
      currentResume,
      jobDescription,
      selectedGaps,
      optimizeOptions(loop),
    );

    if (optimizationResult.changes.length === 0) {
      optimizationResult = await optimizeByParameter(
        currentResume,
        jobDescription,
        rankGapsByWeightedPoints(currentScore.parameters, currentGaps.fixableGaps, currentGaps.fixableGaps.length),
        optimizeOptions(loop),
      );
      if (optimizationResult.changes.length === 0) {
        break;
      }
    }

    const evidenceValidation = validateAndRepairResume(evidenceBaseline, optimizationResult.optimizedResume);
    currentResume = applyCandidateBoost(evidenceValidation.resume, options.boost);
    evidenceViolations.push(...evidenceValidation.violations);

    onProgress?.(`Re-scoring after pass ${loop + 1}...`, Math.min(88, progressBase + 8));
    const previousOverall = currentScore.overallScore;
    latestAfterCanonical = await CanonicalJdScoringService.score({
      resumeData: currentResume,
      jobDescription,
      candidateType,
      context: afterContext,
      runId: options.runId,
    });
    currentScore = latestAfterCanonical.scoreResult;
    currentGaps = classifyGaps(currentScore.parameters, currentScore.overallScore);

    const selectedIds = new Set(selectedGaps.map(g => g.parameterId));
    const severeUnintendedRegressions = previousScoreSnapshot.parameters
      .map(beforeParam => {
        const afterParam = currentScore.parameters.find(p => p.id === beforeParam.id);
        if (!afterParam) return null;
        const isDiagnosticOnly = beforeParam.category === 'Advanced Diagnostics';
        const droppedSharply =
          !isDiagnosticOnly &&
          beforeParam.percentage >= 80 &&
          afterParam.percentage <= beforeParam.percentage - 15 &&
          !selectedIds.has(beforeParam.id);
        return droppedSharply ? { id: beforeParam.id, name: beforeParam.name } : null;
      })
      .filter(Boolean) as Array<{ id: number; name: string }>;

    // A pass that lowers the overall score is never kept.
    if (severeUnintendedRegressions.length > 0 || currentScore.overallScore < previousOverall) {
      currentResume = previousResumeSnapshot;
      currentScore = previousScoreSnapshot;
      currentGaps = classifyGaps(currentScore.parameters, currentScore.overallScore);
      onProgress?.(
        `Stopped pass ${loop + 1}: prevented regression${severeUnintendedRegressions.length ? ` in ${severeUnintendedRegressions.map(r => `#${r.id}`).join(', ')}` : ''}.`,
        Math.min(88, progressBase + 8)
      );
      break;
    }

    allChanges.push(...optimizationResult.changes);

    iterations.push({
      iteration: loop + 1,
      score: currentScore,
      gapClassification: currentGaps,
      changes: optimizationResult.changes,
    });

    if (currentScore.overallScore - previousOverall < MIN_LOOP_GAIN) {
      break;
    }
  }

  onProgress?.('Calculating final results...', 90);

  const parameterDeltas = buildParameterDeltas(beforeScore.parameters, currentScore.parameters);
  const categoryDeltas = buildCategoryDeltas(beforeScore, currentScore);

  onProgress?.('Optimization complete!', 100);

  return {
    beforeScore,
    afterScore: currentScore,
    gapClassification: currentGaps,
    optimizedResume: currentResume,
    iterations,
    totalChanges: allChanges,
    parameterDeltas,
    categoryDeltas,
    reachedTarget: currentScore.overallScore >= targetScore,
    targetScore,
    targetGuidance: buildTargetGuidance(currentResume, jobDescription, currentScore, currentGaps, targetScore, optimizationTier),
    processingTimeMs: Date.now() - startTime,
    evidenceViolations,
    scoringVersion: beforeCanonical.scoringVersion,
    beforeScoreId: beforeCanonical.scoreId,
    afterScoreId: latestAfterCanonical.scoreId,
    beforeInputHash: beforeCanonical.inputHash,
    afterInputHash: latestAfterCanonical.inputHash,
  };
}

function buildParameterDeltas(
  before: ParameterScore[],
  after: ParameterScore[]
): ParameterDelta[] {
  return before.map(bp => {
    const ap = after.find(a => a.id === bp.id);
    if (!ap) return null;
    return {
      id: bp.id,
      name: bp.name,
      category: bp.category,
      beforeScore: bp.score,
      afterScore: ap.score,
      beforePercentage: bp.percentage,
      afterPercentage: ap.percentage,
      delta: ap.percentage - bp.percentage,
      improved: ap.percentage > bp.percentage,
      fixable: bp.fixable,
    };
  }).filter(Boolean) as ParameterDelta[];
}

function buildCategoryDeltas(
  before: JDScoringResult,
  after: JDScoringResult
): CategoryDelta[] {
  return before.categories.map(bc => {
    const ac = after.categories.find(a => a.name === bc.name);
    if (!ac) return null;
    return {
      name: bc.name,
      beforePercentage: bc.percentage,
      afterPercentage: ac.percentage,
      delta: ac.percentage - bc.percentage,
      weight: bc.weight,
    };
  }).filter(Boolean) as CategoryDelta[];
}
