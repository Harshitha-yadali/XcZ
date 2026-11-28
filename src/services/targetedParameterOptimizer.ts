import { ResumeData } from '../types/resume';
import { ParameterScore } from './jdScoringEngine';
import { GapItem } from './gapClassificationEngine';
import { openrouter } from './aiProxyService';
import {
  ALL_HARD_SKILLS,
  ALL_TOOL_SKILLS,
  CONTACT_PROFILE_WORDS,
  categorizeSkill,
  formatSkillName,
  SKILL_CATEGORIES,
  SKILL_DISPLAY_NAMES,
} from '../constants/skillsTaxonomy';
import { impliedSkillsOf } from './resumeEvidenceExtractor';
import type { RefinementSection } from '../config/jdOptimizationTiers';

export interface OptimizationChange {
  parameterId: number;
  section: string;
  before: string;
  after: string;
  description: string;
}

export interface TargetedOptimizationResult {
  optimizedResume: ResumeData;
  changes: OptimizationChange[];
  parametersFixed: number[];
}

export interface TargetedOptimizationOptions {
  model?: string;
  /** Tried once when `model` errors. */
  fallbackModel?: string;
  /** Sections the AI rewrites this pass (tier work). Empty: deterministic fixes only. */
  sections?: readonly RefinementSection[];
}

function extractOptimizationKeywordsFromJD(jobDescription: string): string[] {
  const jdLower = jobDescription.toLowerCase();
  const techFromTaxonomy = [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS]
    .filter(s => !CONTACT_PROFILE_WORDS.has(s.toLowerCase()))
    .filter(s => jdLower.includes(s.toLowerCase()))
    .map(s => s.toLowerCase());

  const capitalizedTerms: string[] = [];
  const techWordRegex = /\b([A-Z][a-zA-Z0-9+#.]+(?:\.[jJ][sS])?)\b/g;
  let match: RegExpExecArray | null;
  while ((match = techWordRegex.exec(jobDescription)) !== null) {
    const word = match[1].toLowerCase();
    if (word.length >= 2 && word.length <= 30 && !CONTACT_PROFILE_WORDS.has(word)) {
      capitalizedTerms.push(word);
    }
  }

  return [...new Set([...techFromTaxonomy, ...capitalizedTerms])];
}

function parseKeywordsFromGapSuggestions(gaps: GapItem[], parameterIds: number[]): string[] {
  const out: string[] = [];
  const target = new Set(parameterIds);

  for (const gap of gaps) {
    if (!target.has(gap.parameterId)) continue;
    for (const suggestion of gap.suggestions || []) {
      const afterColon = suggestion.includes(':') ? suggestion.split(':').slice(1).join(':') : suggestion;
      const chunks = afterColon
        .split(/[,\n]/)
        .map(s => s.replace(/["'`]/g, '').trim())
        .filter(Boolean);

      for (const chunk of chunks) {
        const cleaned = chunk
          .replace(/^add\s+/i, '')
          .replace(/^missing\s+/i, '')
          .replace(/^skills?\s+/i, '')
          .replace(/^keywords?\s+/i, '')
          .trim()
          .toLowerCase();
        if (cleaned.length >= 2 && cleaned.length <= 35) {
          out.push(cleaned);
        }
      }
    }
  }

  return [...new Set(out)];
}

function addMissingKeywords(
  resume: ResumeData,
  _jobDescription: string,
  explicitKeywords: string[] = []
): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdKeywords = extractOptimizationKeywordsFromJD(_jobDescription);
  const candidateSkills = [...new Set([
    ...jdKeywords.map(skill => canonicalizeSkillLabel(skill)),
    ...explicitKeywords.map(skill => canonicalizeSkillLabel(skill)),
  ])];
  const groundedSkills = extractSkillsFromResumeEvidence(resume);
  // Express in a project proves Node.js; the parent may be listed when the JD asks for it.
  const evidenceSkills = buildCanonicalSkillSet([...groundedSkills, ...impliedSkillsOf(groundedSkills)]);
  const structuredSkills = buildCanonicalSkillSet(
    resume.skills?.flatMap(category => category.list || []) || []
  );

  const listedText = (resume.skills?.flatMap(category => category.list || []) || []).join(', ');
  const missingSkills = candidateSkills.filter(skill => {
    if (!skill || skill.length < 2) return false;
    const normalized = skill.toLowerCase();
    if (CONTACT_PROFILE_WORDS.has(normalized)) return false;
    if (!evidenceSkills.has(normalized)) return false;
    return !structuredSkills.has(normalized) && !skillAppearsInText(listedText, normalized);
  });

  if (missingSkills.length === 0) return changes;

  if (!resume.skills) resume.skills = [];
  const existingLower = new Set(
    resume.skills.flatMap(category => (category.list || []).map(skill => canonicalizeSkillLabel(skill).toLowerCase()))
  );

  missingSkills.forEach(skill => {
    const normalized = skill.toLowerCase();
    if (existingLower.has(normalized)) return;

    const targetCategory = ensureSkillCategory(resume, inferSkillBucket(skill));
    targetCategory.list.push(skill);
    targetCategory.count = targetCategory.list.length;
    existingLower.add(normalized);
    changes.push({
      parameterId: 6,
      section: 'skills',
      before: '',
      after: skill,
      description: `Added evidence-backed JD skill "${skill}" to ${targetCategory.category}`,
    });
  });

  return changes;
}

function alignRoleTitleWithJD(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdLower = jobDescription.toLowerCase();
  const titleMatch = jdLower.match(/(?:looking for|hiring|role of|position:?)\s*([^\n.]+)/i);
  const rawTitle = titleMatch ? titleMatch[1].trim() : '';

  const cleanedTitle = rawTitle
    .replace(/\b(?:at|for|with|in)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const hasValidTitle = cleanedTitle.length >= 3;
  if (!hasValidTitle) return changes;

  const toTitleCase = (text: string) => text
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const jdRoleTitle = toTitleCase(cleanedTitle);

  const oldTargetRole = resume.targetRole || '';
  if (!oldTargetRole || !oldTargetRole.toLowerCase().includes(cleanedTitle.toLowerCase())) {
    resume.targetRole = jdRoleTitle;
    changes.push({
      parameterId: 9,
      section: 'targetRole',
      before: oldTargetRole,
      after: resume.targetRole,
      description: `Aligned target role with JD title "${jdRoleTitle}"`,
    });
  }

  const roleKeywords = cleanedTitle
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4);

  if (roleKeywords.length === 0) return changes;

  const summary = (resume.summary || '').trim();
  const summaryLower = summary.toLowerCase();
  const missingKeywords = roleKeywords.filter(word => !summaryLower.includes(word.toLowerCase()));

  if (resume.summary && missingKeywords.length > 0) {
    const oldSummary = resume.summary;
    resume.summary = `${resume.summary.replace(/\.?\s*$/, '')}. Targeting ${jdRoleTitle} responsibilities.`;
    changes.push({
      parameterId: 9,
      section: 'summary',
      before: oldSummary,
      after: resume.summary,
      description: `Added JD role-title alignment phrase "${jdRoleTitle}" to summary`,
    });
  }

  return changes;
}

function fixBulletFormatting(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];

  const fix = (bullet: string, section: string): string => {
    let fixed = bullet.replace(/\s{2,}/g, ' ').trim();
    if (fixed[0] && fixed[0] !== fixed[0].toUpperCase()) {
      fixed = fixed[0].toUpperCase() + fixed.slice(1);
    }
    if (!fixed.endsWith('.') && !fixed.endsWith('!') && !fixed.endsWith('?')) {
      fixed = fixed + '.';
    }
    fixed = fixed.replace(/\.{2,}/g, '.').replace(/\s+\./g, '.');

    if (fixed !== bullet) {
      changes.push({ parameterId: 4, section, before: bullet, after: fixed, description: 'Fixed bullet formatting' });
    }
    return fixed;
  };

  resume.workExperience?.forEach(exp => {
    exp.bullets = exp.bullets?.map(b => fix(b, 'experience')) || [];
  });
  resume.projects?.forEach(proj => {
    proj.bullets = proj.bullets?.map(b => fix(b, 'projects')) || [];
  });

  return changes;
}

function addProjectTechStacks(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdLower = jobDescription.toLowerCase();
  const jdTech = new Set(
    [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS]
      .map(skill => canonicalizeSkillLabel(skill).toLowerCase())
      .filter(skill => !CONTACT_PROFILE_WORDS.has(skill))
      .filter(skill => jdLower.includes(skill))
  );
  const dedupeKeepOrder = (items: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of items) {
      const key = item.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  };

  if (!resume.projects || resume.projects.length === 0) {
    return changes;
  }

  resume.projects?.forEach(proj => {
    const projectText = [proj.title, ...(proj.bullets || []), ...(proj.techStack || [])].join(' ');
    const projectEvidenceSkills = extractSkillsFromTextEvidence(projectText);
    if (projectEvidenceSkills.length === 0) return;

    const orderedEvidenceSkills = [
      ...projectEvidenceSkills.filter(skill => jdTech.has(skill.toLowerCase())),
      ...projectEvidenceSkills.filter(skill => !jdTech.has(skill.toLowerCase())),
    ];
    const uniqueEvidenceSkills = dedupeKeepOrder(orderedEvidenceSkills);

    if (!proj.techStack || proj.techStack.length === 0) {
      proj.techStack = uniqueEvidenceSkills.slice(0, 6);
      if (proj.techStack.length > 0) {
        changes.push({
          parameterId: 20,
          section: 'projects',
          before: '',
          after: proj.techStack.join(', '),
          description: `Added evidence-backed tech stack to "${proj.title}"`,
        });
      }
      return;
    }

    const existingTech = buildCanonicalSkillSet(proj.techStack);
    const missingEvidenceSkills = uniqueEvidenceSkills.filter(skill => !existingTech.has(skill.toLowerCase()));
    if (missingEvidenceSkills.length === 0) return;

    const before = proj.techStack.join(', ');
    proj.techStack = dedupeKeepOrder([...proj.techStack, ...missingEvidenceSkills.slice(0, 5)]);
    changes.push({
      parameterId: 20,
      section: 'projects',
      before,
      after: proj.techStack.join(', '),
      description: `Extended "${proj.title}" tech stack using project evidence`,
    });
  });

  return changes;
}

type SkillBucketName =
  | 'Languages'
  | 'Frontend'
  | 'Backend'
  | 'Databases'
  | 'Cloud/DevOps'
  | 'AI/ML'
  | 'Tools'
  | 'Core Competencies';

const SKILL_BUCKET_ORDER: SkillBucketName[] = [
  'Languages',
  'Frontend',
  'Backend',
  'Databases',
  'Cloud/DevOps',
  'AI/ML',
  'Tools',
  'Core Competencies',
];

const SKILL_BUCKET_MINIMUMS: Partial<Record<SkillBucketName, number>> = {
  'Languages': 2,
  'Frontend': 1,
  'Backend': 1,
  'Databases': 1,
  'Cloud/DevOps': 1,
  'AI/ML': 1,
  'Tools': 2,
  'Core Competencies': 2,
};

function canonicalizeSkillLabel(skill: string): string {
  const normalized = skill.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  const exactMap: Record<string, string> = {
    'nodejs': 'Node.js',
    'node.js': 'Node.js',
    'react.js': 'React',
    'nextjs': 'Next.js',
    'next.js': 'Next.js',
    'express.js': 'Express',
    'golang': 'Go',
    'ms teams': 'MS Teams',
    'teams': 'MS Teams',
    'genrative ai': 'Generative AI',
    'generative ai': 'Generative AI',
    'machine learning': 'Machine Learning',
    'deep learning': 'Deep Learning',
    'tensorflow': 'TensorFlow',
    'pytorch': 'PyTorch',
    'nlp': 'NLP',
    'sql': 'SQL',
    'postgresql': 'PostgreSQL',
    'postgres': 'PostgreSQL',
    'html5': 'HTML5',
    'css3': 'CSS3',
    'aws': 'AWS',
    'azure': 'Azure',
    'gcp': 'GCP',
    'git': 'Git',
    'github': 'GitHub',
    'github actions': 'GitHub Actions',
    'gitlab ci': 'GitLab CI',
    'jira': 'Jira',
    'sap fiori': 'SAP Fiori',
    'sapui5': 'SAPUI5',
    'ui5': 'UI5',
    '.net': '.NET',
    'c#': 'C#',
    'c++': 'C++',
  };

  if (exactMap[lower]) return exactMap[lower];
  if (/^html$/i.test(normalized)) return 'HTML5';
  if (/^css$/i.test(normalized)) return 'CSS3';
  if (/^javascript$/i.test(normalized)) return 'JavaScript';
  if (/^typescript$/i.test(normalized)) return 'TypeScript';

  if (SKILL_DISPLAY_NAMES[lower]) return SKILL_DISPLAY_NAMES[lower];

  // A word with capitals of its own (Spring MVC, OAuth) is written as the user wrote it.
  // ponytail: all-capital words over five letters are taken as shouting, not acronyms.
  return normalized
    .split(' ')
    .map(word => (/[A-Z]/.test(word.slice(1)) && !/^[A-Z]{6,}$/.test(word)
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join(' ');
}

function expandCompositeSkillLabel(skill: string): string[] {
  const normalized = skill.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  // CI/CD and the like are one skill.
  const explicitParts = normalized
    .replace(/\b(ci|tcp|ui|pl|a|i|pub)\/(cd|ip|ux|sql|b|o|sub)\b/gi, '$1~$2')
    .split(/[|,/]/)
    .map(part => part.replace(/\b(ci|tcp|ui|pl|a|i|pub)~/i, '$1/').trim())
    .filter(Boolean);
  if (explicitParts.length > 1) {
    return explicitParts;
  }

  const lower = normalized.toLowerCase();
  const heuristicMatches: string[] = [];
  if (/\bsap\s*fiori\b/i.test(lower)) heuristicMatches.push('SAP Fiori');
  if (/\bsapui5\b|\bui5\b/i.test(lower)) heuristicMatches.push('UI5');

  if (heuristicMatches.length > 1) {
    return heuristicMatches;
  }

  return [normalized];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function skillAppearsInText(text: string, skill: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedSkill = skill.toLowerCase().trim();
  if (!normalizedSkill) return false;

  const escaped = escapeRegExp(normalizedSkill);
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escaped}($|[^a-z0-9+#])`, 'i');
  return pattern.test(normalizedText);
}

function collectResumeEvidenceText(resume: ResumeData): string {
  return [
    resume.targetRole || '',
    resume.summary || '',
    ...(resume.skills?.flatMap(category => category.list || []) || []),
    ...(resume.workExperience?.flatMap(experience => [
      experience.role || '',
      experience.company || '',
      ...(experience.bullets || []),
    ]) || []),
    ...(resume.projects?.flatMap(project => [
      project.title || '',
      ...(project.bullets || []),
      ...(project.techStack || []),
    ]) || []),
    ...(resume.education?.flatMap(education => [
      education.degree || '',
      education.school || '',
    ]) || []),
  ]
    .join('\n')
    .toLowerCase();
}

function extractSkillsFromResumeEvidence(resume: ResumeData): string[] {
  return extractSkillsFromTextEvidence(collectResumeEvidenceText(resume));
}

function extractSkillsFromTextEvidence(text: string): string[] {
  const evidenceText = text.toLowerCase();
  const extracted = new Set<string>();
  const candidates = [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS];

  for (const candidate of candidates) {
    if (CONTACT_PROFILE_WORDS.has(candidate.toLowerCase())) continue;
    if (skillAppearsInText(evidenceText, candidate)) {
      extracted.add(canonicalizeSkillLabel(formatSkillName(candidate)));
    }
  }

  const customHeuristics: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bsap\s*fiori\b/i, label: 'SAP Fiori' },
    { pattern: /\bsapui5\b/i, label: 'SAPUI5' },
    { pattern: /\bui5\b/i, label: 'UI5' },
    { pattern: /\bdata structures?\b/i, label: 'Data Structures' },
    { pattern: /\balgorithms?\b/i, label: 'Algorithms' },
    { pattern: /\boops?\b|\bobject oriented programming\b/i, label: 'OOP' },
    { pattern: /\bagile methodologies?\b/i, label: 'Agile Methodologies' },
  ];

  for (const heuristic of customHeuristics) {
    if (heuristic.pattern.test(evidenceText)) {
      extracted.add(canonicalizeSkillLabel(heuristic.label));
    }
  }

  return Array.from(extracted);
}

function inferSkillBucket(skill: string): SkillBucketName {
  const normalizedSkill = canonicalizeSkillLabel(skill);
  const lower = normalizedSkill.toLowerCase();
  const taxonomyCategory = categorizeSkill(lower);

  switch (taxonomyCategory) {
    case SKILL_CATEGORIES.PROGRAMMING_LANGUAGES:
      return 'Languages';
    case SKILL_CATEGORIES.FRONTEND_TECHNOLOGIES:
      return 'Frontend';
    case SKILL_CATEGORIES.BACKEND_TECHNOLOGIES:
      return 'Backend';
    case SKILL_CATEGORIES.DATABASES:
      return 'Databases';
    case SKILL_CATEGORIES.CLOUD_AND_DEVOPS:
      return 'Cloud/DevOps';
    case SKILL_CATEGORIES.DATA_SCIENCE_AND_ML:
      return 'AI/ML';
    case SKILL_CATEGORIES.SOFT_SKILLS:
      return 'Core Competencies';
    case SKILL_CATEGORIES.TOOLS_AND_PLATFORMS:
    case SKILL_CATEGORIES.TESTING_AND_QA:
      return 'Tools';
    default:
      break;
  }

  if (/\bsap\s*fiori\b|\bsapui5\b|\bui5\b|\bhtml\b|\bcss\b|\bux\b|\bui\b/i.test(lower)) {
    return 'Frontend';
  }
  if (/\bdata structures?\b|\balgorithms?\b|\boop\b|\bproblem solving\b|\bagile\b|\bscrum\b/i.test(lower)) {
    return 'Core Competencies';
  }

  return 'Tools';
}

function addUniqueSkill(bucketMap: Record<SkillBucketName, string[]>, bucket: SkillBucketName, skill: string) {
  const normalizedSkill = canonicalizeSkillLabel(skill);
  if (!bucketMap[bucket].some(existing => existing.toLowerCase() === normalizedSkill.toLowerCase())) {
    bucketMap[bucket].push(normalizedSkill);
  }
}

function buildCanonicalSkillSet(skills: string[]): Set<string> {
  return new Set(
    skills
      .map(skill => canonicalizeSkillLabel(skill).toLowerCase())
      .filter(Boolean)
  );
}

function ensureSkillCategory(resume: ResumeData, bucket: SkillBucketName) {
  if (!resume.skills) resume.skills = [];

  let category = resume.skills.find(existing => existing.category === bucket);
  if (!category) {
    category = { category: bucket, count: 0, list: [] };
    resume.skills.push(category);
  }

  return category;
}

const VALID_SKILL_BUCKETS = new Set<SkillBucketName>(SKILL_BUCKET_ORDER);

async function reorganizeSkillsForATS(resume: ResumeData, jobDescription: string, modelOverride?: string): Promise<OptimizationChange[]> {
  const changes: OptimizationChange[] = [];
  const existingCategories = resume.skills || [];
  if (existingCategories.length === 0) return changes;

  const beforeText = existingCategories
    .map(cat => `${cat.category}: ${cat.list.join(', ')}`)
    .join(' | ');

  const bucketMap: Record<SkillBucketName, string[]> = {
    'Languages': [],
    'Frontend': [],
    'Backend': [],
    'Databases': [],
    'Cloud/DevOps': [],
    'AI/ML': [],
    'Tools': [],
    'Core Competencies': [],
  };

  const seen = new Set<string>();
  const listedSkills = existingCategories.flatMap(cat => cat.list || []);
  const listedText = listedSkills.join(', ');
  const allSkills = [
    ...listedSkills,
    // "AWS EC2" already says AWS and EC2.
    ...extractSkillsFromResumeEvidence(resume).filter(skill => !skillAppearsInText(listedText, skill)),
  ];
  const canonicalSkills: string[] = [];
  for (const raw of allSkills) {
    for (const expanded of expandCompositeSkillLabel(raw)) {
      const canonical = canonicalizeSkillLabel(expanded);
      const key = canonical.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      canonicalSkills.push(canonical);
    }
  }

  let aiAssignments: Array<{ skill: string; category: SkillBucketName }> = [];
  try {
    const prompt = [
      'Classify each skill into exactly one category.',
      `Allowed categories: ${SKILL_BUCKET_ORDER.join(', ')}`,
      'Rules:',
      '- Put only soft skills in "Core Competencies".',
      '- Keep technical terms out of "Core Competencies".',
      '- Use exact category names only.',
      '- Return ONLY valid JSON with shape: {"items":[{"skill":"Python","category":"Languages"}]}',
      '',
      `Job Description Context: ${jobDescription.slice(0, 3000)}`,
      '',
      `Skills: ${canonicalSkills.join(', ')}`,
    ].join('\n');

    const response = await openrouter.chatWithSystem(
      'You are an ATS skill categorization engine. Output strict JSON only.',
      prompt,
      { model: modelOverride, temperature: 0.1 }
    );

    const cleaned = response.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { items?: Array<{ skill?: string; category?: string }> };
    aiAssignments = (parsed.items || [])
      .map(item => {
        const skill = canonicalizeSkillLabel((item.skill || '').trim());
        const category = (item.category || '').trim() as SkillBucketName;
        if (!skill || !VALID_SKILL_BUCKETS.has(category)) return null;
        return { skill, category };
      })
      .filter(Boolean) as Array<{ skill: string; category: SkillBucketName }>;
  } catch (error) {
    console.warn('AI skill categorization failed, falling back to local skill categorization:', error);
  }

  if (aiAssignments.length > 0) {
    const assigned = new Set<string>();
    for (const item of aiAssignments) {
      assigned.add(item.skill.toLowerCase());
      addUniqueSkill(bucketMap, item.category, item.skill);
    }
    for (const skill of canonicalSkills) {
      if (!assigned.has(skill.toLowerCase())) {
        addUniqueSkill(bucketMap, inferSkillBucket(skill), skill);
      }
    }
  } else {
    for (const skill of canonicalSkills) {
      addUniqueSkill(bucketMap, inferSkillBucket(skill), skill);
    }
  }

  const rebuilt = SKILL_BUCKET_ORDER
    .filter(bucket => bucketMap[bucket].length > 0)
    .map(bucket => ({
      category: bucket,
      count: [...new Set(bucketMap[bucket].map(s => s.toLowerCase()))].length,
      list: [...new Set(bucketMap[bucket].map(s => s.toLowerCase()))]
        .map(lower => bucketMap[bucket].find(s => s.toLowerCase() === lower)!)
        .slice(0, 25),
    }));

  const afterText = rebuilt
    .map(cat => `${cat.category}: ${cat.list.join(', ')}`)
    .join(' | ');

  if (beforeText !== afterText) {
    resume.skills = rebuilt;
    changes.push({
      parameterId: 22,
      section: 'skills',
      before: beforeText,
      after: afterText,
      description: 'Reorganized skills using AI category assignment for ATS readability.',
    });
  }

  return changes;
}

function pruneIrrelevantSkillsToJD(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  if (!resume.skills || resume.skills.length === 0) return changes;

  const jdLower = jobDescription.toLowerCase();
  const keepExact = new Set(
    [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS]
      .map(s => s.toLowerCase())
      .filter(s => jdLower.includes(s))
  );

  let extraAllowance = 2;
  const beforeText = resume.skills.map(c => `${c.category}: ${c.list.join(', ')}`).join(' | ');

  for (const category of resume.skills) {
    const minimumToKeep = SKILL_BUCKET_MINIMUMS[category.category as SkillBucketName] || 0;
    const originalList = [...category.list];
    const filtered: string[] = [];
    for (const skill of category.list) {
      const s = skill.toLowerCase().trim();
      const isRelevant = jdLower.includes(s) || [...keepExact].some(k => s.includes(k) || k.includes(s));
      if (isRelevant) {
        filtered.push(skill);
        continue;
      }
      if (extraAllowance > 0 && category.category === 'Tools') {
        filtered.push(skill);
        extraAllowance--;
      }
    }

    if (filtered.length < minimumToKeep) {
      for (const skill of originalList) {
        if (filtered.some(existing => existing.toLowerCase() === skill.toLowerCase())) continue;
        filtered.push(skill);
        if (filtered.length >= minimumToKeep) break;
      }
    }

    category.list = filtered;
    category.count = filtered.length;
  }

  resume.skills = resume.skills.filter(c => c.list.length > 0);
  const afterText = resume.skills.map(c => `${c.category}: ${c.list.join(', ')}`).join(' | ');
  if (beforeText !== afterText) {
    changes.push({
      parameterId: 23,
      section: 'skills',
      before: beforeText,
      after: afterText,
      description: 'Pruned low-relevance skills and prioritized JD-matching skills.',
    });
  }

  return changes;
}

function fixSkillsQuality(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];

  if (!resume.skills) resume.skills = [];

  const allSkills = resume.skills.flatMap(s => s.list);
  const seen = new Set<string>();
  const softSkills: string[] = [];
  const softPatterns = /^(communication|teamwork|leadership|problem.solving|time management|collaboration|flexibility|adaptability|critical thinking|creativity|work ethic|interpersonal|organizational|detail.oriented|multitasking)$/i;

  for (const cat of resume.skills) {
    const isTechCategory = /programming|language|framework|tool|database|technolog|technical/i.test(cat.category);
    const original = [...cat.list];
    const deduped: string[] = [];

    for (const skill of cat.list) {
      const lower = skill.toLowerCase().trim();
      if (seen.has(lower)) continue;
      seen.add(lower);

      if (isTechCategory && softPatterns.test(skill.trim())) {
        softSkills.push(skill);
        continue;
      }
      deduped.push(skill);
    }

    if (deduped.length !== original.length) {
      changes.push({ parameterId: 22, section: 'skills', before: original.join(', '), after: deduped.join(', '), description: `Cleaned duplicates/soft skills from "${cat.category}"` });
      cat.list = deduped;
      cat.count = deduped.length;
    }
  }

  if (softSkills.length > 0) {
    let softCat = resume.skills.find(s => /soft|core|interpersonal|competenc/i.test(s.category));
    if (!softCat) {
      softCat = { category: 'Core Competencies', count: 0, list: [] };
      resume.skills.push(softCat);
    }
    const existing = new Set(softCat.list.map(s => s.toLowerCase()));
    for (const s of softSkills) {
      if (!existing.has(s.toLowerCase())) {
        softCat.list.push(s);
        existing.add(s.toLowerCase());
      }
    }
    softCat.count = softCat.list.length;
    changes.push({ parameterId: 22, section: 'skills', before: '', after: softCat.list.join(', '), description: 'Moved soft skills to "Core Competencies" category' });
  }

  return changes;
}

/** Skills the JD names first come first in each category; categories with an earlier JD skill come first. */
function orderSkillsByJdPriority(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  if (!resume.skills || resume.skills.length === 0) return [];
  const jdLower = jobDescription.toLowerCase();
  const rank = (skill: string) => {
    const at = jdLower.search(new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(skill.toLowerCase().trim())}($|[^a-z0-9+#])`));
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };
  const before = resume.skills.map(c => `${c.category}: ${c.list.join(', ')}`).join(' | ');
  resume.skills = resume.skills
    .map(category => ({ ...category, list: [...category.list].sort((a, b) => rank(a) - rank(b)) }))
    .sort((a, b) => Math.min(...a.list.map(rank)) - Math.min(...b.list.map(rank)));
  const after = resume.skills.map(c => `${c.category}: ${c.list.join(', ')}`).join(' | ');
  return before === after ? [] : [{ parameterId: 23, section: 'skills', before, after, description: 'Ordered skills by job-description priority.' }];
}

interface RewriteEntry { section: 'workExperience' | 'projects'; index: number; title: string; bullets: string[] }

/** Marks where the section JSON starts in the rewrite prompt (tests read it back). */
export const REWRITE_INPUT_MARKER = 'INPUT_JSON:';

/**
 * Tier work: the AI rewrites the summary (all tiers) and every bullet (Smart,
 * Deep) toward the JD, using only skills the resume already grounds. The loop
 * runs the evidence validator over the result, so anything invented is reverted.
 */
async function rewriteSectionsWithAI(
  resume: ResumeData,
  jobDescription: string,
  sections: readonly RefinementSection[],
  gaps: GapItem[],
  models: string[],
): Promise<OptimizationChange[]> {
  const summaryField: 'summary' | 'careerObjective' = resume.summary?.trim() || !resume.careerObjective?.trim() ? 'summary' : 'careerObjective';
  const currentSummary = (resume[summaryField] || '').trim();
  const entries: RewriteEntry[] = sections.includes('bullets') ? [
    ...(resume.workExperience || []).map((job, index) => ({ section: 'workExperience' as const, index, title: [job.role, job.company].filter(Boolean).join(' at '), bullets: job.bullets || [] })),
    ...(resume.projects || []).map((project, index) => ({ section: 'projects' as const, index, title: project.title, bullets: project.bullets || [] })),
  ].filter(entry => entry.bullets.length > 0) : [];
  const wantSummary = sections.includes('summary') && currentSummary.length > 0;
  if (!wantSummary && entries.length === 0) return [];

  const jdLower = jobDescription.toLowerCase();
  const groundedJdSkills = extractSkillsFromResumeEvidence(resume).filter(skill => skillAppearsInText(jdLower, skill));
  const input = { ...(wantSummary ? { summary: currentSummary } : {}), ...(entries.length ? { entries } : {}) };
  const prompt = [
    'Rewrite the resume sections in INPUT_JSON for the job description below.',
    'Rules:',
    '- Use ONLY facts in INPUT_JSON. Never add a skill, tool, employer, project, credential, date or number that is not already there.',
    '- Keep every number exactly as written. Never add, round or estimate a number.',
    '- Each bullet: one sentence of about 12-22 words that starts with a strong action verb (Built, Developed, Automated, Designed, Implemented). No "helped", "worked on", "responsible for", no passive voice.',
    `- Use the job's wording for these skills where the bullet already shows that skill: ${groundedJdSkills.join(', ') || '(none)'}.`,
    '- Keep the same entries, the same number of bullets and the same order; rewrite bullet 1 from bullet 1, and so on.',
    '- Summary: 40-60 words, aimed at this role, naming the matching skills above. Do not claim years of experience the input does not state.',
    `- Weakest scoring areas to improve: ${gaps.slice(0, 6).map(g => g.parameterName).join(', ') || 'general alignment'}.`,
    '- Return ONLY JSON in the same shape as INPUT_JSON.',
    '',
    `Job Description: ${jobDescription.slice(0, 4000)}`,
    '',
    `${REWRITE_INPUT_MARKER}\n${JSON.stringify(input)}`,
  ].join('\n');

  let parsed: { summary?: unknown; entries?: Array<{ section?: string; index?: number; bullets?: unknown }> } | null = null;
  for (const model of [...new Set(models.filter(Boolean))]) {
    try {
      const response = await openrouter.chatWithSystem(
        'You are an evidence-locked resume writer. You improve wording and never add facts. Output strict JSON only.',
        prompt,
        { model, temperature: 0.3 },
      );
      parsed = JSON.parse(response.replace(/```json?\s*/g, '').replace(/```/g, '').trim());
      break;
    } catch (error) {
      console.warn(`Refinement rewrite on ${model} failed:`, error);
    }
  }
  if (!parsed) return [];

  const changes: OptimizationChange[] = [];
  const nextSummary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (wantSummary && nextSummary.length >= 40 && nextSummary !== currentSummary) {
    resume[summaryField] = nextSummary;
    changes.push({ parameterId: 9, section: summaryField, before: currentSummary, after: nextSummary, description: 'Rewrote summary toward the job using grounded skills.' });
  }
  for (const entry of entries.length > 0 ? parsed.entries || [] : []) {
    const index = typeof entry.index === 'number' ? entry.index : -1;
    const target = entry.section === 'projects' ? resume.projects?.[index] : entry.section === 'workExperience' ? resume.workExperience?.[index] : undefined;
    const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];
    // A changed bullet count would break the one-to-one evidence check; skip that entry.
    if (!target || bullets.length !== target.bullets.length || !bullets.every(b => typeof b === 'string' && b.trim().length > 0)) continue;
    bullets.forEach((bullet, i) => {
      const next = (bullet as string).trim();
      if (next === target.bullets[i]) return;
      changes.push({ parameterId: 12, section: entry.section === 'projects' ? 'projects' : 'experience', before: target.bullets[i], after: next, description: 'Rewrote bullet with an action verb and job wording.' });
      target.bullets[i] = next;
    });
  }
  return changes;
}

export async function optimizeByParameter(
  resume: ResumeData,
  jobDescription: string,
  gaps: GapItem[],
  options: TargetedOptimizationOptions = {},
): Promise<TargetedOptimizationResult> {
  const optimized = JSON.parse(JSON.stringify(resume)) as ResumeData;
  const allChanges: OptimizationChange[] = [];
  const parametersFixed: number[] = [];

  const gapIds = new Set(gaps.map(g => g.parameterId));

  // Evidence-only pipeline: gaps in years, seniority, contact details, and
  // project count require candidate input and must never be auto-filled.

  // Wording (verbs, voice, vagueness, length) belongs to the AI rewrite. Swapping
  // or cutting words by list produced broken sentences and inflated claims.

  if (gapIds.has(6) || gapIds.has(7) || gapIds.has(8) || gapIds.has(10)) {
    const suggestedKeywords = parseKeywordsFromGapSuggestions(gaps, [6, 7, 8, 10, 23, 28]);
    allChanges.push(...addMissingKeywords(optimized, jobDescription, suggestedKeywords));
    parametersFixed.push(6, 7, 8, 10);
  }

  if (gapIds.has(9) && (!optimized.targetRole || optimized.targetRole.trim().length === 0)) {
    allChanges.push(...alignRoleTitleWithJD(optimized, jobDescription));
    parametersFixed.push(9);
  }

  // Missing metrics require candidate-provided evidence. Never generate them.

  if (gapIds.has(4)) {
    allChanges.push(...fixBulletFormatting(optimized));
    parametersFixed.push(4);
  }

  const sections = options.sections || [];
  // Smart and Deep align every project's tech stack (own evidence only), not just on a gap.
  if (gapIds.has(19) || gapIds.has(20) || gapIds.has(25) || sections.includes('bullets')) {
    // This helper extracts technologies from the candidate's own project text;
    // JD-only tools are deliberately excluded.
    allChanges.push(...addProjectTechStacks(optimized, jobDescription));
    parametersFixed.push(19, 20, 25);
  }

  if (gapIds.has(22) || gapIds.has(23)) {
    allChanges.push(...fixSkillsQuality(optimized));
    parametersFixed.push(22, 23);
  }

  // Project technologies, impact, metrics, and JD-only industry terms are
  // reported as user actions instead of being inserted automatically.

  if (sections.length > 0) {
    allChanges.push(...await rewriteSectionsWithAI(optimized, jobDescription, sections, gaps, [options.model || '', options.fallbackModel || '']));
  }

  // Skill categorisation is a side job: the cheap fallback model is enough when one is given.
  const aiSkillReorgChanges = await reorganizeSkillsForATS(optimized, jobDescription, options.fallbackModel || options.model);
  allChanges.push(...aiSkillReorgChanges);
  allChanges.push(...pruneIrrelevantSkillsToJD(optimized, jobDescription));
  allChanges.push(...orderSkillsByJdPriority(optimized, jobDescription));
  parametersFixed.push(22, 23);

  return {
    optimizedResume: optimized,
    changes: allChanges,
    parametersFixed: [...new Set(parametersFixed)],
  };
}
