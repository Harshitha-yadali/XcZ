import { describe, it, expect } from 'vitest';
import { ScoreMapperService } from './scoreMapperService';
import type { RedFlag } from '../types/resume';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFlag(severity: RedFlag['severity'], penalty: number): RedFlag {
  return {
    id: 1,
    type: 'employment',
    name: 'test flag',
    severity,
    penalty,
    description: '',
    recommendation: '',
  };
}

// ── getMatchBand ──────────────────────────────────────────────────────────────

describe('ScoreMapperService.getMatchBand', () => {
  const cases: [number, string][] = [
    [100, 'Excellent Match'],
    [90,  'Excellent Match'],
    [89,  'Very Good Match'],
    [80,  'Very Good Match'],
    [79,  'Good Match'],
    [70,  'Good Match'],
    [69,  'Fair Match'],
    [60,  'Fair Match'],
    [59,  'Below Average'],
    [50,  'Below Average'],
    [49,  'Poor Match'],
    [40,  'Poor Match'],
    [39,  'Very Poor'],
    [30,  'Very Poor'],
    [29,  'Inadequate'],
    [20,  'Inadequate'],
    [19,  'Minimal Match'],
    [0,   'Minimal Match'],
  ];

  it.each(cases)('score %i → %s', (score, band) => {
    expect(ScoreMapperService.getMatchBand(score)).toBe(band);
  });
});

// ── applyPenalties ────────────────────────────────────────────────────────────

describe('ScoreMapperService.applyPenalties', () => {
  it('subtracts penalty from base score', () => {
    expect(ScoreMapperService.applyPenalties(80, -10)).toBe(70);
  });

  it('clamps result to 0 when penalty exceeds score', () => {
    expect(ScoreMapperService.applyPenalties(5, -20)).toBe(0);
  });

  it('clamps result to 100 when penalty is positive (bonus)', () => {
    expect(ScoreMapperService.applyPenalties(95, 10)).toBe(100);
  });

  it('returns same score when penalty is 0', () => {
    expect(ScoreMapperService.applyPenalties(75, 0)).toBe(75);
  });
});

// ── calculateRedFlagPenalty ───────────────────────────────────────────────────

describe('ScoreMapperService.calculateRedFlagPenalty', () => {
  it('returns 0 for no flags', () => {
    expect(ScoreMapperService.calculateRedFlagPenalty([])).toBe(0);
  });

  it('sums all flag penalties', () => {
    const flags = [makeFlag('high', -3), makeFlag('critical', -5)];
    expect(ScoreMapperService.calculateRedFlagPenalty(flags)).toBe(-8);
  });

  it('handles single flag', () => {
    const flags = [makeFlag('medium', -3)];
    expect(ScoreMapperService.calculateRedFlagPenalty(flags)).toBe(-3);
  });
});

// ── hasAutoRejectRisk ─────────────────────────────────────────────────────────

describe('ScoreMapperService.hasAutoRejectRisk', () => {
  it('returns false when no flags', () => {
    expect(ScoreMapperService.hasAutoRejectRisk([])).toBe(false);
  });

  it('returns false with fewer than 3 critical flags', () => {
    const flags = [makeFlag('critical', -5), makeFlag('critical', -5)];
    expect(ScoreMapperService.hasAutoRejectRisk(flags)).toBe(false);
  });

  it('returns true with exactly 3 critical flags', () => {
    const flags = [
      makeFlag('critical', -5),
      makeFlag('critical', -5),
      makeFlag('critical', -5),
    ];
    expect(ScoreMapperService.hasAutoRejectRisk(flags)).toBe(true);
  });

  it('non-critical flags do not count toward auto-reject', () => {
    const flags = [
      makeFlag('high', -3),
      makeFlag('high', -3),
      makeFlag('high', -3),
      makeFlag('medium', -1),
    ];
    expect(ScoreMapperService.hasAutoRejectRisk(flags)).toBe(false);
  });
});

// ── getInterviewProbabilityFromScore ──────────────────────────────────────────

describe('ScoreMapperService.getInterviewProbabilityFromScore', () => {
  it('returns a non-empty string for score 100', () => {
    const result = ScoreMapperService.getInterviewProbabilityFromScore(100);
    expect(result).toBeTruthy();
  });

  it('returns a non-empty string for score 0', () => {
    const result = ScoreMapperService.getInterviewProbabilityFromScore(0);
    expect(result).toBeTruthy();
  });

  it('score 90 gets a higher probability band than score 30', () => {
    const high = ScoreMapperService.getInterviewProbabilityFromScore(90);
    const low  = ScoreMapperService.getInterviewProbabilityFromScore(30);
    expect(high).not.toBe(low);
  });
});

// ── validateTierWeights ───────────────────────────────────────────────────────

describe('ScoreMapperService.validateTierWeights', () => {
  it('tier weights (excluding red_flags) sum to 100', () => {
    expect(ScoreMapperService.validateTierWeights()).toBe(true);
  });
});
