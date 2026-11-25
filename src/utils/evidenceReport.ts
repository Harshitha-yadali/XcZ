import type { ResumeData } from '../types/resume';
import { unsupportedClaims } from '../services/resumeEvidenceValidator';

export type EvidenceStatus = 'kept' | 'rewritten' | 'check';

export interface EvidenceLine {
  id: string;
  heading: string;
  text: string;
  /** The closest line of the resume the user submitted, when there is one. */
  original?: string;
  status: EvidenceStatus;
  /** Facts in the line that the submitted resume does not state. */
  claims: string[];
  /** Puts new text in this line's place. */
  replace: (resume: ResumeData, text: string) => ResumeData;
}

const key = (value: string | undefined) => (value || '').toLowerCase().replace(/[^a-z0-9%+#]+/g, '');

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'using', 'from', 'that', 'this', 'into', 'was', 'were', 'are', 'our', 'its', 'of', 'to', 'in', 'on', 'by', 'an', 'as', 'at']);

// Five letters of each word, so "developed" meets "development".
const words = (value: string): Set<string> =>
  new Set((value.toLowerCase().match(/[a-z0-9+#]{2,}/g) || [])
    .filter((word) => !STOP_WORDS.has(word))
    .map((word) => word.slice(0, 5)));

/** Share of the original line's words that survive in the new line. */
const overlap = (original: string, text: string): number => {
  const from = words(original);
  if (from.size === 0) return 0;
  const to = words(text);
  return [...from].filter((word) => to.has(word)).length / from.size;
};

// ponytail: word overlap, so a full paraphrase reads as "check"; embeddings if that proves noisy.
const MIN_OVERLAP = 0.3;

const closest = (text: string, originals: string[]): string | undefined => {
  let best: string | undefined;
  let bestScore = 0;
  for (const original of originals) {
    if (key(original) === key(text)) return original;
    const score = overlap(original, text);
    if (score >= MIN_OVERLAP && score > bestScore) {
      best = original;
      bestScore = score;
    }
  }
  return best;
};

const swap = (list: string[] | undefined, index: number, text: string) =>
  (list || []).map((line, i) => (i === index ? text : line));

/**
 * One entry per line of the final resume, each traced to the resume the user
 * submitted. Entries are matched by name, not position, so editing or
 * reordering the resume does not pair a line with the wrong job.
 */
export function buildEvidenceReport(submitted: ResumeData, final: ResumeData): EvidenceLine[] {
  const evidenceText = JSON.stringify(submitted);
  const lines: EvidenceLine[] = [];

  const add = (
    id: string,
    heading: string,
    text: string | undefined,
    originals: string[],
    replace: EvidenceLine['replace'],
  ) => {
    if (!text?.trim()) return;
    const original = closest(text, originals);
    const claims = unsupportedClaims(text, evidenceText);
    let status: EvidenceStatus = 'check';
    if (original && key(original) === key(text)) status = 'kept';
    else if (original && claims.length === 0) status = 'rewritten';
    lines.push({ id, heading, text, original, status, claims, replace });
  };

  const summaries = [submitted.summary, submitted.careerObjective].filter((text): text is string => Boolean(text));
  add('summary', 'Summary', final.summary, summaries, (resume, text) => ({ ...resume, summary: text }));
  if (key(final.careerObjective) !== key(final.summary)) {
    add('objective', 'Objective', final.careerObjective, summaries, (resume, text) => ({ ...resume, careerObjective: text }));
  }

  final.workExperience?.forEach((job, j) => {
    const source = (submitted.workExperience || [])
      .filter((item) => key(item.company) === key(job.company) && key(item.role) === key(job.role))
      .flatMap((item) => item.bullets || []);
    const heading = [job.role, job.company].filter(Boolean).join(', ');
    job.bullets?.forEach((bullet, b) => add(`job-${j}-${b}`, heading, bullet, source, (resume, text) => ({
      ...resume,
      workExperience: resume.workExperience.map((item, i) => (i === j ? { ...item, bullets: swap(item.bullets, b, text) } : item)),
    })));
  });

  final.projects?.forEach((project, p) => {
    const source = (submitted.projects || [])
      .filter((item) => key(item.title) === key(project.title))
      .flatMap((item) => [...(item.bullets || []), ...(item.description ? [item.description] : [])]);
    project.bullets?.forEach((bullet, b) => add(`project-${p}-${b}`, project.title, bullet, source, (resume, text) => ({
      ...resume,
      projects: resume.projects.map((item, i) => (i === p ? { ...item, bullets: swap(item.bullets, b, text) } : item)),
    })));
  });

  final.additionalSections?.forEach((section, s) => {
    const source = (submitted.additionalSections || [])
      .filter((item) => key(item.title) === key(section.title))
      .flatMap((item) => item.bullets || []);
    section.bullets?.forEach((bullet, b) => add(`extra-${s}-${b}`, section.title, bullet, source, (resume, text) => ({
      ...resume,
      additionalSections: resume.additionalSections?.map((item, i) => (i === s ? { ...item, bullets: swap(item.bullets, b, text) } : item)),
    })));
  });

  return lines;
}
