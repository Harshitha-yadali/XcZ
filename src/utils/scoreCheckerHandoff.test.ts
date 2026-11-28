import { describe, expect, it, beforeEach } from 'vitest';
import {
  parseScoreCheckerHandoff,
  saveScoreCheckerHandoff,
  loadScoreCheckerHandoff,
  clearScoreCheckerHandoff,
  type ScoreCheckerHandoff,
} from './scoreCheckerHandoff';

const handoff: ScoreCheckerHandoff = {
  parsedResume: {
    name: 'A', phone: '', email: 'a@x.in', linkedin: '', github: '',
    education: [], workExperience: [], projects: [], skills: [],
  } as any,
  resumeText: 'A resume',
  filename: 'cv.pdf',
  candidateType: 'experienced',
  jobDescription: 'A job description long enough',
  jobTitle: 'Engineer',
  score: 55,
};

describe('scoreCheckerHandoff', () => {
  beforeEach(() => clearScoreCheckerHandoff());

  it('round-trips through sessionStorage with the scorer input unchanged', () => {
    saveScoreCheckerHandoff(handoff);
    const loaded = loadScoreCheckerHandoff();
    expect(loaded).toEqual(handoff);
    // The scorer request body is JSON, so a JSON-identical resume gives the same hash.
    expect(JSON.stringify(loaded!.parsedResume)).toBe(JSON.stringify(handoff.parsedResume));
  });

  it('accepts navigation-state objects as-is', () => {
    expect(parseScoreCheckerHandoff(handoff)).toEqual(handoff);
  });

  it('rejects missing or malformed data', () => {
    expect(parseScoreCheckerHandoff(null)).toBeNull();
    expect(parseScoreCheckerHandoff('not json')).toBeNull();
    expect(parseScoreCheckerHandoff({ ...handoff, candidateType: 'senior' })).toBeNull();
    expect(parseScoreCheckerHandoff({ ...handoff, score: NaN })).toBeNull();
    expect(parseScoreCheckerHandoff({ ...handoff, parsedResume: null })).toBeNull();
    expect(parseScoreCheckerHandoff({ ...handoff, jobDescription: ' ' })).toBeNull();
  });

  it('clear removes it', () => {
    saveScoreCheckerHandoff(handoff);
    clearScoreCheckerHandoff();
    expect(loadScoreCheckerHandoff()).toBeNull();
  });
});
