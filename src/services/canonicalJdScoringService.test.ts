import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeData } from '../types/resume';

const { invokeMock, refreshSessionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  refreshSessionMock: vi.fn(),
}));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: invokeMock },
    auth: { refreshSession: refreshSessionMock },
  },
}));

import { CANONICAL_JD_SCORING_VERSION, CanonicalJdScoringService } from './canonicalJdScoringService';
import { scoreResumeAgainstJD } from './jdScoringEngine';

const resume: ResumeData = {
  name: 'Candidate', phone: '9000000000', email: 'candidate@example.com', linkedin: '', github: '',
  education: [], workExperience: [], projects: [],
  skills: [{ category: 'Languages', count: 1, list: ['Python'] }], certifications: [],
};
const jd = 'Hiring a Python backend engineer to build reliable services and APIs.';

describe('CanonicalJdScoringService', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    refreshSessionMock.mockReset();
  });

  it('sends version, candidate type, and context to the backend source of truth', async () => {
    const scoreResult = scoreResumeAgainstJD(resume, jd, 'fresher');
    invokeMock.mockResolvedValue({
      data: {
        scoreResult,
        scoreId: 'score-id',
        inputHash: 'input-hash',
        scoringVersion: CANONICAL_JD_SCORING_VERSION,
        cacheHit: true,
      },
      error: null,
    });

    const result = await CanonicalJdScoringService.score({
      resumeData: resume,
      jobDescription: jd,
      candidateType: 'fresher',
      context: 'quick_scan',
    });

    expect(result.scoreResult.overallScore).toBe(scoreResult.overallScore);
    expect(result.scoreResult.candidateType).toBe('fresher');
    expect(invokeMock).toHaveBeenCalledWith('canonical-jd-score', {
      body: expect.objectContaining({
        candidateType: 'fresher',
        context: 'quick_scan',
        scoringVersion: CANONICAL_JD_SCORING_VERSION,
      }),
    });
  });

  it('rejects a backend response from a different scoring version', async () => {
    invokeMock.mockResolvedValue({
      data: {
        scoreResult: scoreResumeAgainstJD(resume, jd),
        scoreId: 'score-id',
        inputHash: 'input-hash',
        scoringVersion: 'old-version',
        cacheHit: false,
      },
      error: null,
    });

    await expect(CanonicalJdScoringService.score({
      resumeData: resume,
      jobDescription: jd,
      candidateType: 'fresher',
      context: 'smart_before',
    })).rejects.toThrow('version mismatch');
  });

  it('surfaces the Edge Function JSON error instead of the generic non-2xx message', async () => {
    const response = new Response(JSON.stringify({ error: 'Scoring history could not be saved.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    invokeMock.mockResolvedValue({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), { context: response }),
    });

    await expect(CanonicalJdScoringService.score({
      resumeData: resume,
      jobDescription: jd,
      candidateType: 'fresher',
      context: 'smart_before',
    })).rejects.toThrow('Scoring history could not be saved.');
  });

  it('refreshes an expired session and retries the scoring request once', async () => {
    const scoreResult = scoreResumeAgainstJD(resume, jd, 'fresher');
    invokeMock
      .mockResolvedValueOnce({
        data: null,
        error: Object.assign(new Error('Unauthorized'), {
          context: new Response(JSON.stringify({ error: 'Invalid user token' }), { status: 401 }),
        }),
      })
      .mockResolvedValueOnce({
        data: {
          scoreResult,
          scoreId: 'score-id',
          inputHash: 'input-hash',
          scoringVersion: CANONICAL_JD_SCORING_VERSION,
          cacheHit: false,
        },
        error: null,
      });
    refreshSessionMock.mockResolvedValue({ error: null });

    const result = await CanonicalJdScoringService.score({
      resumeData: resume,
      jobDescription: jd,
      candidateType: 'fresher',
      context: 'smart_before',
    });

    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(result.scoreId).toBe('score-id');
  });
});
