import { supabase } from '../lib/supabaseClient';
import type { ResumeData, UserType } from '../types/resume';
import type { JDScoringResult } from './jdScoringEngine';

export const CANONICAL_JD_SCORING_VERSION = 'pb-jd-v2.0.0';

export type CanonicalScoreContext =
  | 'quick_scan'
  | 'smart_before'
  | 'smart_after'
  | 'deep_before'
  | 'deep_after'
  | 'resume_score_checker';

export interface CanonicalJdScoreResponse {
  scoreResult: JDScoringResult;
  scoreId: string;
  inputHash: string;
  scoringVersion: string;
  cacheHit: boolean;
}

function isValidScoreResult(value: unknown): value is JDScoringResult {
  const result = value as JDScoringResult | undefined;
  return Boolean(
    result &&
    Number.isInteger(result.overallScore) &&
    result.overallScore >= 0 &&
    result.overallScore <= 100 &&
    Array.isArray(result.parameters) &&
    result.parameters.every(parameter =>
      Number.isFinite(parameter.score) &&
      Number.isFinite(parameter.maxScore) &&
      (parameter.score <= 0 || (Array.isArray(parameter.evidence) && parameter.evidence.length > 0))
    ) &&
    Array.isArray(result.categories),
  );
}

export class CanonicalJdScoringService {
  static async score(input: {
    resumeData: ResumeData;
    jobDescription: string;
    candidateType: UserType;
    context: CanonicalScoreContext;
    runId?: string;
  }): Promise<CanonicalJdScoreResponse> {
    if (!input.jobDescription.trim()) {
      throw new Error('A job description is required for canonical JD scoring.');
    }

    const { data, error } = await supabase.functions.invoke('canonical-jd-score', {
      body: {
        resumeData: input.resumeData,
        jobDescription: input.jobDescription,
        candidateType: input.candidateType,
        scoringVersion: CANONICAL_JD_SCORING_VERSION,
        context: input.context,
        runId: input.runId,
      },
    });

    if (error) {
      throw new Error(`Canonical JD scoring failed: ${error.message}`);
    }
    if (!data || !isValidScoreResult(data.scoreResult)) {
      throw new Error('Canonical JD scoring returned an invalid result.');
    }
    if (data.scoringVersion !== CANONICAL_JD_SCORING_VERSION) {
      throw new Error('Canonical JD scoring version mismatch.');
    }

    return data as CanonicalJdScoreResponse;
  }
}
