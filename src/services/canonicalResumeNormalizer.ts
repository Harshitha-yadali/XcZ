import type {
  AdditionalSection,
  Certification,
  Education,
  Project,
  ResumeData,
  Skill,
  WorkExperience,
} from '../types/canonicalResume.ts';
import { parseResumeEvidence } from './resumeEvidenceExtractor.ts';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null;

const asText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
};

const asRecordArray = (value: unknown): UnknownRecord[] =>
  Array.isArray(value) ? value.map(asRecord).filter((item): item is UnknownRecord => Boolean(item)) : [];

const asStringArray = (value: unknown, splitPattern: RegExp = /\r?\n/): string[] => {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(splitPattern)
      : [];
  return [...new Set(values.map(asText).filter(Boolean))];
};

const normalizeBullets = (value: unknown): string[] =>
  asStringArray(value, /\r?\n|(?=\s*[\u2022\u25CF\u25E6\u25AA\-–—*]\s+)/)
    .map(item => item.replace(/^\s*[\u2022\u25CF\u25E6\u25AA\-–—*]\s+/, '').trim())
    .filter(Boolean);

const normalizeEducation = (value: unknown): Education[] => asRecordArray(value).map(item => ({
  degree: asText(item.degree),
  school: asText(item.school || item.institution || item.college),
  year: asText(item.year || item.graduationYear || item.date),
  cgpa: asText(item.cgpa || item.gpa) || undefined,
  location: asText(item.location) || undefined,
  field: asText(item.field || item.specialization) || undefined,
}));

const normalizeExperience = (value: unknown): WorkExperience[] => asRecordArray(value).map(item => ({
  role: asText(item.role || item.title || item.position),
  company: asText(item.company || item.organization || item.employer),
  year: asText(item.year || item.dates || item.duration),
  bullets: normalizeBullets(item.bullets || item.responsibilities || item.achievements),
  location: asText(item.location) || undefined,
}));

const normalizeProjects = (value: unknown): Project[] => asRecordArray(value).map(item => ({
  title: asText(item.title || item.name),
  bullets: normalizeBullets(item.bullets || item.points || item.highlights),
  githubUrl: asText(item.githubUrl || item.github || item.url) || undefined,
  description: asText(item.description || item.summary) || undefined,
  techStack: asStringArray(
    item.techStack || item.technologies || item.tools,
    /[,;|\r\n]+/,
  ),
}));

const normalizeSkills = (value: unknown): Skill[] => {
  if (Array.isArray(value)) {
    const grouped = value.map(asRecord).filter((item): item is UnknownRecord => Boolean(item));
    if (grouped.length > 0) {
      return grouped.map(item => {
        const list = asStringArray(item.list || item.skills || item.items, /[,;|\r\n]+/);
        return {
          category: asText(item.category || item.name) || 'Skills',
          count: list.length,
          list,
        };
      }).filter(group => group.list.length > 0);
    }
    const list = asStringArray(value, /[,;|\r\n]+/);
    return list.length > 0 ? [{ category: 'Skills', count: list.length, list }] : [];
  }

  const skillMap = asRecord(value);
  if (skillMap) {
    return Object.entries(skillMap).map(([category, items]) => {
      const list = asStringArray(items, /[,;|\r\n]+/);
      return { category, count: list.length, list };
    }).filter(group => group.list.length > 0);
  }

  const list = asStringArray(value, /[,;|\r\n]+/);
  return list.length > 0 ? [{ category: 'Skills', count: list.length, list }] : [];
};

const normalizeCertifications = (value: unknown): (string | Certification)[] => {
  if (!Array.isArray(value)) return asStringArray(value, /[,;|\r\n]+/);
  return value.map(item => {
    const text = asText(item);
    if (text) return text;
    const record = asRecord(item);
    if (!record) return null;
    const title = asText(record.title || record.name || record.certificate);
    const description = asText(record.description || record.issuer || record.provider);
    return title || description ? { title: title || description, description } : null;
  }).filter((item): item is string | Certification => item !== null);
};

const normalizeAdditionalSections = (value: unknown): AdditionalSection[] =>
  asRecordArray(value).map(item => ({
    title: asText(item.title || item.name),
    bullets: normalizeBullets(item.bullets || item.items || item.content),
  })).filter(item => item.title || item.bullets.length > 0);

/**
 * Converts parser and legacy resume variants into the strict canonical shape.
 * Source evidence is rebuilt from raw text rather than trusting client-provided
 * skill claims or offsets.
 */
export function normalizeCanonicalResume(value: unknown): ResumeData {
  const input = asRecord(value) || {};
  const suppliedEvidence = asRecord(input.evidenceDocument);
  const rawText = asText(suppliedEvidence?.rawText).slice(0, 100_000);

  return {
    name: asText(input.name || input.fullName),
    phone: asText(input.phone || input.phoneNumber),
    email: asText(input.email || input.emailAddress),
    linkedin: asText(input.linkedin || input.linkedinUrl),
    github: asText(input.github || input.githubUrl),
    location: asText(input.location) || undefined,
    targetRole: asText(input.targetRole || input.headline) || undefined,
    summary: asText(input.summary || input.professionalSummary) || undefined,
    careerObjective: asText(input.careerObjective || input.objective) || undefined,
    education: normalizeEducation(input.education),
    workExperience: normalizeExperience(input.workExperience || input.experience),
    projects: normalizeProjects(input.projects),
    skills: normalizeSkills(input.skills),
    certifications: normalizeCertifications(input.certifications),
    additionalSections: normalizeAdditionalSections(input.additionalSections),
    achievements: normalizeBullets(input.achievements),
    origin: asText(input.origin) || undefined,
    evidenceDocument: rawText ? parseResumeEvidence(rawText) : undefined,
  };
}
