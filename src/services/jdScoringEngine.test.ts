import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { scoreResumeAgainstJD } from './jdScoringEngine';
import { normalizeCanonicalResume } from './canonicalResumeNormalizer';

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

    // Two missing mandatory skills are blended with the other hard skills, never above them.
    const p8 = (result: typeof complete) => result.parameters.find(parameter => parameter.id === 8)?.percentage ?? -1;
    expect(p8(complete)).toBe(100);
    expect(p8(missingPreferred)).toBe(100);
    expect(p8(missingMandatory)).toBeGreaterThan(0);
    expect(p8(missingMandatory)).toBeLessThan(p8(missingPreferred));
    expect(complete.overallScore - missingMandatory.overallScore)
      .toBeGreaterThan(complete.overallScore - missingPreferred.overallScore);
  });

  it('rejects multiple explicit job postings in one analysis', () => {
    expect(() => scoreResumeAgainstJD(
      alignedResume,
      'Job Title: Backend Engineer\nRequired: Python.\n---\nJob Title: Data Analyst\nRequired: SQL.',
    )).toThrow(/one job description/i);
  });

  it('normalizes legacy string fields before canonical scoring', () => {
    const legacyResume = normalizeCanonicalResume({
      name: 'Candidate',
      email: 'candidate@example.com',
      experience: [{
        title: 'Backend Intern',
        organization: 'Example Systems',
        dates: 2025,
        responsibilities: 'Built Python APIs\n- Improved database queries',
      }],
      projects: [{
        name: 'Student Result System',
        technologies: 'Python, Flask, MySQL',
        points: 'Built a REST API\n• Tested endpoints with Postman',
      }],
      skills: { Languages: 'Python, JavaScript', Frameworks: ['Flask'] },
      certifications: { title: 'Invalid non-array value' },
    });

    expect(legacyResume.workExperience[0].bullets).toEqual([
      'Built Python APIs',
      'Improved database queries',
    ]);
    expect(legacyResume.projects[0].techStack).toEqual(['Python', 'Flask', 'MySQL']);
    expect(legacyResume.skills.flatMap(group => group.list)).toEqual(['Python', 'JavaScript', 'Flask']);
    expect(() => scoreResumeAgainstJD(legacyResume, backendJd, 'fresher')).not.toThrow();
  });

  it('never awards points without allowed-section evidence on sparse resumes', () => {
    const sparseResume = normalizeCanonicalResume({
      name: 'Candidate',
      email: 'candidate@example.com',
      summary: 'Python engineer interested in reliable financial services.',
      projects: [{ name: 'API Project', technologies: 'Python, Flask' }],
    });
    const result = scoreResumeAgainstJD(sparseResume, backendJd, 'fresher');
    const unsupportedAwards = result.parameters.filter(parameter =>
      parameter.score > 0 && (!Array.isArray(parameter.evidence) || parameter.evidence.length === 0)
    );

    expect(unsupportedAwards).toEqual([]);
    expect(result.parameters.find(parameter => parameter.id === 23)?.score).toBe(0);
  });

  describe('honest skill matching (pb-jd-v2.1.0)', () => {
    const p = (result: ReturnType<typeof scoreResumeAgainstJD>, id: number) => result.parameters.find(parameter => parameter.id === id)!;
    const fromText = (rawText: string) => normalizeCanonicalResume({
      name: 'Candidate', email: 'candidate@example.com', evidenceDocument: { rawText },
    });

    it('does not count generic JD words or plain OS names as required tools', () => {
      const jd = `Job Title: Frontend Developer
Required: React, verification of releases, and working across teams.
Our office laptops run Windows and Linux. You will go above and beyond, in less than a week.`;
      const result = scoreResumeAgainstJD(alignedResume, jd, 'fresher');
      const missing = p(result, 7).suggestions.join(' ') + p(result, 8).suggestions.join(' ') + p(result, 6).suggestions.join(' ');
      expect(missing).not.toMatch(/\b(?:teams|windows|linux|verification|less|go)\b/i);
    });

    it('keeps an OS name when the JD asks for administering it', () => {
      const jd = `Job Title: Systems Engineer
Required: Linux server administration, Python and Bash.`;
      const result = scoreResumeAgainstJD(alignedResume, jd, 'experienced');
      expect(p(result, 7).suggestions.join(' ')).toMatch(/linux/i);
    });

    it('does not let one missing mandatory word zero the mandatory category', () => {
      const oneRequired = `Job Title: Backend Engineer
Required: Kotlin.
Preferred: Python and PostgreSQL. Build backend services.`;
      const single = scoreResumeAgainstJD(alignedResume, oneRequired, 'experienced');
      // 1 of 3 trust in the lone keyword (0%), 2 of 3 in the other hard skills (100%).
      expect(p(single, 8).percentage).toBe(70);

      const threeRequired = `Job Title: Backend Engineer
Required: Kotlin, Scala and Ruby.
Build backend services in Python.`;
      const gated = scoreResumeAgainstJD(alignedResume, threeRequired, 'experienced');
      expect(p(gated, 8).applicable).toBe(true);
      expect(p(gated, 8).percentage).toBe(0);
    });

    it('matches spelling variants of one skill', () => {
      const jd = `Job Title: Full Stack Developer
Required: React.js, Node.js, Postgres and k8s.
Build product features.`;
      const resume = fromText(`SKILLS
ReactJS, NodeJS, PostgreSQL, Kubernetes

PROJECTS
Shop App
- Built a shop with ReactJS and NodeJS on PostgreSQL, deployed on Kubernetes.`);
      const result = scoreResumeAgainstJD(resume, jd, 'fresher');
      expect(p(result, 8).percentage).toBe(100);
      expect(p(result, 8).evidence?.length).toBeGreaterThan(0);
    });

    it('credits an implied skill only when its source technology is grounded', () => {
      const jd = `Job Title: Backend Developer
Required: JavaScript, Python and SQL.
Build APIs.`;
      const withSources = fromText(`SKILLS
Express, Django, MySQL

PROJECTS
Orders API
- Built an orders API with Express and a reporting service with Django on MySQL.`);
      const withoutSources = fromText(`SKILLS
Figma, Branding

PROJECTS
Brand Kit
- Designed a brand kit for a local bakery.`);
      const credited = scoreResumeAgainstJD(withSources, jd, 'fresher');
      const notCredited = scoreResumeAgainstJD(withoutSources, jd, 'fresher');
      expect(p(credited, 8).percentage).toBe(100);
      expect(p(credited, 8).evidence?.join(' ')).toMatch(/Express|Django|MySQL/);
      expect(p(notCredited, 8).percentage).toBe(0);
    });
  });
});
