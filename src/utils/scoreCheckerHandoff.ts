// Carries what the Score Checker scored over to the JD Optimizer, so the
// optimizer's "before" score is computed on the exact same input
// (resume data + JD + candidate type) and therefore equals the checker's score.
import type { ResumeData, UserType } from '../types/resume';

export interface ScoreCheckerHandoff {
  parsedResume: ResumeData;
  resumeText: string;
  filename: string | null;
  candidateType: UserType;
  jobDescription: string;
  jobTitle: string;
  score: number;
}

export const SCORE_CHECKER_HANDOFF_KEY = 'primo:score-checker-handoff';

const CANDIDATE_TYPES: UserType[] = ['fresher', 'experienced', 'student'];

export function parseScoreCheckerHandoff(value: unknown): ScoreCheckerHandoff | null {
  let data = value;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const h = data as Partial<ScoreCheckerHandoff>;
  if (
    !h.parsedResume || typeof h.parsedResume !== 'object' ||
    typeof h.resumeText !== 'string' || !h.resumeText.trim() ||
    !CANDIDATE_TYPES.includes(h.candidateType as UserType) ||
    typeof h.jobDescription !== 'string' || !h.jobDescription.trim() ||
    typeof h.score !== 'number' || !Number.isFinite(h.score)
  ) {
    return null;
  }
  return {
    parsedResume: h.parsedResume as ResumeData,
    resumeText: h.resumeText,
    filename: typeof h.filename === 'string' ? h.filename : null,
    candidateType: h.candidateType as UserType,
    jobDescription: h.jobDescription,
    jobTitle: typeof h.jobTitle === 'string' ? h.jobTitle : '',
    score: h.score,
  };
}

export function saveScoreCheckerHandoff(handoff: ScoreCheckerHandoff): void {
  try {
    sessionStorage.setItem(SCORE_CHECKER_HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // Storage full or blocked: navigation state still carries the handoff.
  }
}

export function loadScoreCheckerHandoff(): ScoreCheckerHandoff | null {
  try {
    return parseScoreCheckerHandoff(sessionStorage.getItem(SCORE_CHECKER_HANDOFF_KEY));
  } catch {
    return null;
  }
}

export function clearScoreCheckerHandoff(): void {
  try {
    sessionStorage.removeItem(SCORE_CHECKER_HANDOFF_KEY);
  } catch {
    // ignore
  }
}
