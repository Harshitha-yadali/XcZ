import type { ResumeData } from '../types/resume';
import type { UserType } from '../types/resume';
import { CONFIRMED_DETAILS_HEADING, SKILL_ALIASES, canonicalSkillKey, parseResumeEvidence } from './resumeEvidenceExtractor';
import { missingJdSkills, scoreResumeAgainstJD } from './jdScoringEngine';
import { normalizeCanonicalResume } from './canonicalResumeNormalizer';

/** Where the candidate says they used a confirmed skill. */
export interface ConfirmedSkill {
  skill: string;
  where?: { kind: 'project' | 'experience' | 'other'; label: string };
}

/** A number the candidate confirmed for one of their own bullets. */
export interface ConfirmedMetric {
  section: 'projects' | 'workExperience';
  entryIndex: number;
  bulletIndex: number;
  /** The bullet as uploaded, used to find it in the evidence text. */
  bulletText: string;
  /** e.g. "used by 500+ users" */
  text: string;
}

export interface CandidateBoost {
  skills: ConfirmedSkill[];
  metrics: ConfirmedMetric[];
}

export type MetricKind = 'users' | 'speed' | 'accuracy' | 'records' | 'team' | 'hours';

export interface MetricQuestion {
  section: ConfirmedMetric['section'];
  entryIndex: number;
  bulletIndex: number;
  entryTitle: string;
  bulletText: string;
  kind: MetricKind;
}

export const METRIC_KINDS: Record<MetricKind, { question: string; chips: string[]; phrase: (n: string) => string }> = {
  users: { question: 'How many people used it?', chips: ['50+', '100+', '500+', '1,000+'], phrase: n => `used by ${n} users` },
  speed: { question: 'How much faster did it get?', chips: ['20%', '30%', '50%', '70%'], phrase: n => `cutting response time by ${n}` },
  accuracy: { question: 'What accuracy did it reach?', chips: ['80%', '85%', '90%', '95%'], phrase: n => `reaching ${n} accuracy` },
  records: { question: 'How many records / rows did it handle?', chips: ['1,000+', '10,000+', '50,000+', '1,00,000+'], phrase: n => `processing ${n} records` },
  team: { question: 'How big was the team?', chips: ['2', '3', '4', '5'], phrase: n => `with a team of ${n} people` },
  hours: { question: 'How many hours did it save per week?', chips: ['2', '5', '10', '20'], phrase: n => `saving ${n} hours per week` },
};

/** The JD skills the candidate can confirm, in the name a recruiter expects ("REST" -> "REST API"). */
export function boostSkillChoices(resume: ResumeData, jobDescription: string, limit = 12): string[] {
  const seen = new Set<string>();
  return missingJdSkills(normalizeCanonicalResume(resume), jobDescription)
    .map(skill => SKILL_ALIASES[skill.toLowerCase()] || skill)
    .filter(skill => !seen.has(canonicalSkillKey(skill)) && Boolean(seen.add(canonicalSkillKey(skill))))
    .slice(0, limit);
}

/** The official score as the scoring server computes it (rebuilt from evidence raw text). */
export const scoreLikeServer = (resume: ResumeData, jobDescription: string, candidateType: UserType): number =>
  scoreResumeAgainstJD(normalizeCanonicalResume(resume), jobDescription, candidateType).overallScore;

const HAS_NUMBER = /\d/;

function metricKindFor(bullet: string): MetricKind {
  const text = bullet.toLowerCase();
  if (/\b(?:model|predict|classif|accuracy|detect|recogni|train)/.test(text)) return 'accuracy';
  if (/\b(?:optimi[sz]|faster|latency|performance|query|queries|cach|load time|speed)/.test(text)) return 'speed';
  if (/\b(?:automat|script|pipeline|report)/.test(text)) return 'hours';
  if (/\b(?:dataset|data|etl|records|rows|database)/.test(text)) return 'records';
  if (/\b(?:team|collaborat|led|coordinat)/.test(text)) return 'team';
  return 'users';
}

/**
 * Up to `limit` of the candidate's own bullets that carry no number yet: one
 * per project first (project metrics count twice), then experience entries.
 */
export function buildMetricQuestions(resume: ResumeData, limit = 4): MetricQuestion[] {
  const firstWithoutNumber = (bullets: string[] = []) => bullets.findIndex(b => b.trim().length > 15 && !HAS_NUMBER.test(b));
  const out: MetricQuestion[] = [];
  const push = (section: MetricQuestion['section'], entryIndex: number, entryTitle: string, bullets: string[]) => {
    const bulletIndex = firstWithoutNumber(bullets);
    if (bulletIndex < 0 || out.length >= limit) return;
    const bulletText = bullets[bulletIndex];
    out.push({ section, entryIndex, bulletIndex, entryTitle, bulletText, kind: metricKindFor(bulletText) });
  };
  (resume.projects || []).forEach((project, index) => push('projects', index, project.title, project.bullets));
  (resume.workExperience || []).forEach((job, index) => push('workExperience', index, [job.role, job.company].filter(Boolean).join(' at '), job.bullets));
  return out;
}

/** Digits with the separators people write: "500", "1,000+", "85%". */
export const cleanMetricNumber = (value: string): string => value.replace(/[^\d,.+%]/g, '').replace(/^[,.]+|[,.]+$/g, '').slice(0, 12);

export function metricText(kind: MetricKind, rawNumber: string): string | null {
  let n = cleanMetricNumber(rawNumber);
  if (!/\d/.test(n)) return null;
  if ((kind === 'speed' || kind === 'accuracy') && !n.endsWith('%')) n = `${n}%`;
  if (kind !== 'speed' && kind !== 'accuracy') n = n.replace(/%/g, '');
  return METRIC_KINDS[kind].phrase(n);
}

const oneLine = (value: string, max: number) => value.replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** The block appended to the evidence raw text, and shown to the AI writer as resume content. */
export function confirmedDetailsBlock(boost: CandidateBoost): string {
  const lines = [
    ...boost.skills.map(({ skill, where }) => {
      const name = oneLine(skill, 45);
      if (!where?.label.trim()) return `Confirmed skill: ${name}`;
      const kind = where.kind === 'other' ? '' : ` ${where.kind}`;
      return `Confirmed skill: ${name} | Used in${kind}: ${oneLine(where.label, 80)}`;
    }),
    ...boost.metrics.map(metric => `Confirmed metric: ${oneLine(metric.text, 80)} | For: ${oneLine(metric.bulletText, 300)}`),
  ];
  return lines.length > 0 ? `${CONFIRMED_DETAILS_HEADING}\n${lines.join('\n')}` : '';
}

export const hasBoost = (boost?: CandidateBoost | null): boost is CandidateBoost =>
  Boolean(boost && (boost.skills.length > 0 || boost.metrics.length > 0));

const numbersIn = (value: string) => (value.match(/\d[\d,.]*/g) || []).map(n => n.replace(/[,.]/g, ''));

/**
 * Writes what the candidate confirmed into the resume a recruiter reads:
 * skills into the Skills section (and the project's tech stack when they said
 * where), numbers into the bullet they belong to. Idempotent. When the resume
 * carries an evidence document, the confirmed block is appended to its raw
 * text so every rebuild (client or scoring server) credits it.
 */
export function applyCandidateBoost(resume: ResumeData, boost?: CandidateBoost | null): ResumeData {
  if (!hasBoost(boost)) return resume;
  const next = JSON.parse(JSON.stringify(resume)) as ResumeData;

  const listed = new Set((next.skills || []).flatMap(group => group.list).map(canonicalSkillKey));
  for (const { skill, where } of boost.skills) {
    const key = canonicalSkillKey(skill);
    if (!listed.has(key)) {
      next.skills = next.skills?.length ? next.skills : [{ category: 'Technical Skills', count: 0, list: [] }];
      const group = next.skills.find(item => /tool|technolog|technical|framework/i.test(item.category)) || next.skills[0];
      group.list = [...group.list, skill];
      group.count = group.list.length;
      listed.add(key);
    }
    if (where?.kind === 'project') {
      const project = (next.projects || []).find(item => item.title.trim() === where.label.trim());
      if (project && !(project.techStack || []).some(item => canonicalSkillKey(item) === key)) {
        project.techStack = [...(project.techStack || []), skill];
      }
    }
  }

  for (const metric of boost.metrics) {
    const entry = metric.section === 'projects' ? next.projects?.[metric.entryIndex] : next.workExperience?.[metric.entryIndex];
    const bullet = entry?.bullets?.[metric.bulletIndex];
    if (!entry || bullet === undefined) continue;
    const have = new Set(numbersIn(bullet));
    if (numbersIn(metric.text).every(n => have.has(n))) continue;
    entry.bullets[metric.bulletIndex] = `${bullet.trim().replace(/[.;\s]+$/, '')}; ${metric.text}.`;
  }

  const rawText = next.evidenceDocument?.rawText;
  if (rawText) {
    const heading = `\n${CONFIRMED_DETAILS_HEADING}\n`;
    const original = rawText.includes(heading) ? rawText.slice(0, rawText.indexOf(heading)) : rawText;
    next.evidenceDocument = parseResumeEvidence(`${original.trimEnd()}\n\n${confirmedDetailsBlock(boost)}`);
  }
  return next;
}
