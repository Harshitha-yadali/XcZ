import type { ResumeData, Skill } from '../types/resume';

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

const hasUnsupportedNumber = (candidate: string, evidenceText: string): boolean => {
  const evidenceClaims = new Set(numericClaims(evidenceText).map(normalize));
  return numericClaims(candidate).some((claim) => !evidenceClaims.has(normalize(claim)));
};

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
    if (hasUnsupportedNumber(rewrittenBullet, evidenceText)) {
      violations.push({
        section,
        message: `Removed an unsupported numeric claim from ${section}.`,
      });
      return originalBullet;
    }
    return rewrittenBullet;
  });
}

function filterSkills(candidate: Skill[] | undefined, evidence: Skill[] | undefined): Skill[] {
  const allowed = new Set(
    (evidence || []).flatMap((category) => category.list || []).map(normalize),
  );

  return (candidate || [])
    .map((category) => {
      const list = (category.list || []).filter((skill) => allowed.has(normalize(skill)));
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
  candidate.workExperience = (evidence.workExperience || []).map((source, index) => {
    const rewritten = candidate.workExperience?.[index];
    return {
      ...source,
      bullets: validateBullets(rewritten?.bullets, source.bullets, evidenceText, 'experience', violations),
    };
  });

  if ((candidate.projects?.length || 0) !== (evidence.projects?.length || 0)) {
    violations.push({ section: 'projects', message: 'Blocked an unsupported generated project.' });
  }
  candidate.projects = (evidence.projects || []).map((source, index) => {
    const rewritten = candidate.projects?.[index];
    return {
      ...source,
      description: rewritten?.description && !hasUnsupportedNumber(rewritten.description, evidenceText)
        ? rewritten.description
        : source.description,
      bullets: validateBullets(rewritten?.bullets, source.bullets, evidenceText, 'projects', violations),
      techStack: filterSkills(
        [{ category: 'Project', count: rewritten?.techStack?.length || 0, list: rewritten?.techStack || [] }],
        [{ category: 'Project', count: source.techStack?.length || 0, list: source.techStack || [] }],
      )[0]?.list || source.techStack,
    };
  });

  const filteredSkills = filterSkills(candidate.skills, evidence.skills);
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

  if (candidate.summary && hasUnsupportedNumber(candidate.summary, evidenceText)) {
    violations.push({ section: 'experience', message: 'Removed unsupported numbers from the summary.' });
    candidate.summary = evidence.summary;
  }
  if (candidate.careerObjective && hasUnsupportedNumber(candidate.careerObjective, evidenceText)) {
    candidate.careerObjective = evidence.careerObjective;
  }

  return { resume: candidate, violations };
}
