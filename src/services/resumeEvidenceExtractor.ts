import {
  ALL_HARD_SKILLS,
  ALL_TOOL_SKILLS,
  CONTACT_PROFILE_WORDS,
  SKILL_DISPLAY_NAMES,
} from '../constants/skillsTaxonomy.ts';
import type {
  BulletEvidence,
  ProjectEvidence,
  ResumeEvidenceDocument,
  ResumeSectionKind,
  SectionEvidence,
  SkillEvidence,
} from '../types/resumeEvidence';

export const SECTION_ALIASES: Record<Exclude<ResumeSectionKind, 'header'>, readonly string[]> = {
  summary: ['summary', 'professional summary', 'career summary', 'objective', 'career objective', 'profile', 'about me'],
  skills: ['skills', 'technical skills', 'core competencies', 'technologies', 'expertise'],
  experience: ['experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'internship', 'internships'],
  projects: ['projects', 'academic projects', 'key projects', 'personal projects', 'notable projects', 'portfolio'],
  education: ['education', 'academic background', 'academic qualifications', 'qualifications'],
  certifications: ['certifications', 'certification', 'licenses and certifications', 'licenses', 'certificates', 'credentials'],
  achievements: ['achievements', 'accomplishments', 'awards', 'honors'],
};

export const BULLET_PATTERN = /^\s*([\u2022\u25CF\u25E6\u25AA\-–—*])\s+/;

export const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  nodejs: 'Node.js',
  'restful api': 'REST API',
  'restful apis': 'REST API',
  cicd: 'CI/CD',
  'ci cd': 'CI/CD',
  'object oriented programming': 'OOP',
};

interface SourceLine {
  text: string;
  start: number;
  end: number;
  endWithNewline: number;
}

const normalizeHeading = (value: string) => value
  .trim()
  .replace(/[:\-–—]+\s*$/, '')
  .replace(/\s+/g, ' ')
  .toLowerCase();

const normalizeSkillKey = (value: string) => value
  .toLowerCase()
  .replace(/[._/\-\s]+/g, '')
  .trim();

const splitSourceLines = (rawText: string): SourceLine[] => {
  const lines: SourceLine[] = [];
  let start = 0;
  while (start <= rawText.length) {
    const newline = rawText.indexOf('\n', start);
    const endWithNewline = newline === -1 ? rawText.length : newline + 1;
    const rawLine = rawText.slice(start, newline === -1 ? rawText.length : newline);
    const text = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    lines.push({ text, start, end: start + text.length, endWithNewline });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
};

export const detectResumeSectionHeading = (line: string): ResumeSectionKind | null => {
  const normalized = normalizeHeading(line);
  if (!normalized || normalized.length > 60) return null;
  for (const [section, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) return section as ResumeSectionKind;
  }
  return null;
};

const buildSections = (rawText: string, lines: SourceLine[]) => {
  const sections: ResumeEvidenceDocument['sections'] = {};
  let active: { kind: ResumeSectionKind; heading: SourceLine; contentStart: number } | null = null;

  const closeActive = (contentEnd: number) => {
    if (!active) return;
    const endIndex = Math.max(active.heading.end, contentEnd);
    sections[active.kind] = {
      heading: active.heading.text.trim(),
      sourceText: rawText.slice(active.heading.start, endIndex),
      sourceSection: active.kind,
      startIndex: active.heading.start,
      endIndex,
      contentStartIndex: active.contentStart,
      contentEndIndex: contentEnd,
    };
  };

  for (const line of lines) {
    const kind = detectResumeSectionHeading(line.text);
    if (!kind) continue;
    closeActive(line.start);
    active = { kind, heading: line, contentStart: line.endWithNewline };
  }
  closeActive(rawText.length);
  return sections;
};

const lineIsEntryBoundary = (lines: SourceLine[], index: number, section: ResumeSectionKind) => {
  const value = lines[index]?.text.trim() || '';
  if (!value || BULLET_PATTERN.test(lines[index].text)) return false;
  if (/^\s{2,}\S/.test(lines[index].text)) return false;
  if (detectResumeSectionHeading(value)) return true;
  if (value.length > 120) return false;

  const next = lines.slice(index + 1).find(line => line.text.trim());
  if (!next) return false;
  const nextIsBullet = BULLET_PATTERN.test(next.text);
  const nextIsTech = /^(?:technologies?|tech(?:nology)?\s*stack|tools?|built\s+with)\s*:/i.test(next.text.trim());
  if (section === 'projects') {
    const looksLikeTitle = /^[A-Z0-9]/.test(value) && value.split(/\s+/).length <= 12 && !/[.!?]$/.test(value);
    return looksLikeTitle && (nextIsBullet || nextIsTech);
  }
  return nextIsBullet && (/\b(?:19|20)\d{2}\b/.test(value) || /\bat\b|\||\b(?:intern|engineer|developer|analyst|manager|associate|trainee)\b/i.test(value));
};

const extractBullets = (
  rawText: string,
  lines: SourceLine[],
  sections: ResumeEvidenceDocument['sections'],
): BulletEvidence[] => {
  const bullets: BulletEvidence[] = [];
  for (const sectionKind of ['experience', 'projects'] as const) {
    const section = sections[sectionKind];
    if (!section) continue;
    const sectionLines = lines.filter(line => line.start >= section.contentStartIndex && line.start < section.contentEndIndex);
    let active: { lineIndex: number; start: number; end: number; marker: string; parts: string[] } | null = null;

    const closeBullet = () => {
      if (!active) return;
      const sourceText = rawText.slice(active.start, active.end);
      bullets.push({
        text: active.parts.join(' ').replace(/\s+/g, ' ').trim(),
        marker: active.marker,
        sourceText,
        sourceSection: sectionKind,
        startIndex: active.start,
        endIndex: active.end,
      });
      active = null;
    };

    sectionLines.forEach((line, index) => {
      const match = line.text.match(BULLET_PATTERN);
      if (match) {
        closeBullet();
        active = {
          lineIndex: index,
          start: line.start,
          end: line.end,
          marker: match[1],
          parts: [line.text.replace(BULLET_PATTERN, '').trim()],
        };
        return;
      }
      if (!active || !line.text.trim()) return;
      if (lineIsEntryBoundary(sectionLines, index, sectionKind)) {
        closeBullet();
        return;
      }
      active.parts.push(line.text.trim());
      active.end = line.end;
    });
    closeBullet();
  }
  return bullets;
};

const hasTokenBoundaries = (text: string, start: number, end: number) => {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  return (!before || !/[A-Za-z0-9]/.test(before)) && (!after || !/[A-Za-z0-9]/.test(after));
};

const findExactOccurrences = (rawText: string, phrase: string, start: number, end: number) => {
  const results: Array<{ start: number; end: number; sourceText: string }> = [];
  const haystack = rawText.slice(start, end).toLowerCase();
  const needle = phrase.toLowerCase();
  let cursor = 0;
  while (needle && cursor < haystack.length) {
    const localStart = haystack.indexOf(needle, cursor);
    if (localStart === -1) break;
    const absoluteStart = start + localStart;
    const absoluteEnd = absoluteStart + phrase.length;
    if (hasTokenBoundaries(rawText, absoluteStart, absoluteEnd)) {
      results.push({ start: absoluteStart, end: absoluteEnd, sourceText: rawText.slice(absoluteStart, absoluteEnd) });
    }
    cursor = localStart + Math.max(needle.length, 1);
  }
  return results;
};

const canonicalSkillNames = () => {
  const names = new Map<string, string>();
  const additionalDisplayNames: Record<string, string> = {
    mysql: 'MySQL', postgresql: 'PostgreSQL', mongodb: 'MongoDB', python: 'Python',
    flask: 'Flask', postman: 'Postman', docker: 'Docker', react: 'React', rust: 'Rust', go: 'Go',
    'rest api': 'REST API',
  };
  [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS].forEach(skill => {
    if (!CONTACT_PROFILE_WORDS.has(skill.toLowerCase())) {
      const displayName = SKILL_DISPLAY_NAMES[skill.toLowerCase()] || additionalDisplayNames[skill.toLowerCase()] || skill.replace(/\b\w/g, value => value.toUpperCase());
      names.set(normalizeSkillKey(skill), displayName);
    }
  });
  Object.entries(SKILL_ALIASES).forEach(([alias, canonical]) => names.set(normalizeSkillKey(alias), canonical));
  return names;
};

const extractSkillsFromSkillsSection = (
  rawText: string,
  section: SectionEvidence,
): SkillEvidence[] => {
  const evidence: SkillEvidence[] = [];
  const content = rawText.slice(section.contentStartIndex, section.contentEndIndex);
  const tokenPattern = /[^,;|\r\n]+/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(content)) !== null) {
    const rawSegment = match[0];
    const colon = rawSegment.lastIndexOf(':');
    const candidateStart = colon >= 0 ? colon + 1 : 0;
    const candidate = rawSegment.slice(candidateStart).trim().replace(/^[\u2022\u25CF\u25E6\u25AA\-–—*]\s*/, '').trim();
    if (!candidate || candidate.length > 45 || /^(?:languages?|frameworks?|tools?|databases?|technologies?|skills?)$/i.test(candidate)) continue;
    const localOffset = rawSegment.indexOf(candidate, candidateStart);
    if (localOffset < 0) continue;
    const startIndex = section.contentStartIndex + match.index + localOffset;
    const endIndex = startIndex + candidate.length;
    const alias = SKILL_ALIASES[candidate.toLowerCase()];
    evidence.push({
      canonicalSkill: alias || candidate,
      sourceText: rawText.slice(startIndex, endIndex),
      sourceSection: 'skills',
      startIndex,
      endIndex,
    });
  }
  return evidence;
};

const extractGroundedSkills = (
  rawText: string,
  sections: ResumeEvidenceDocument['sections'],
): SkillEvidence[] => {
  const evidence: SkillEvidence[] = [];
  if (sections.skills) evidence.push(...extractSkillsFromSkillsSection(rawText, sections.skills));

  const names = canonicalSkillNames();
  for (const sectionKind of ['skills', 'projects', 'experience'] as const) {
    const section = sections[sectionKind];
    if (!section) continue;
    for (const [key, canonicalSkill] of names) {
      const phrases = [canonicalSkill, ...Object.entries(SKILL_ALIASES)
        .filter(([, canonical]) => normalizeSkillKey(canonical) === key)
        .map(([alias]) => alias)];
      for (const phrase of new Set(phrases)) {
        for (const occurrence of findExactOccurrences(rawText, phrase, section.contentStartIndex, section.contentEndIndex)) {
          evidence.push({
            canonicalSkill,
            sourceText: occurrence.sourceText,
            sourceSection: sectionKind,
            startIndex: occurrence.start,
            endIndex: occurrence.end,
          });
        }
      }
    }
  }

  const seen = new Set<string>();
  return evidence
    .filter(item => rawText.slice(item.startIndex, item.endIndex) === item.sourceText)
    .filter(item => {
      const key = `${item.startIndex}:${item.endIndex}:${normalizeSkillKey(item.canonicalSkill)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const extractProjects = (
  rawText: string,
  lines: SourceLine[],
  sections: ResumeEvidenceDocument['sections'],
  bullets: BulletEvidence[],
  skills: SkillEvidence[],
): ProjectEvidence[] => {
  const section = sections.projects;
  if (!section) return [];
  const sectionLines = lines.filter(line => line.start >= section.contentStartIndex && line.start < section.contentEndIndex);
  const projectBullets = bullets.filter(bullet => bullet.sourceSection === 'projects');
  const titleLines = sectionLines.filter((line, index) => {
    const value = line.text.trim();
    if (!value || BULLET_PATTERN.test(line.text) || /^(?:technologies?|tech(?:nology)?\s*stack|tools?|built\s+with)\s*:/i.test(value)) return false;
    return lineIsEntryBoundary(sectionLines, index, 'projects');
  });

  if (titleLines.length === 0 && projectBullets.length > 0) {
    titleLines.push({ text: 'Projects', start: section.contentStartIndex, end: section.contentStartIndex, endWithNewline: section.contentStartIndex });
  }

  return titleLines.map((titleLine, index) => {
    const nextStart = titleLines[index + 1]?.start ?? section.contentEndIndex;
    const startIndex = titleLine.start;
    const endIndex = nextStart;
    const technologies = skills.filter(skill => skill.sourceSection === 'projects' && skill.startIndex >= startIndex && skill.endIndex <= endIndex);
    const groupedBullets = projectBullets.filter(bullet => bullet.startIndex >= startIndex && bullet.endIndex <= endIndex);
    return {
      title: titleLine.text.trim(),
      technologies,
      bullets: groupedBullets,
      sourceText: rawText.slice(startIndex, endIndex),
      sourceSection: 'projects',
      startIndex,
      endIndex,
    };
  });
};

export const parseResumeEvidence = (rawText: string): ResumeEvidenceDocument => {
  const lines = splitSourceLines(rawText);
  const sections = buildSections(rawText, lines);
  const bullets = extractBullets(rawText, lines, sections);
  const skills = extractGroundedSkills(rawText, sections);
  const projects = extractProjects(rawText, lines, sections, bullets, skills);
  return { rawText, sections, bullets, skills, projects };
};
