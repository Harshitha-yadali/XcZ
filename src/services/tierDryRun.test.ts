/**
 * Dry run of Quick / Smart / Deep on a synthetic resume (no real person) with
 * the real scorer, validator, Boost and refinement loop. Every AI call is a
 * deterministic stub that does only what the prompts allow (reword with action
 * verbs, name grounded JD skills, keep numbers). Real model output will differ.
 */
import { describe, expect, it, vi } from 'vitest';
import type { ResumeData, UserType } from '../types/resume';

const { chatWithSystemMock } = vi.hoisted(() => ({ chatWithSystemMock: vi.fn() }));
vi.mock('./aiProxyService', () => ({ openrouter: { chatWithSystem: chatWithSystemMock } }));
vi.mock('./canonicalJdScoringService', async () => {
  const engine = await vi.importActual<typeof import('./jdScoringEngine')>('./jdScoringEngine');
  const normalizer = await vi.importActual<typeof import('./canonicalResumeNormalizer')>('./canonicalResumeNormalizer');
  return {
    CanonicalJdScoringService: {
      // What the scoring server does: rebuild the resume (and its evidence raw text), then score.
      score: async ({ resumeData, jobDescription, candidateType }: { resumeData: ResumeData; jobDescription: string; candidateType: UserType }) => ({
        scoreResult: engine.scoreResumeAgainstJD(normalizer.normalizeCanonicalResume(resumeData), jobDescription, candidateType),
        scoreId: 'dry', inputHash: 'dry', scoringVersion: 'dry', cacheHit: false,
      }),
    },
  };
});

import { runOptimizationLoop } from './optimizationLoopController';
import { REWRITE_INPUT_MARKER } from './targetedParameterOptimizer';
import { parseResumeEvidence } from './resumeEvidenceExtractor';
import { validateAndRepairResume } from './resumeEvidenceValidator';
import { applyCandidateBoost, boostSkillChoices, buildMetricQuestions, metricText, scoreLikeServer, type CandidateBoost } from './candidateBoost';
import { getJdOptimizationTier, type JdOptimizationTierId } from '../config/jdOptimizationTiers';

const rawText = `Asha Demo
asha.demo@example.com | 9000000002 | linkedin.com/in/asha-demo | github.com/asha-demo

CAREER OBJECTIVE
Computer Science graduate looking for a backend developer job.

SKILLS
Python, Django, JavaScript, HTML, CSS, MySQL, Git

PROJECTS
Campus Event Portal
Technologies: Django, MySQL, HTML, CSS
- Made an event registration portal for college clubs.
- Worked on role-based login so club admins could manage events.

Expense Tracker App
Technologies: Python, JavaScript
- Worked on an expense tracker with a dashboard.
- Automated monthly spending reports exported as CSV files.

Library Booking System
Technologies: Django, MySQL
- Made a seat booking system for the college library.

Weather Alerts Bot
Technologies: Python
- Built a bot that sends daily weather alerts to subscribers.

Notes Sharing Site
Technologies: Django, HTML, CSS
- Helped build a notes sharing site for classmates.

EXPERIENCE
Web Development Intern | Brightpath Solutions | Jan 2025 - Apr 2025
- Fixed UI bugs on the company website and wrote Django views for contact forms.
- Helped the QA team test new website releases.

Backend Intern | Northwind Labs | May 2024 - Jul 2024
- Worked on Python scripts that cleaned customer data.

EDUCATION
B.Tech in Computer Science, Example Institute of Technology, 2025, CGPA 8.0`;

const jd = `Job Title: Junior Backend Developer
Company: Example Tech (Pune)
Required skills: Python, Django, REST API, PostgreSQL, Docker, Git, Linux, SQL.
Preferred: AWS, Redis, Celery, Kubernetes, CI/CD, unit testing with Pytest.
Responsibilities: Build and maintain REST APIs in Django, write SQL queries, containerize services with Docker,
deploy on AWS and monitor Linux servers. Freshers with strong projects are welcome.
Qualification: B.Tech / B.E. in Computer Science or related field.`;

const project = (title: string, techStack: string[], bullets: string[]) => ({ title, techStack, bullets });
const original: ResumeData = {
  name: 'Asha Demo', email: 'asha.demo@example.com', phone: '9000000002',
  linkedin: 'https://linkedin.com/in/asha-demo', github: 'https://github.com/asha-demo',
  careerObjective: 'Computer Science graduate looking for a backend developer job.',
  education: [{ degree: 'B.Tech in Computer Science', school: 'Example Institute of Technology', year: '2025', cgpa: '8.0' }],
  workExperience: [
    { role: 'Web Development Intern', company: 'Brightpath Solutions', year: 'Jan 2025 - Apr 2025', bullets: ['Fixed UI bugs on the company website and wrote Django views for contact forms.', 'Helped the QA team test new website releases.'] },
    { role: 'Backend Intern', company: 'Northwind Labs', year: 'May 2024 - Jul 2024', bullets: ['Worked on Python scripts that cleaned customer data.'] },
  ],
  projects: [
    project('Campus Event Portal', ['Django', 'MySQL', 'HTML', 'CSS'], ['Made an event registration portal for college clubs.', 'Worked on role-based login so club admins could manage events.']),
    project('Expense Tracker App', ['Python', 'JavaScript'], ['Worked on an expense tracker with a dashboard.', 'Automated monthly spending reports exported as CSV files.']),
    project('Library Booking System', ['Django', 'MySQL'], ['Made a seat booking system for the college library.']),
    project('Weather Alerts Bot', ['Python'], ['Built a bot that sends daily weather alerts to subscribers.']),
    project('Notes Sharing Site', ['Django', 'HTML', 'CSS'], ['Helped build a notes sharing site for classmates.']),
  ],
  skills: [{ category: 'Technical Skills', count: 7, list: ['Python', 'Django', 'JavaScript', 'HTML', 'CSS', 'MySQL', 'Git'] }],
  certifications: [],
  evidenceDocument: parseResumeEvidence(rawText),
};

// --- Deterministic stand-ins for the AI writer -------------------------------
const WEAK: Array<[RegExp, string]> = [[/^worked on\s+/i, 'Developed '], [/^made\s+/i, 'Built '], [/^helped (?:the )?/i, 'Supported the '], [/^did\s+/i, 'Completed ']];
const jdLower = jd.toLowerCase();
const inJd = (skill: string) => jdLower.includes(skill.toLowerCase());

function rewriteBullet(bullet: string, entrySkills: string[] = []): string {
  let out = bullet.trim();
  for (const [weak, strong] of WEAK) out = out.replace(weak, strong);
  out = out.replace(/[.;\s]+$/, '');
  const add = entrySkills.filter(skill => inJd(skill) && !out.toLowerCase().includes(skill.toLowerCase())).slice(0, 2);
  return `${out}${add.length ? ` using ${add.join(' and ')}` : ''}.`;
}
const summaryFor = (skills: string[]) =>
  `Computer Science graduate targeting the Junior Backend Developer role, building web services with ${skills.join(', ')}, and eager to ship reliable, tested backend features.`;

/** First pass (all tiers share the evidence-locked prompt): reword bullets, name the entry's own JD tech, rewrite the objective. */
function firstPassStub(resume: ResumeData, boost: CandidateBoost | null): ResumeData {
  const out = JSON.parse(JSON.stringify(resume)) as ResumeData;
  delete out.evidenceDocument; // the AI returns plain fields
  const confirmed = (boost?.skills || []).map(s => s.skill);
  const grounded = [...new Set([...out.skills.flatMap(g => g.list), ...out.projects.flatMap(p => p.techStack || []), ...confirmed])].filter(inJd);
  out.careerObjective = summaryFor(grounded);
  out.projects.forEach(p => { p.bullets = p.bullets.map(b => rewriteBullet(b, p.techStack)); });
  out.workExperience.forEach(j => { j.bullets = j.bullets.map(b => rewriteBullet(b)); });
  return out;
}

/** Refinement rewrite: reads the INPUT_JSON the prompt carries and rewords it the same way. */
chatWithSystemMock.mockImplementation(async (_system: string, prompt: string) => {
  const at = prompt.indexOf(REWRITE_INPUT_MARKER);
  if (at < 0) throw new Error('skill categorisation: use the local fallback');
  const input = JSON.parse(prompt.slice(at + REWRITE_INPUT_MARKER.length));
  const skills = (prompt.match(/already shows that skill: (.*)\.\n/)?.[1] || '').split(', ').filter(s => s && s !== '(none)');
  return JSON.stringify({
    ...(input.summary ? { summary: summaryFor(skills) } : {}),
    ...(input.entries ? { entries: input.entries.map((e: { section: string; index: number; bullets: string[] }) => ({ ...e, bullets: e.bullets.map(b => rewriteBullet(b)) })) } : {}),
  });
});

// --- The candidate's truth, and what each tier's Boost asks ------------------
const TRUE_SKILLS = new Set(['REST API', 'PostgreSQL', 'Docker', 'Linux', 'SQL', 'AWS', 'Pytest', 'CI/CD']);
const NUMBERS = ['200+', '30%', '500+', '5', '1,000+', '4', '10', '85%'];

function boostFor(tierId: JdOptimizationTierId): CandidateBoost {
  const limits = getJdOptimizationTier(tierId).boostLimits;
  return {
    skills: boostSkillChoices(original, jd, limits.skills ?? Number.MAX_SAFE_INTEGER).filter(s => TRUE_SKILLS.has(s)).map(skill => ({ skill })),
    metrics: buildMetricQuestions(original, limits.metrics).map((q, i) => ({
      section: q.section, entryIndex: q.entryIndex, bulletIndex: q.bulletIndex, bulletText: q.bulletText, text: metricText(q.kind, NUMBERS[i])!,
    })),
  };
}

async function runTier(tierId: JdOptimizationTierId, boost: CandidateBoost | null) {
  const tier = getJdOptimizationTier(tierId);
  // As in EnhancedJdOptimizerService: validate against the uploaded resume plus what was confirmed.
  const first = firstPassStub(original, boost);
  const validated = applyCandidateBoost(validateAndRepairResume(applyCandidateBoost(original, boost), first).resume, boost);
  return runOptimizationLoop(validated, jd, undefined, original, {
    maxLoops: tier.maxLoops,
    modelSequence: [tier.refinementModel],
    fallbackModel: tier.refinementFallbackModel,
    refinementSections: tier.refinementSections,
    candidateType: 'fresher',
    optimizationTier: tierId,
    boost,
  });
}

describe('tier dry run (synthetic fixture, stubbed AI)', () => {
  it('reports before / Quick / Smart / Deep, with and without Boost', async () => {
    const before = scoreLikeServer(original, jd, 'fresher');
    const rows: string[] = [];
    for (const tierId of ['quick', 'smart', 'deep'] as const) {
      const plain = await runTier(tierId, null);
      const boost = boostFor(tierId);
      const boosted = await runTier(tierId, boost);
      rows.push(`${tierId.padEnd(6)} target=${String(plain.targetScore).padEnd(3)} noBoost=${plain.afterScore.overallScore} (loops ${plain.iterations.length}, reached ${plain.reachedTarget})  withBoost=${boosted.afterScore.overallScore} (loops ${boosted.iterations.length}, reached ${boosted.reachedTarget}; confirmed ${boost.skills.length} skills, ${boost.metrics.length} numbers)`);
      if (plain.targetGuidance) rows.push(`       guidance (no Boost): ${plain.targetGuidance.message}`);
      if (boosted.targetGuidance) rows.push(`       guidance (Boost): ${boosted.targetGuidance.message}`);

      expect(plain.beforeScore.overallScore).toBe(before);
      expect(plain.afterScore.overallScore).toBeGreaterThanOrEqual(before);
      expect(boosted.afterScore.overallScore).toBeGreaterThanOrEqual(plain.afterScore.overallScore);
      // Never credited without confirmation: the candidate does not have these.
      const listed = boosted.optimizedResume.skills.flatMap(g => g.list).map(s => s.toLowerCase());
      for (const absent of ['kubernetes', 'celery', 'redis']) expect(listed).not.toContain(absent);
    }
    console.log(`[tier dry run] before=${before}\n${rows.join('\n')}`);
  });
});
