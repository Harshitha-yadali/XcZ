import { ResumeData, type UserType } from '../types/resume';
import type { JDScoringResult, ParameterScore } from './jdScoringEngine';
import { classifyGaps, GapClassification } from './gapClassificationEngine';
import { optimizeByParameter, OptimizationChange } from './targetedParameterOptimizer';
import { validateAndRepairResume, type EvidenceViolation } from './resumeEvidenceValidator';
import {
  CanonicalJdScoringService,
  type CanonicalScoreContext,
} from './canonicalJdScoringService';
import type { JdOptimizationTierId } from '../config/jdOptimizationTiers';

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

export interface OptimizationLoopOptions {
  maxLoops?: number;
  modelSequence?: string[];
  candidateType?: UserType;
  optimizationTier?: JdOptimizationTierId;
  runId?: string;
}

const MAX_LOOPS = 6;
const TARGET_SCORE = 90;

function prioritizeFixableGaps(
  parameters: ParameterScore[],
  gaps: GapClassification['fixableGaps'],
  batchSize: number = 8
): GapClassification['fixableGaps'] {
  const priorityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  const byId = new Map(parameters.map(p => [p.id, p]));
  const prioritized = [...gaps].sort((a, b) => {
    const priorityDelta = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDelta !== 0) return priorityDelta;

    if (a.percentage !== b.percentage) return a.percentage - b.percentage;

    const aParam = byId.get(a.parameterId);
    const bParam = byId.get(b.parameterId);
    const aGain = aParam ? (aParam.maxScore - aParam.score) : (a.maxScore - a.currentScore);
    const bGain = bParam ? (bParam.maxScore - bParam.score) : (b.maxScore - b.currentScore);
    return bGain - aGain;
  });

  return prioritized.slice(0, batchSize);
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

  for (let loop = 0; loop < maxLoops; loop++) {
    if (currentGaps.fixableGaps.length === 0) break;

    const progressBase = Math.min(80, 20 + loop * Math.max(8, Math.floor(50 / Math.max(1, maxLoops))));
    const selectedGaps = prioritizeFixableGaps(currentScore.parameters, currentGaps.fixableGaps);
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
      { model: modelSequence[loop] || modelSequence[modelSequence.length - 1] },
    );

    if (optimizationResult.changes.length === 0) {
      optimizationResult = await optimizeByParameter(
        currentResume,
        jobDescription,
        currentGaps.fixableGaps,
        { model: modelSequence[loop] || modelSequence[modelSequence.length - 1] },
      );
      if (optimizationResult.changes.length === 0) {
        break;
      }
    }

    const evidenceValidation = validateAndRepairResume(baseline, optimizationResult.optimizedResume);
    currentResume = evidenceValidation.resume;
    evidenceViolations.push(...evidenceValidation.violations);

    onProgress?.(`Re-scoring after pass ${loop + 1}...`, Math.min(88, progressBase + 8));
    const previousOverall = currentScore.overallScore;
    const previousFixableCount = currentGaps.fixableGaps.length;
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

    if (severeUnintendedRegressions.length > 0) {
      currentResume = previousResumeSnapshot;
      currentScore = previousScoreSnapshot;
      currentGaps = classifyGaps(currentScore.parameters, currentScore.overallScore);
      onProgress?.(
        `Stopped pass ${loop + 1}: prevented regression in ${severeUnintendedRegressions.map(r => `#${r.id}`).join(', ')}.`,
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

    const overallImproved = currentScore.overallScore > previousOverall;
    const fixableReduced = currentGaps.fixableGaps.length < previousFixableCount;
    if (!overallImproved && !fixableReduced) {
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
    reachedTarget: currentScore.overallScore >= TARGET_SCORE && currentGaps.fixableGaps.length === 0,
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
