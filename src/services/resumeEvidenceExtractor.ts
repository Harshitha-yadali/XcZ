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
} from '../types/resumeEvidence.ts';

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

/** Spelling variants of one skill, keyed by the lowercase variant as written. */
export const SKILL_ALIASES: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node js': 'Node.js',
  'react.js': 'React',
  reactjs: 'React',
  'vue.js': 'Vue',
  vuejs: 'Vue',
  nextjs: 'Next.js',
  'express.js': 'Express',
  expressjs: 'Express',
  'nest.js': 'NestJS',
  mongo: 'MongoDB',
  postgres: 'PostgreSQL',
  'ms sql': 'SQL Server',
  mssql: 'SQL Server',
  k8s: 'Kubernetes',
  gcp: 'Google Cloud',
  'google cloud platform': 'Google Cloud',
  'amazon web services': 'AWS',
  'microsoft azure': 'Azure',
  golang: 'Go',
  cpp: 'C++',
  html5: 'HTML',
  css3: 'CSS',
  'tailwind css': 'Tailwind',
  ml: 'Machine Learning',
  ai: 'Artificial Intelligence',
  genai: 'Generative AI',
  'gen ai': 'Generative AI',
  llms: 'LLM',
  'large language models': 'LLM',
  'natural language processing': 'NLP',
  sklearn: 'scikit-learn',
  'scikit learn': 'scikit-learn',
  'apache spark': 'Spark',
  'apache kafka': 'Kafka',
  powerbi: 'Power BI',
  'ms excel': 'Excel',
  'microsoft excel': 'Excel',
  rest: 'REST API',
  restful: 'REST API',
  'rest apis': 'REST API',
  'restful api': 'REST API',
  'restful apis': 'REST API',
  cicd: 'CI/CD',
  'ci cd': 'CI/CD',
  'ci-cd': 'CI/CD',
  oop: 'OOP',
  oops: 'OOP',
  'object oriented programming': 'OOP',
  'object-oriented programming': 'OOP',
  dsa: 'DSA',
  'data structures and algorithms': 'DSA',
  'data structures & algorithms': 'DSA',
  vscode: 'VS Code',
  'visual studio code': 'VS Code',
  'test-driven development': 'TDD',
  'end-to-end testing': 'E2E Testing',
};

/**
 * A technology that proves its parent skills: anyone who evidently wrote
 * Express code wrote JavaScript on Node.js. A parent counts only when the
 * source technology itself is grounded in the candidate's own text.
 */
export const IMPLIED_SKILLS: Record<string, readonly string[]> = {
  Express: ['Node.js', 'JavaScript'],
  NestJS: ['Node.js'],
  'Node.js': ['JavaScript'],
  TypeScript: ['JavaScript'],
  jQuery: ['JavaScript'],
  React: ['JavaScript', 'HTML', 'CSS'],
  Angular: ['JavaScript', 'HTML', 'CSS'],
  Vue: ['JavaScript', 'HTML', 'CSS'],
  'Next.js': ['React', 'JavaScript'],
  Django: ['Python'],
  Flask: ['Python'],
  FastAPI: ['Python'],
  Pandas: ['Python'],
  NumPy: ['Python'],
  'Spring Boot': ['Java'],
  Hibernate: ['Java'],
  Laravel: ['PHP'],
  'Ruby on Rails': ['Ruby'],
  TensorFlow: ['Machine Learning', 'Python'],
  PyTorch: ['Machine Learning', 'Python'],
  Keras: ['Machine Learning', 'Python'],
  'scikit-learn': ['Machine Learning', 'Python'],
  Tableau: ['Data Visualization'],
  'Power BI': ['Data Visualization'],
  MySQL: ['SQL'],
  PostgreSQL: ['SQL'],
  'SQL Server': ['SQL'],
  SQLite: ['SQL'],
  Docker: ['Containers'],
  Kubernetes: ['Containers'],
  Git: ['Version Control'],
};

const ENGLISH_WORD_ALIASES = new Set(['rest', 'restful', 'node', 'ai', 'ml', 'ts']);

const stripSkill = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#]+/g, '');
const ALIAS_BY_KEY = new Map(Object.entries(SKILL_ALIASES).map(([alias, canonical]) => [stripSkill(alias), canonical]));

/** One key per skill however it is spelled: "ReactJS", "React.js" and "react" all give "react". */
export const canonicalSkillKey = (skill: string): string => stripSkill(ALIAS_BY_KEY.get(stripSkill(skill)) || skill);

const IMPLIED_BY_KEY = new Map(Object.entries(IMPLIED_SKILLS).map(([source, parents]) => [canonicalSkillKey(source), parents]));

/** Parent skills proven by the given (already grounded) skills. */
export const impliedSkillsOf = (skills: Iterable<string>): string[] => {
  const out = new Set<string>();
  for (const skill of skills) IMPLIED_BY_KEY.get(canonicalSkillKey(skill))?.forEach(parent => out.add(parent));
  return [...out];
};

/** Ways a resume can show the skill: its spellings, plus technologies that imply it. */
export const evidencePhrasesFor = (skill: string): string[] => {
  const key = canonicalSkillKey(skill);
  const spellings = (k: string) => Object.entries(SKILL_ALIASES).filter(([, c]) => canonicalSkillKey(c) === k).flatMap(([a, c]) => [a, c]);
  const sources = Object.entries(IMPLIED_SKILLS)
    .filter(([, parents]) => parents.some(parent => canonicalSkillKey(parent) === key))
    .flatMap(([source]) => [source, ...spellings(canonicalSkillKey(source))]);
  return [...new Set([skill, ...spellings(key), ...sources])];
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
        .filter(([, canonical]) => normalizeSkillKey(canonical) === normalizeSkillKey(canonicalSkill))
        .map(([alias]) => alias)];
      for (const phrase of new Set(phrases)) {
        for (const occurrence of findExactOccurrences(rawText, phrase, section.contentStartIndex, section.contentEndIndex)) {
          // "the rest of", "each node": everyday words count only when written as a name.
          if (ENGLISH_WORD_ALIASES.has(phrase) && occurrence.sourceText === occurrence.sourceText.toLowerCase()) continue;
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

/**
 * Heading of the block the candidate confirms in the optimizer's Boost step.
 * It is appended after the uploaded text, so it survives every rebuild from rawText.
 */
export const CONFIRMED_DETAILS_HEADING = 'CANDIDATE-CONFIRMED DETAILS';
const CONFIRMED_SKILL_LINE = /^Confirmed skill: (.+?)(?: \| Used in (project|experience)?:? ?(.*))?$/;
const CONFIRMED_METRIC_LINE = /^Confirmed metric: (.+?) \| For: (.+)$/;
const bulletKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Credits what the candidate confirmed: skills as grounded, numbers inside the bullet they belong to. */
const applyConfirmedDetails = (doc: ResumeEvidenceDocument, rawText: string, blockStart: number) => {
  for (const line of splitSourceLines(rawText).filter(item => item.start > blockStart)) {
    const skill = line.text.match(CONFIRMED_SKILL_LINE);
    if (skill) {
      const name = skill[1].trim();
      const startIndex = line.start + 'Confirmed skill: '.length;
      doc.skills.push({
        canonicalSkill: SKILL_ALIASES[name.toLowerCase()] || name,
        sourceText: rawText.slice(startIndex, startIndex + name.length),
        sourceSection: skill[2] === 'project' ? 'projects' : skill[2] === 'experience' ? 'experience' : 'skills',
        startIndex,
        endIndex: startIndex + name.length,
      });
      continue;
    }
    const metric = line.text.match(CONFIRMED_METRIC_LINE);
    if (!metric) continue;
    const target = bulletKey(metric[2]);
    const bullet = target && doc.bullets.find(item => bulletKey(item.text).startsWith(target));
    if (bullet) bullet.text = `${bullet.text.replace(/[.;\s]+$/, '')}; ${metric[1].trim()}`;
  }
};

export const parseResumeEvidence = (rawText: string): ResumeEvidenceDocument => {
  const blockStart = rawText.indexOf(`
${CONFIRMED_DETAILS_HEADING}
`);
  // The resume's own sections end where the confirmed block begins.
  const resumeText = blockStart >= 0 ? rawText.slice(0, blockStart) : rawText;
  const lines = splitSourceLines(resumeText);
  const sections = buildSections(resumeText, lines);
  const bullets = extractBullets(resumeText, lines, sections);
  const skills = extractGroundedSkills(resumeText, sections);
  const projects = extractProjects(resumeText, lines, sections, bullets, skills);
  const doc = { rawText, sections, bullets, skills, projects };
  if (blockStart >= 0) applyConfirmedDetails(doc, rawText, blockStart);
  return doc;
};
