import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeData } from '../types/resume';
import type { JDScoringResult, ParameterScore } from './jdScoringEngine';

const { optimizeByParameterMock, canonicalScoreMock } = vi.hoisted(() => ({
  optimizeByParameterMock: vi.fn(),
  canonicalScoreMock: vi.fn(),
}));

vi.mock('./targetedParameterOptimizer', () => ({ optimizeByParameter: optimizeByParameterMock }));
vi.mock('./canonicalJdScoringService', () => ({ CanonicalJdScoringService: { score: canonicalScoreMock } }));

import { rankGapsByWeightedPoints, remainingWeightedPoints, runOptimizationLoop } from './optimizationLoopController';

const param = (id: number, weightedMaxPoints: number, percentage: number, name = `P${id}`): ParameterScore => ({
  id, name, category: 'Content Quality', score: percentage, maxScore: 100, percentage,
  suggestions: [], fixable: true, fixType: 'ai', applicable: true,
  weightedMaxPoints, earnedPoints: weightedMaxPoints * (percentage / 100),
});

/** A score whose one fixable gap stays open until the overall reaches 100. */
const scoreOf = (overallScore: number): JDScoringResult => ({
  overallScore,
  candidateType: 'fresher',
  scoringProfile: 'test',
  categories: [],
  parameters: [param(12, 50, 40), param(4, 50, 100)],
  matchBand: 'band',
  interviewProbability: 'p',
  fixableCount: 1,
  nonFixableCount: 0,
});

const resume: ResumeData = {
  name: 'Test Candidate', phone: '', email: 'test@example.com', linkedin: '', github: '',
  summary: 'Developer.', education: [], workExperience: [],
  projects: [{ title: 'Portal', bullets: ['Built a portal for students using Django.'], techStack: ['Django'] }],
  skills: [{ category: 'Technical Skills', count: 1, list: ['Django'] }],
  certifications: [],
};
const jd = 'Junior Backend Developer. Required skills: Python, Django, Docker.';

/** Before score, then one score per loop. The resume passed in equals the baseline, so no initial after-score. */
function queueScores(scores: number[]) {
  let call = 0;
  canonicalScoreMock.mockImplementation(async () => {
    const overall = scores[Math.min(call, scores.length - 1)];
    call += 1;
    return { scoreResult: scoreOf(overall), scoreId: `s${call}`, inputHash: `h${call}`, scoringVersion: 'test', cacheHit: false };
  });
}

describe('refinement loop runs to the tier target', () => {
  beforeEach(() => {
    canonicalScoreMock.mockReset();
    optimizeByParameterMock.mockReset();
    let pass = 0;
    optimizeByParameterMock.mockImplementation(async (input: ResumeData) => {
      pass += 1;
      const next = JSON.parse(JSON.stringify(input)) as ResumeData;
      next.summary = `Developer pass ${pass}.`;
      return { optimizedResume: next, changes: [{ parameterId: 12, section: 'summary', before: '', after: next.summary, description: 'x' }], parametersFixed: [12] };
    });
  });

  it('stops as soon as the score reaches the target', async () => {
    queueScores([60, 72, 81, 88]);
    const result = await runOptimizationLoop(resume, jd, undefined, resume, { maxLoops: 3, optimizationTier: 'smart' });
    expect(result.targetScore).toBe(80);
    expect(optimizeByParameterMock).toHaveBeenCalledTimes(2);
    expect(result.afterScore.overallScore).toBe(81);
    expect(result.reachedTarget).toBe(true);
    expect(result.targetGuidance).toBeNull();
  });

  it('keeps going up to maxLoops while each loop gains, and reports the miss honestly', async () => {
    queueScores([60, 63, 66, 69, 72]);
    const result = await runOptimizationLoop(resume, jd, undefined, resume, { maxLoops: 3, optimizationTier: 'deep' });
    expect(optimizeByParameterMock).toHaveBeenCalledTimes(3);
    expect(result.afterScore.overallScore).toBe(69);
    expect(result.reachedTarget).toBe(false);
    expect(result.targetGuidance?.message).toMatch(/^Reached 69\. To reach 90/);
  });

  it('stops when a loop gains less than one point', async () => {
    queueScores([60, 65, 65, 70]);
    const result = await runOptimizationLoop(resume, jd, undefined, resume, { maxLoops: 6, optimizationTier: 'deep' });
    expect(optimizeByParameterMock).toHaveBeenCalledTimes(2);
    expect(result.afterScore.overallScore).toBe(65);
  });

  it('rolls back a loop that lowers the score', async () => {
    queueScores([60, 55]);
    const result = await runOptimizationLoop(resume, jd, undefined, resume, { maxLoops: 3, optimizationTier: 'smart' });
    expect(result.afterScore.overallScore).toBe(60);
    expect(result.optimizedResume.summary).toBe(resume.summary);
    expect(result.iterations).toHaveLength(0);
  });

  it('computes the Quick target from the before score', async () => {
    queueScores([50, 71]);
    const result = await runOptimizationLoop(resume, jd, undefined, resume, { maxLoops: 1, optimizationTier: 'quick' });
    expect(result.targetScore).toBe(70);
    expect(result.reachedTarget).toBe(true);
  });

  it('passes the tier model, fallback and rewrite sections to each pass', async () => {
    queueScores([60, 61]);
    await runOptimizationLoop(resume, jd, undefined, resume, {
      maxLoops: 1, optimizationTier: 'smart', modelSequence: ['tier-model'], fallbackModel: 'cheap-model', refinementSections: ['summary', 'bullets'],
    });
    expect(optimizeByParameterMock.mock.calls[0][3]).toEqual({ model: 'tier-model', fallbackModel: 'cheap-model', sections: ['summary', 'bullets'] });
  });
});

describe('gap ranking by weighted points', () => {
  it('orders gaps by the overall points they can still add', () => {
    const parameters = [param(1, 10, 0), param(2, 40, 50), param(3, 30, 90), param(4, 20, 20)];
    // Remaining: P1 10, P2 20, P3 3, P4 16 of 100 applicable points.
    expect(remainingWeightedPoints(parameters[1], parameters)).toBeCloseTo(20);
    const ranked = rankGapsByWeightedPoints(parameters, [1, 2, 3, 4].map(parameterId => ({ parameterId })));
    expect(ranked.map(g => g.parameterId)).toEqual([2, 4, 1, 3]);
    expect(rankGapsByWeightedPoints(parameters, [1, 2, 3, 4].map(parameterId => ({ parameterId })), 2)).toHaveLength(2);
  });
});
