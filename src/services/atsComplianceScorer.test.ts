import { describe, it, expect } from 'vitest';
import { ATSComplianceScorer } from './atsComplianceScorer';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCompliance({
  sectionOrderValid = true,
  sectionViolations = 0,
  actualOrderLength = 6,
  wordCountValid = true,
  wordCountViolations = 0,
} = {}) {
  return {
    sectionOrder: {
      isValid: sectionOrderValid,
      violations: Array(sectionViolations).fill('violation'),
      actualOrder: Array(actualOrderLength).fill('section'),
    },
    wordCount: {
      isValid: wordCountValid,
      violations: Array(wordCountViolations).fill('violation'),
    },
  } as any;
}

function makeResumeData({
  name = 'John Doe',
  email = 'john@example.com',
  phone = '1234567890',
  skills = ['TypeScript'],
  education = [{ degree: 'BS CS' }],
} = {}) {
  return { name, email, phone, skills, education };
}

// ── calculateATSFormatting ────────────────────────────────────────────────────

describe('ATSComplianceScorer.calculateATSFormatting', () => {
  it('returns 100 for a perfect resume', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData(),
      makeCompliance()
    );
    expect(score).toBe(100);
  });

  it('deducts 15 per section order violation', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData(),
      makeCompliance({ sectionOrderValid: false, sectionViolations: 2 })
    );
    expect(score).toBe(70); // 100 - 2*15 = 70
  });

  it('deducts up to 20 for word count violations', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData(),
      makeCompliance({ wordCountValid: false, wordCountViolations: 5 })
    );
    expect(score).toBe(80); // 100 - min(20, 5*5=25) = 80
  });

  it('deducts 10 when fewer than 5 sections present', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData(),
      makeCompliance({ actualOrderLength: 4 })
    );
    expect(score).toBe(90);
  });

  it('deducts 15 when contact info is incomplete', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData({ phone: '' }),
      makeCompliance()
    );
    expect(score).toBe(85);
  });

  it('deducts 20 when required sections (skills/education) are missing', () => {
    const resumeWithoutSections = { name: 'John', email: 'j@test.com', phone: '123' };
    const score = ATSComplianceScorer.calculateATSFormatting(resumeWithoutSections, makeCompliance());
    expect(score).toBe(80);
  });

  it('clamps score to 0 with heavy penalties', () => {
    const score = ATSComplianceScorer.calculateATSFormatting(
      makeResumeData({ phone: '', skills: undefined as any, education: undefined as any }),
      makeCompliance({
        sectionOrderValid: false,
        sectionViolations: 10,
        wordCountValid: false,
        wordCountViolations: 5,
        actualOrderLength: 2,
      })
    );
    expect(score).toBe(0);
  });
});

// ── calculateTechnicalImpact ──────────────────────────────────────────────────

describe('ATSComplianceScorer.calculateTechnicalImpact', () => {
  const jdAnalysis = {} as any;

  it('returns 0 for a resume with no measurable bullets', () => {
    const bulletPattern = {
      metricsPercentage: 0,
      bulletsWithActionVerbs: 0,
      bulletsAnalyzed: 10,
      bulletsWithTechSkills: 0,
    };
    expect(ATSComplianceScorer.calculateTechnicalImpact({}, bulletPattern, jdAnalysis)).toBe(0);
  });

  it('returns 100 for a perfect bullet pattern', () => {
    const bulletPattern = {
      metricsPercentage: 100,
      bulletsWithActionVerbs: 10,
      bulletsAnalyzed: 10,
      bulletsWithTechSkills: 10,
    };
    expect(ATSComplianceScorer.calculateTechnicalImpact({}, bulletPattern, jdAnalysis)).toBe(100);
  });

  it('scores partial results correctly', () => {
    const bulletPattern = {
      metricsPercentage: 50,     // contributes min(40, 50*0.4) = 20
      bulletsWithActionVerbs: 5,
      bulletsAnalyzed: 10,       // 50% action verbs → min(30, 50*0.3) = 15
      bulletsWithTechSkills: 5,  // 50% tech → min(30, 50*0.3) = 15
    };
    const score = ATSComplianceScorer.calculateTechnicalImpact({}, bulletPattern, jdAnalysis);
    expect(score).toBe(50);
  });
});

// ── calculateKeywordOptimization ──────────────────────────────────────────────

describe('ATSComplianceScorer.calculateKeywordOptimization', () => {
  it('returns 50 when no keywords provided', () => {
    const score = ATSComplianceScorer.calculateKeywordOptimization({}, {} as any, []);
    expect(score).toBe(50);
  });

  it('returns higher score when all keywords are optimal', () => {
    const resumeData = { skills: 'python react typescript' };
    const jdAnalysis = { topTechnicalSkills: ['python'], allKeywords: [] } as any;
    const keywordFrequencies = [
      { isOptimal: true, frequency: 2, targetMin: 1, targetMax: 3 },
      { isOptimal: true, frequency: 2, targetMin: 1, targetMax: 3 },
    ];
    const score = ATSComplianceScorer.calculateKeywordOptimization(resumeData, jdAnalysis, keywordFrequencies);
    expect(score).toBeGreaterThan(50);
  });

  it('penalises overused keywords', () => {
    const resumeData = { text: 'python python python python python python' };
    const jdAnalysis = { topTechnicalSkills: [], allKeywords: [] } as any;
    const keywordFrequencies = Array(10).fill(null).map(() => ({
      isOptimal: false,
      frequency: 10,
      targetMin: 1,
      targetMax: 3,
    }));
    const baseScore = ATSComplianceScorer.calculateKeywordOptimization(resumeData, jdAnalysis, keywordFrequencies);
    const optimalScore = ATSComplianceScorer.calculateKeywordOptimization(resumeData, jdAnalysis,
      Array(10).fill(null).map(() => ({ isOptimal: true, frequency: 2, targetMin: 1, targetMax: 3 }))
    );
    expect(optimalScore).toBeGreaterThan(baseScore);
  });
});
