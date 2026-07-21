import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { scoreResumeAgainstJD } from './jdScoringEngine';

const backendJd = `
  We are hiring a Backend Software Engineer with 3+ years of experience.
  Required skills include Python, PostgreSQL, Docker, AWS, REST APIs, testing,
  system design, communication, and collaboration.
`;

const alignedResume: ResumeData = {
  name: 'Candidate',
  phone: '9000000000',
  email: 'candidate@example.com',
  linkedin: 'https://linkedin.com/in/candidate',
  github: 'https://github.com/candidate',
  targetRole: 'Backend Software Engineer',
  summary: 'Backend engineer with four years of experience building reliable Python services.',
  education: [{ degree: 'B.Tech Computer Science', school: 'Example University', year: '2020' }],
  workExperience: [{
    role: 'Backend Software Engineer',
    company: 'Example Systems',
    year: '2020-2024',
    bullets: [
      'Developed Python REST APIs backed by PostgreSQL for customer workflows.',
      'Reduced API latency by 35% through query optimization and caching.',
      'Deployed Docker services on AWS and collaborated with testing teams.',
    ],
  }],
  projects: [{
    title: 'Order Processing Platform',
    bullets: ['Built a tested Python service processing 10,000 orders per day.'],
    techStack: ['Python', 'PostgreSQL', 'Docker', 'AWS'],
    githubUrl: 'https://github.com/candidate/orders',
  }],
  skills: [{
    category: 'Backend',
    count: 5,
    list: ['Python', 'PostgreSQL', 'Docker', 'AWS', 'REST APIs'],
  }],
  certifications: ['AWS Certified Developer'],
};

describe('jdScoringEngine canonical regression suite', () => {
  it('is deterministic and attaches evidence to every awarded check', () => {
    const first = scoreResumeAgainstJD(alignedResume, backendJd, 'experienced');
    const second = scoreResumeAgainstJD(structuredClone(alignedResume), backendJd, 'experienced');

    expect(second).toEqual(first);
    expect(first.candidateType).toBe('experienced');
    expect(first.scoringProfile).toContain('Experienced');
    expect(first.parameters).toHaveLength(30);
    expect(
      first.parameters
        .filter(parameter => parameter.score > 0 && (parameter.evidence?.length || 0) === 0)
        .map(parameter => parameter.id),
    ).toEqual([]);
  });

  it('uses applicable-metric weighting that totals 100 and excludes fresher experience requirements', () => {
    const student = scoreResumeAgainstJD(alignedResume, backendJd, 'student');
    const fresher = scoreResumeAgainstJD(alignedResume, backendJd, 'fresher');
    const experienced = scoreResumeAgainstJD(alignedResume, backendJd, 'experienced');

    for (const result of [student, fresher, experienced]) {
      expect(result.categories.reduce((sum, category) => sum + category.weight, 0)).toBe(100);
      expect(result.categories).toHaveLength(7);
    }

    expect(student.parameters.find(parameter => parameter.id === 17)?.applicable).toBe(false);
    expect(fresher.parameters.find(parameter => parameter.id === 17)?.applicable).toBe(false);
    expect(experienced.parameters.find(parameter => parameter.id === 17)?.applicable).toBe(true);
    expect((fresher.parameters.find(parameter => parameter.id === 19)?.weightedMaxPoints || 0))
      .toBeGreaterThan(experienced.parameters.find(parameter => parameter.id === 19)?.weightedMaxPoints || 0);
  });

  it('ranks a genuinely aligned resume above an unrelated resume', () => {
    const unrelatedResume: ResumeData = {
      ...alignedResume,
      targetRole: 'Graphic Designer',
      summary: 'Graphic designer creating brand identities and print campaigns.',
      workExperience: [{
        role: 'Graphic Designer',
        company: 'Creative Studio',
        year: '2020-2024',
        bullets: ['Designed brand assets using Figma and Adobe Illustrator.'],
      }],
      projects: [],
      skills: [{ category: 'Design', count: 3, list: ['Figma', 'Illustrator', 'Branding'] }],
      certifications: [],
    };

    const aligned = scoreResumeAgainstJD(alignedResume, backendJd);
    const unrelated = scoreResumeAgainstJD(unrelatedResume, backendJd);

    expect(aligned.overallScore).toBeGreaterThan(unrelated.overallScore);
    expect(aligned.overallScore - unrelated.overallScore).toBeGreaterThanOrEqual(10);
  });

  it('does not reward keyword stuffing', () => {
    const baseline = scoreResumeAgainstJD(alignedResume, backendJd);
    const stuffed = scoreResumeAgainstJD({
      ...alignedResume,
      summary: `${alignedResume.summary} ${'Python PostgreSQL Docker AWS REST APIs '.repeat(25)}`,
    }, backendJd);

    expect(stuffed.overallScore).toBeLessThanOrEqual(baseline.overallScore);
  });

  it('penalizes missing mandatory skills more than missing preferred skills', () => {
    const tieredJd = `Job Title: Backend Software Engineer
Required: Python and PostgreSQL.
Preferred: Docker and AWS.
Responsibilities: Build REST APIs and test backend services.`;
    const complete = scoreResumeAgainstJD(alignedResume, tieredJd, 'experienced');
    const missingPreferred = scoreResumeAgainstJD({
      ...alignedResume,
      projects: alignedResume.projects.map(project => ({ ...project, techStack: ['Python', 'PostgreSQL'] })),
      skills: [{ category: 'Backend', count: 3, list: ['Python', 'PostgreSQL', 'REST APIs'] }],
    }, tieredJd, 'experienced');
    const missingMandatory = scoreResumeAgainstJD({
      ...alignedResume,
      projects: alignedResume.projects.map(project => ({ ...project, techStack: ['Docker', 'AWS'] })),
      skills: [{ category: 'Cloud', count: 2, list: ['Docker', 'AWS'] }],
    }, tieredJd, 'experienced');

    expect(complete.parameters.find(parameter => parameter.id === 8)?.percentage).toBe(100);
    expect(missingPreferred.parameters.find(parameter => parameter.id === 8)?.percentage).toBe(100);
    expect(missingMandatory.parameters.find(parameter => parameter.id === 8)?.percentage).toBe(0);
    expect(complete.overallScore - missingMandatory.overallScore)
      .toBeGreaterThan(complete.overallScore - missingPreferred.overallScore);
  });

  it('rejects multiple explicit job postings in one analysis', () => {
    expect(() => scoreResumeAgainstJD(
      alignedResume,
      'Job Title: Backend Engineer\nRequired: Python.\n---\nJob Title: Data Analyst\nRequired: SQL.',
    )).toThrow(/one job description/i);
  });
});
