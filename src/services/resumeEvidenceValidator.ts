import type { ResumeData, Skill } from '../types/resume';
import {
  BACKEND_TECHNOLOGIES,
  CLOUD_AND_DEVOPS,
  DATABASES,
  DATA_SCIENCE_AND_ML,
  FRONTEND_TECHNOLOGIES,
  PROGRAMMING_LANGUAGES,
} from '../constants/skillsTaxonomy';
import { canonicalSkillKey, impliedSkillsOf } from './resumeEvidenceExtractor';

export interface EvidenceViolation {
  section: 'contact' | 'education' | 'experience' | 'projects' | 'skills' | 'certifications' | 'additional';
  message: string;
}

export interface EvidenceValidationResult {
  resume: ResumeData;
  violations: EvidenceViolation[];
}

const cloneResume = (resume: ResumeData): ResumeData =>
  JSON.parse(JSON.stringify(resume)) as ResumeData;

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9+#.]/g, '');

const numericClaims = (value: string): string[] =>
  value.match(/(?:[$₹£€]\s*)?\d+(?:[.,]\d+)*(?:\s*[%+xkKmMbB])?/g) || [];

const unsupportedNumbers = (candidate: string, evidenceText: string): string[] => {
  const evidenceClaims = new Set(numericClaims(evidenceText).map(normalize));
  return numericClaims(candidate).filter((claim) => !evidenceClaims.has(normalize(claim)));
};

// Names that are also everyday English or too general to be a claim.
const AMBIGUOUS_SKILLS = /^(go|r|c|next|express|spring|rest|soap|less|ember|emotion|backbone|helm|chef|puppet|bamboo|oracle|aurora|shell|swift|assembly|pascal|rollup|parcel|sql|nosql|html5|css3|bash|iac|devops|microservices|transformers?|pillow|anaconda|ci\/cd)$|\bapi\b|restful|continuous|infrastructure|responsive|learning|neural|vision|processing|analysis|visualization|modeling|mining|engineering|fine-tuning|embeddings|vector database/;

const SKILL_ALIASES: Record<string, string> = {
  k8s: 'kubernetes',
  llms: 'llm',
  'large language models': 'llm',
  genai: 'generative ai',
  'retrieval augmented generation': 'rag',
  'agentic ai': 'ai agents',
  postgres: 'postgresql',
  sklearn: 'scikit-learn',
  'amazon web services': 'aws',
  'microsoft azure': 'azure',
  'google cloud': 'gcp',
  'google cloud platform': 'gcp',
  'digital ocean': 'digitalocean',
  'apache spark': 'spark',
  'tailwind css': 'tailwind',
};

// "Node.js", "NodeJS" and "Node" are one skill.
const dropJsSuffix = (value: string) => value.toLowerCase().replace(/\b([a-z]{2,})\.?js\b/g, '$1');

const NAMED_SKILLS = [
  ...PROGRAMMING_LANGUAGES, ...FRONTEND_TECHNOLOGIES, ...BACKEND_TECHNOLOGIES,
  ...DATABASES, ...CLOUD_AND_DEVOPS, ...DATA_SCIENCE_AND_ML,
]
  .map(dropJsSuffix)
  .filter((skill) => !AMBIGUOUS_SKILLS.test(skill))
  .map((skill) => ({
    name: SKILL_ALIASES[skill] || skill,
    pattern: new RegExp(`(?<![a-z0-9+#])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9+#])`),
  }));

const namedSkills = (value: string): Set<string> => {
  const text = dropJsSuffix(value);
  return new Set(NAMED_SKILLS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name));
};

const FLAWLESS_CLAIM = /\b(?:zero|no)\s+(?:\w+\s+)?(?:incidents?|downtime|defects?|bugs?|errors?|outages?)\b/i;

/** Numbers, technologies and "zero incidents" style claims the resume never made. */
export function unsupportedClaims(candidate: string, evidenceText: string): string[] {
  const flawless = candidate.match(FLAWLESS_CLAIM)?.[0];
  const known = namedSkills(evidenceText);
  return [
    ...unsupportedNumbers(candidate, evidenceText).map((claim) => claim.trim()),
    ...(flawless && !FLAWLESS_CLAIM.test(evidenceText) ? [flawless] : []),
    ...[...namedSkills(candidate)].filter((skill) => !known.has(skill)),
  ];
}

const hasUnsupportedClaim = (candidate: string, evidenceText: string): boolean =>
  unsupportedClaims(candidate, evidenceText).length > 0;

/**
 * The rewritten entry for source[index]: by name where the names say so, by
 * position otherwise, and never an entry that names a different source. A
 * reordered rewrite must not put one employer's work under another.
 */
function rewrittenEntry<T>(source: T[], candidates: T[] | undefined, index: number, nameOf: (item: T) => string): T | undefined {
  const list = candidates || [];
  const names = source.map(nameOf);
  // Two entries with one name can only be told apart by position.
  if (names.filter((name) => name === names[index]).length > 1) return list[index];
  const byName = list.find((item) => nameOf(item) === names[index]);
  if (byName) return byName;
  const byPosition = list[index];
  return byPosition && !names.includes(nameOf(byPosition)) ? byPosition : undefined;
}

function validateBullets(
  candidateBullets: string[] | undefined,
  evidenceBullets: string[] | undefined,
  evidenceText: string,
  section: EvidenceViolation['section'],
  violations: EvidenceViolation[],
): string[] {
  const source = evidenceBullets || [];
  const candidate = candidateBullets || [];

  return source.map((originalBullet, index) => {
    const rewrittenBullet = candidate[index];
    if (!rewrittenBullet) return originalBullet;
    if (hasUnsupportedClaim(rewrittenBullet, evidenceText)) {
      violations.push({
        section,
        message: `Removed an unsupported claim from ${section}.`,
      });
      return originalBullet;
    }
    return rewrittenBullet;
  });
}

function filterSkills(candidate: Skill[] | undefined, evidence: Skill[] | undefined, groundedElsewhere: string[] = []): Skill[] {
  const grounded = [...(evidence || []).flatMap((category) => category.list || []), ...groundedElsewhere];
  // A parent skill proven by a grounded technology (Express -> Node.js) may be listed too.
  const allowed = new Set([...grounded, ...impliedSkillsOf(grounded)].map(canonicalSkillKey));

  return (candidate || [])
    .map((category) => {
      const list = (category.list || []).filter((skill) => allowed.has(canonicalSkillKey(skill)));
      return { ...category, list, count: list.length };
    })
    .filter((category) => category.list.length > 0);
}

/**
 * Restores immutable candidate facts and rejects newly invented projects,
 * skills, entries, and numeric claims. Rewording is retained where evidence
 * remains supported by the original resume.
 */
export function validateAndRepairResume(
  evidenceResume: ResumeData,
  candidateResume: ResumeData,
): EvidenceValidationResult {
  const evidence = cloneResume(evidenceResume);
  const candidate = cloneResume(candidateResume);
  const violations: EvidenceViolation[] = [];
  const evidenceText = JSON.stringify(evidence);

  candidate.name = evidence.name;
  candidate.email = evidence.email;
  candidate.phone = evidence.phone;
  candidate.linkedin = evidence.linkedin;
  candidate.github = evidence.github;
  candidate.location = evidence.location;

  // Education and certifications are credentials, so preserve them verbatim.
  candidate.education = cloneResume(evidence).education;
  candidate.certifications = cloneResume(evidence).certifications;

  if ((candidate.workExperience?.length || 0) !== (evidence.workExperience?.length || 0)) {
    violations.push({ section: 'experience', message: 'Blocked an unsupported work-experience entry.' });
  }
  const rewrittenJobs = candidate.workExperience;
  candidate.workExperience = (evidence.workExperience || []).map((source, index) => {
    const rewritten = rewrittenEntry(evidence.workExperience, rewrittenJobs, index, (job) => normalize(`${job.company}|${job.role}`));
    return {
      ...source,
      bullets: validateBullets(rewritten?.bullets, source.bullets, evidenceText, 'experience', violations),
    };
  });

  if ((candidate.projects?.length || 0) !== (evidence.projects?.length || 0)) {
    violations.push({ section: 'projects', message: 'Blocked an unsupported generated project.' });
  }
  const rewrittenProjects = candidate.projects;
  candidate.projects = (evidence.projects || []).map((source, index) => {
    const rewritten = rewrittenEntry(evidence.projects, rewrittenProjects, index, (project) => normalize(project.title || ''));
    return {
      ...source,
      description: rewritten?.description && !hasUnsupportedClaim(rewritten.description, evidenceText)
        ? rewritten.description
        : source.description,
      bullets: validateBullets(rewritten?.bullets, source.bullets, evidenceText, 'projects', violations),
      techStack: filterSkills(
        [{ category: 'Project', count: rewritten?.techStack?.length || 0, list: rewritten?.techStack || [] }],
        [{ category: 'Project', count: source.techStack?.length || 0, list: source.techStack || [] }],
      )[0]?.list || source.techStack,
    };
  });

  const filteredSkills = filterSkills(
    candidate.skills,
    evidence.skills,
    [
      ...(evidence.evidenceDocument?.skills || []).map((skill) => skill.canonicalSkill),
      ...(evidence.projects || []).flatMap((project) => project.techStack || []),
    ],
  );
  const candidateSkillCount = (candidate.skills || []).reduce((sum, category) => sum + (category.list?.length || 0), 0);
  const filteredSkillCount = filteredSkills.reduce((sum, category) => sum + category.list.length, 0);
  if (filteredSkillCount < candidateSkillCount) {
    violations.push({ section: 'skills', message: 'Removed skills not supported by the original resume.' });
  }
  candidate.skills = filteredSkills.length > 0 ? filteredSkills : cloneResume(evidence).skills;

  candidate.additionalSections = (evidence.additionalSections || []).map((source, index) => ({
    ...source,
    bullets: validateBullets(
      candidate.additionalSections?.[index]?.bullets,
      source.bullets,
      evidenceText,
      'additional',
      violations,
    ),
  }));
  candidate.achievements = evidence.achievements;

  if (candidate.summary && hasUnsupportedClaim(candidate.summary, evidenceText)) {
    violations.push({ section: 'experience', message: 'Removed unsupported claims from the summary.' });
    candidate.summary = evidence.summary;
  }
  if (candidate.careerObjective && hasUnsupportedClaim(candidate.careerObjective, evidenceText)) {
    candidate.careerObjective = evidence.careerObjective;
  }

  return { resume: candidate, violations };
}
