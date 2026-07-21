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

type FunctionErrorWithContext = Error & {
  context?: Response;
};

async function readFunctionError(error: unknown): Promise<{ message: string; status?: number }> {
  const functionError = error as FunctionErrorWithContext | undefined;
  const response = functionError?.context;

  if (response && typeof response.clone === 'function') {
    const status = response.status;
    try {
      const payload = await response.clone().json() as { error?: unknown; message?: unknown };
      const serverMessage = typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : '';
      if (serverMessage.trim()) return { message: serverMessage.trim(), status };
    } catch {
      try {
        const responseText = await response.clone().text();
        if (responseText.trim()) return { message: responseText.trim(), status };
      } catch {
        // Fall through to the normalized client error below.
      }
    }
    return { message: functionError?.message || 'The scoring service rejected the request.', status };
  }

  return {
    message: functionError?.message || 'The scoring service could not be reached.',
  };
}

function userFacingScoringError(detail: { message: string; status?: number }): string {
  if (detail.status === 401) {
    return 'Your session expired while scoring the resume. Please sign in again and retry.';
  }
  if (detail.status === 429) {
    return 'The JD scoring service is busy. Please wait a moment and retry.';
  }
  if (detail.status && detail.status >= 500) {
    return `The JD scoring service is temporarily unavailable. ${detail.message}`;
  }
  return detail.message;
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

    const requestBody = {
        resumeData: input.resumeData,
        jobDescription: input.jobDescription,
        candidateType: input.candidateType,
        scoringVersion: CANONICAL_JD_SCORING_VERSION,
        context: input.context,
        runId: input.runId,
    };

    const invokeScoringFunction = () => supabase.functions.invoke('canonical-jd-score', {
      body: requestBody,
    });

    let { data, error } = await invokeScoringFunction();

    if (error) {
      const firstFailure = await readFunctionError(error);

      // A stale browser session is the most common recoverable gateway failure.
      // Refresh it once, then repeat the idempotent canonical scoring request.
      if (firstFailure.status === 401) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          ({ data, error } = await invokeScoringFunction());
        }
      } else if ([502, 503, 504].includes(firstFailure.status || 0)) {
        ({ data, error } = await invokeScoringFunction());
      }
    }

    if (error) {
      const detail = await readFunctionError(error);
      console.error('Canonical JD scoring request failed', {
        status: detail.status,
        message: detail.message,
        context: input.context,
      });
      throw new Error(userFacingScoringError(detail));
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
