import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { parseResumeEvidence } from './resumeEvidenceExtractor';
import { boostCanContinue, scoreLikeServer, type CandidateBoost } from './candidateBoost';
import { buildSkillGapPlan, ceilingScore, predictTierScore, youtubeSearchUrl } from './scorePrediction';
import { getJdOptimizationTier } from '../config/jdOptimizationTiers';

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

const confirmAll: CandidateBoost = {
  skills: ['REST API', 'PostgreSQL', 'Docker', 'AWS', 'Pytest', 'Linux', 'SQL', 'Redis', 'Celery', 'React', 'CI/CD'].map(skill => ({ skill })),
  metrics: [],
};

describe('score prediction before paying', () => {
  it('misses Deep 90 without confirmed skills, names the missing skills and gives a gap plan', () => {
    const p = predictTierScore({ resume, jobDescription: jd, candidateType: 'fresher', boost: null, tier: 'deep' });
    console.log(`[prediction] no boost: current=${p.current} predicted=${p.predicted} target=${p.target} reaches=${p.reachesTarget} missing=${p.missingSkills.join(', ')}`);
    expect(p.target).toBe(90);
    expect(p.predicted).toBeGreaterThanOrEqual(p.current);
    expect(p.reachesTarget).toBe(false);
    expect(p.missingSkills.length).toBeGreaterThan(0);
    expect(p.missingSkills).toContain('Docker');
    expect(p.gapPlan.map(c => c.skill)).toEqual(p.missingSkills);
  });

  it('predicts higher once skills are confirmed and drops them from the missing list', () => {
    const before = predictTierScore({ resume, jobDescription: jd, candidateType: 'fresher', boost: null, tier: 'deep' });
    const after = predictTierScore({ resume, jobDescription: jd, candidateType: 'fresher', boost: confirmAll, tier: 'deep' });
    console.log(`[prediction] all confirmed: predicted=${after.predicted} reaches=${after.reachesTarget} missing=${after.missingSkills.join(', ')}`);
    expect(after.predicted).toBeGreaterThan(before.predicted);
    expect(after.missingSkills).not.toContain('Docker');
  });

  it('reports reaching a target the ceiling clears (Quick: before + 20)', () => {
    const p = predictTierScore({ resume, jobDescription: jd, candidateType: 'fresher', boost: confirmAll, tier: 'quick' });
    expect(p.target).toBe(Math.min(100, p.current + 20));
    expect(p.reachesTarget).toBe(p.predicted >= p.target);
    if (p.reachesTarget) expect(p.gapPlan).toEqual([]);
  });

  it('ceiling is never below the plain score', () => {
    expect(ceilingScore(resume, jd, 'fresher')).toBeGreaterThanOrEqual(scoreLikeServer(resume, jd, 'fresher'));
  });
});

describe('skill gap plan', () => {
  const plan = buildSkillGapPlan({ resume, jobDescription: jd, candidateType: 'fresher', ceiling: true });

  it('returns the top 3-5 skills, best first, each raising the score', () => {
    console.log('[gap plan]', JSON.stringify(plan, null, 2));
    expect(plan.length).toBeGreaterThanOrEqual(3);
    expect(plan.length).toBeLessThanOrEqual(5);
    const base = ceilingScore(resume, jd, 'fresher');
    for (const card of plan) {
      expect(card.scoreIfConfirmed).toBeGreaterThan(base);
      expect(card.gain).toBe(card.scoreIfConfirmed - base);
    }
    expect([...plan].sort((a, b) => b.gain - a.gain)).toEqual(plan);
  });

  it('fills mapped skills from the static map with docs and a category project', () => {
    const docker = plan.find(c => c.skill === 'Docker') ?? buildSkillGapPlan({ resume, jobDescription: jd, candidateType: 'fresher', ceiling: true, limit: 15 }).find(c => c.skill === 'Docker')!;
    expect(docker.docsUrl).toBe('https://docs.docker.com/get-started/');
    expect(docker.youtubeUrl).toBe('https://www.youtube.com/results?search_query=Docker+tutorial+for+beginners');
    expect(docker.projectIdea).toMatch(/containerise/);
  });

  it('falls back to a generic template for skills outside the map', () => {
    const odd = 'Job Title: Junior Developer\nRequired skills: Python, Django, Celery, RabbitMQ, Elasticsearch.';
    const cards = buildSkillGapPlan({ resume, jobDescription: odd, candidateType: 'fresher', ceiling: true, limit: 15 });
    const generic = cards.find(c => c.docsUrl === null);
    expect(generic).toBeDefined();
    expect(generic!.projectIdea).toContain(`uses ${generic!.skill} end to end`);
    expect(generic!.what).toMatch(/does not show yet/);
  });

  it('excludes skills already confirmed', () => {
    const cards = buildSkillGapPlan({ resume, jobDescription: jd, candidateType: 'fresher', ceiling: true, boost: { skills: [{ skill: 'Docker' }], metrics: [] }, limit: 15 });
    expect(cards.map(c => c.skill)).not.toContain('Docker');
  });

  it('builds a YouTube search URL with + separators', () => {
    expect(youtubeSearchUrl('Node.js')).toBe('https://www.youtube.com/results?search_query=Node.js+tutorial+for+beginners');
  });
});

describe('Boost required in Deep', () => {
  it('flags Deep only as required', () => {
    expect(['quick', 'smart', 'deep'].map(t => getJdOptimizationTier(t as 'deep').boostRequired)).toEqual([false, false, true]);
  });

  it('Deep Continue needs a skill ticked or "I have none of these"; Quick/Smart never block', () => {
    expect(boostCanContinue('deep', 5, 0, false)).toBe(false);
    expect(boostCanContinue('deep', 5, 1, false)).toBe(true);
    expect(boostCanContinue('deep', 5, 0, true)).toBe(true);
    expect(boostCanContinue('deep', 0, 0, false)).toBe(true);
    expect(boostCanContinue('smart', 5, 0, false)).toBe(true);
    expect(boostCanContinue('quick', 5, 0, false)).toBe(true);
  });

  it('Deep runs up to 8 refinement loops', () => {
    expect(getJdOptimizationTier('deep').maxLoops).toBe(8);
  });
});
