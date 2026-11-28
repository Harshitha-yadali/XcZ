import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { missingJdSkills, scoreResumeAgainstJD } from './jdScoringEngine';
import { normalizeCanonicalResume } from './canonicalResumeNormalizer';
import { parseResumeEvidence } from './resumeEvidenceExtractor';
import { validateAndRepairResume } from './resumeEvidenceValidator';
import {
  applyCandidateBoost,
  boostSkillChoices,
  buildMetricQuestions,
  metricText,
  type CandidateBoost,
} from './candidateBoost';

// Synthetic fresher resume: no real person.
const rawText = `Rahul Verma
rahul.verma@example.com | 9000000001 | linkedin.com/in/rahul-verma-demo | github.com/rahul-verma-demo

CAREER OBJECTIVE
Computer Science graduate seeking an entry-level backend developer role building reliable web services.

SKILLS
Python, Django, JavaScript, HTML, CSS, MySQL, Git

PROJECTS
Campus Event Portal
Technologies: Django, MySQL, HTML, CSS
- Built an event registration portal with Django and MySQL for college clubs.
- Designed role-based login so club admins could publish and manage events.

Expense Tracker App
Technologies: Python, JavaScript
- Developed an expense tracker with Python scripts and a JavaScript dashboard.
- Automated monthly spending reports exported as CSV files.

Movie Recommendation Engine
Technologies: Python
- Trained a content-based recommendation model on a public movie dataset.

EXPERIENCE
Web Development Intern | Brightpath Solutions | Jan 2025 - Apr 2025
- Fixed UI bugs in the company website and wrote Django views for contact forms.
- Collaborated with the QA team to test new website releases.

EDUCATION
B.Tech in Computer Science, Example Institute of Technology, 2025, CGPA 8.1

CERTIFICATIONS
Python for Everybody`;

const jd = `Job Title: Junior Backend Developer
Company: Example Tech (Bengaluru)
Required skills: Python, Django, REST API, PostgreSQL, Docker, Git, Linux server administration, SQL.
Preferred: AWS, Redis, Celery, React, CI/CD, unit testing with Pytest.
Responsibilities: Build and maintain REST APIs in Django, write SQL queries, containerize services with Docker,
deploy on AWS and monitor Linux servers. Freshers with strong projects are welcome.
Qualification: B.Tech / B.E. in Computer Science or related field.`;

const resume: ResumeData = {
  name: 'Rahul Verma',
  email: 'rahul.verma@example.com',
  phone: '9000000001',
  linkedin: 'https://linkedin.com/in/rahul-verma-demo',
  github: 'https://github.com/rahul-verma-demo',
  careerObjective: 'Computer Science graduate seeking an entry-level backend developer role building reliable web services.',
  education: [{ degree: 'B.Tech in Computer Science', school: 'Example Institute of Technology', year: '2025', cgpa: '8.1' }],
  workExperience: [{
    role: 'Web Development Intern',
    company: 'Brightpath Solutions',
    year: 'Jan 2025 - Apr 2025',
    bullets: [
      'Fixed UI bugs in the company website and wrote Django views for contact forms.',
      'Collaborated with the QA team to test new website releases.',
    ],
  }],
  projects: [
    {
      title: 'Campus Event Portal',
      techStack: ['Django', 'MySQL', 'HTML', 'CSS'],
      bullets: [
        'Built an event registration portal with Django and MySQL for college clubs.',
        'Designed role-based login so club admins could publish and manage events.',
      ],
    },
    {
      title: 'Expense Tracker App',
      techStack: ['Python', 'JavaScript'],
      bullets: [
        'Developed an expense tracker with Python scripts and a JavaScript dashboard.',
        'Automated monthly spending reports exported as CSV files.',
      ],
    },
    {
      title: 'Movie Recommendation Engine',
      techStack: ['Python'],
      bullets: ['Trained a content-based recommendation model on a public movie dataset.'],
    },
  ],
  skills: [{ category: 'Technical Skills', count: 7, list: ['Python', 'Django', 'JavaScript', 'HTML', 'CSS', 'MySQL', 'Git'] }],
  certifications: ['Python for Everybody'],
  evidenceDocument: parseResumeEvidence(rawText),
};

/** What the scoring server sees: the resume rebuilt from its evidence raw text. */
const serverScore = (value: ResumeData) => scoreResumeAgainstJD(normalizeCanonicalResume(value), jd, 'fresher');
const param = (result: ReturnType<typeof scoreResumeAgainstJD>, id: number) => result.parameters.find(p => p.id === id)!;

/** The optimizer's output has no evidence document; it is scored on its own fields. */
const asDelivered = (value: ResumeData): ResumeData => {
  const { evidenceDocument: _ignored, ...rest } = JSON.parse(JSON.stringify(value)) as ResumeData;
  return rest as ResumeData;
};

const questions = buildMetricQuestions(resume);
const boost: CandidateBoost = {
  skills: [
    { skill: 'REST API', where: { kind: 'project', label: 'Campus Event Portal' } },
    { skill: 'PostgreSQL', where: { kind: 'project', label: 'Expense Tracker App' } },
    { skill: 'Docker', where: { kind: 'project', label: 'Campus Event Portal' } },
    { skill: 'AWS', where: { kind: 'other', label: 'College cloud workshop' } },
    { skill: 'Pytest', where: { kind: 'project', label: 'Expense Tracker App' } },
  ],
  metrics: questions.slice(0, 3).map((q, index) => ({
    section: q.section,
    entryIndex: q.entryIndex,
    bulletIndex: q.bulletIndex,
    bulletText: q.bulletText,
    text: metricText(q.kind, ['500+', '5', '85%'][index])!,
  })),
};

describe('candidate boost (confirmed evidence)', () => {
  it('lists the JD skills the resume does not ground, mandatory first', () => {
    const missing = missingJdSkills(normalizeCanonicalResume(resume), jd);
    expect(missing.slice(0, 4)).toEqual(expect.arrayContaining(['PostgreSQL', 'Docker']));
    expect(missing.map(s => s.toLowerCase())).not.toContain('python');
    const choices = boostSkillChoices(resume, jd);
    expect(choices).toContain('REST API');
    expect(choices).not.toContain('REST');
    expect(choices.length).toBeLessThanOrEqual(12);
  });

  it('credits a confirmed skill as grounded and writes it into the resume', () => {
    const boosted = applyCandidateBoost(resume, boost);
    expect(boosted.skills.flatMap(g => g.list)).toEqual(expect.arrayContaining(['Docker', 'PostgreSQL', 'REST API']));
    expect(boosted.projects[0].techStack).toContain('Docker');
    expect(boosted.evidenceDocument?.rawText).toContain('Confirmed skill: Docker | Used in project: Campus Event Portal');

    const before = serverScore(resume);
    const after = serverScore(boosted);
    expect(param(before, 8).suggestions.join(' ')).toMatch(/Docker/);
    expect(param(after, 8).suggestions.join(' ')).not.toMatch(/Docker/);
    expect(param(after, 8).score).toBeGreaterThan(param(before, 8).score);
    expect(missingJdSkills(normalizeCanonicalResume(boosted), jd)).not.toContain('Docker');
  });

  it('does not credit a missing skill the candidate did not confirm', () => {
    const boosted = applyCandidateBoost(resume, boost);
    const stillMissing = missingJdSkills(normalizeCanonicalResume(boosted), jd);
    expect(stillMissing).toEqual(expect.arrayContaining(['Redis']));
    expect(boosted.skills.flatMap(g => g.list)).not.toContain('Redis');
  });

  it('credits confirmed numbers as metrics (P11, P26) and puts them inside the bullet', () => {
    const boosted = applyCandidateBoost(resume, boost);
    expect(boosted.projects[0].bullets[0]).toMatch(/used by 500\+ users\.$/);
    const before = serverScore(resume);
    const after = serverScore(boosted);
    expect(param(after, 11).score).toBeGreaterThan(param(before, 11).score);
    expect(param(after, 26).score).toBeGreaterThan(param(before, 26).score);
  });

  it('is idempotent and survives a rebuild from raw text', () => {
    const once = applyCandidateBoost(resume, boost);
    const twice = applyCandidateBoost(once, boost);
    expect(twice.projects[0].bullets[0]).toBe(once.projects[0].bullets[0]);
    expect(twice.evidenceDocument?.rawText).toBe(once.evidenceDocument?.rawText);
    expect(serverScore(twice).overallScore).toBe(serverScore(once).overallScore);
  });

  it('lets the validator keep confirmed claims but still strip invented ones', () => {
    const evidence = applyCandidateBoost(resume, boost);
    const rewritten = asDelivered(evidence);
    rewritten.skills = [{ category: 'Technical Skills', count: 4, list: ['Python', 'Docker', 'Redis', 'Kubernetes'] }];
    rewritten.projects[0].bullets[1] = 'Designed role-based login with Redis sessions for 2,000 club admins.';

    const { resume: repaired } = validateAndRepairResume(evidence, rewritten);
    const skills = repaired.skills.flatMap(g => g.list);
    expect(skills).toContain('Docker');
    expect(skills).not.toContain('Redis');
    expect(skills).not.toContain('Kubernetes');
    expect(repaired.projects[0].bullets[0]).toContain('500+ users');
    expect(repaired.projects[0].bullets[1]).toBe(evidence.projects[0].bullets[1]);

    // Without the boost the same confirmed skill is still rejected.
    const { resume: unboosted } = validateAndRepairResume(resume, rewritten);
    expect(unboosted.skills.flatMap(g => g.list)).not.toContain('Docker');
  });

  it('dry run: before, after without boost, after with boost', () => {
    const before = serverScore(resume).overallScore;
    // No AI rewrite here: the resume delivered as-is, validated like a real run.
    const afterNoBoost = scoreResumeAgainstJD(validateAndRepairResume(resume, asDelivered(resume)).resume, jd, 'fresher').overallScore;
    const evidence = applyCandidateBoost(resume, boost);
    const delivered = applyCandidateBoost(validateAndRepairResume(evidence, asDelivered(evidence)).resume, boost);
    const afterBoost = scoreResumeAgainstJD(delivered, jd, 'fresher').overallScore;
    const estimate = serverScore(evidence).overallScore;
    console.log(`[boost dry run] choices=${boostSkillChoices(resume, jd).join(', ')}; ticked=${boost.skills.map(s => s.skill).join(', ')}; metrics=${boost.metrics.map(m => m.text).join(' / ')}`);
    console.log(`[boost dry run] before=${before} afterNoBoost=${afterNoBoost} afterWithBoost=${afterBoost} liveEstimate=${estimate}`);
    expect(afterBoost).toBeGreaterThan(afterNoBoost);
    expect(estimate).toBeGreaterThan(before);
  });
});

describe('Boost limits per tier', () => {
  it('Deep lists every missing JD skill; Quick and Smart cap at 12', async () => {
    const { getJdOptimizationTier } = await import('../config/jdOptimizationTiers');
    const all = boostSkillChoices(resume, jd, Number.MAX_SAFE_INTEGER);
    const deep = getJdOptimizationTier('deep').boostLimits;
    expect(deep.skills).toBeNull();
    expect(boostSkillChoices(resume, jd, deep.skills ?? Number.MAX_SAFE_INTEGER)).toEqual(all);
    for (const tier of ['quick', 'smart'] as const) {
      expect(getJdOptimizationTier(tier).boostLimits.skills).toBe(12);
    }
  });

  it('asks 4 / 6 / 8 number questions for Quick / Smart / Deep', async () => {
    const { getJdOptimizationTier } = await import('../config/jdOptimizationTiers');
    const many: ResumeData = {
      ...resume,
      projects: Array.from({ length: 10 }, (_, i) => ({ title: `Project ${i + 1}`, bullets: ["Built a web portal feature with Django views for students."] })),
    };
    expect(['quick', 'smart', 'deep'].map(tier => buildMetricQuestions(many, getJdOptimizationTier(tier as 'quick').boostLimits.metrics).length))
      .toEqual([4, 6, 8]);
  });
});
