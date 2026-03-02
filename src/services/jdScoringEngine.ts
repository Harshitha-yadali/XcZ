import { ResumeData } from '../types/resume';
import {
  ALL_HARD_SKILLS,
  ALL_TOOL_SKILLS,
  SOFT_SKILLS as TAXONOMY_SOFT_SKILLS,
  CONTACT_PROFILE_WORDS,
} from '../constants/skillsTaxonomy';

export interface ParameterScore {
  id: number;
  name: string;
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  suggestions: string[];
  fixable: boolean;
  fixType: 'ai' | 'user_input' | 'none';
}

export interface CategoryScore {
  name: string;
  weight: number;
  parameters: ParameterScore[];
  score: number;
  maxScore: number;
  percentage: number;
}

export interface JDScoringResult {
  overallScore: number;
  categories: CategoryScore[];
  parameters: ParameterScore[];
  matchBand: string;
  interviewProbability: string;
  fixableCount: number;
  nonFixableCount: number;
}

interface JDAnalysis {
  hardSkills: string[];
  softSkills: string[];
  tools: string[];
  roleKeywords: string[];
  seniorityLevel: string;
  yearsRequired: number;
  responsibilities: string[];
}

const TECH_SKILLS = new Set(
  ALL_HARD_SKILLS.filter(s => !CONTACT_PROFILE_WORDS.has(s.toLowerCase()))
);

const TOOL_KEYWORDS = new Set(
  ALL_TOOL_SKILLS.filter(s => !CONTACT_PROFILE_WORDS.has(s.toLowerCase()))
);

const SOFT_SKILLS_LIST = [...TAXONOMY_SOFT_SKILLS];

const IMPACT_VERBS = new Set([
  'achieved', 'exceeded', 'surpassed', 'attained', 'accomplished', 'delivered', 'generated', 'produced',
  'spearheaded', 'led', 'directed', 'orchestrated', 'championed', 'pioneered', 'drove', 'headed',
  'engineered', 'architected', 'developed', 'built', 'designed', 'implemented', 'created', 'constructed',
  'optimized', 'enhanced', 'streamlined', 'accelerated', 'transformed', 'revamped', 'modernized', 'boosted',
  'analyzed', 'evaluated', 'assessed', 'identified', 'diagnosed', 'investigated', 'researched', 'discovered',
  'collaborated', 'partnered', 'coordinated', 'facilitated', 'unified', 'integrated', 'aligned',
  'managed', 'oversaw', 'supervised', 'administered', 'controlled', 'governed', 'maintained', 'regulated',
  'innovated', 'invented', 'conceptualized', 'devised', 'formulated', 'established', 'introduced', 'launched',
]);

const VAGUE_PHRASES = [
  'responsible for', 'worked on', 'helped with', 'involved in', 'participated in',
  'was part of', 'assisted with', 'handled', 'dealt with', 'took care of',
];

const PASSIVE_PATTERNS = [
  /\bwas\s+\w+ed\b/i, /\bwere\s+\w+ed\b/i, /\bbeen\s+\w+ed\b/i,
  /\bbeing\s+\w+ed\b/i, /\bis\s+\w+ed\b/i, /\bare\s+\w+ed\b/i,
];

type SkillImportance = 'critical' | 'important' | 'nice_to_have';

interface JDKeywordExtraction {
  hard: string[];
  soft: string[];
  tools: string[];
  industry: string[];
}

interface SkillBucketItem {
  skill: string;
  inResume: boolean;
  inJD: boolean;
  importance: SkillImportance;
}

interface SkillBucketAnalysis {
  mustHave: SkillBucketItem[];
  supporting: SkillBucketItem[];
  missing: SkillBucketItem[];
  irrelevant: SkillBucketItem[];
}

interface KeywordSkillScoringContext {
  resumeText: string;
  resumeLower: string;
  jdKeywords: JDKeywordExtraction;
  skillBuckets: SkillBucketAnalysis;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractJDKeywords(jobDescription: string): JDKeywordExtraction {
  const hardSkillPatterns = ALL_HARD_SKILLS.map(s => escapeRegExp(s));
  const softSkillPatterns = TAXONOMY_SOFT_SKILLS.map(s => s.replace(/-/g, '.'));
  const toolPatterns = ALL_TOOL_SKILLS
    .filter(s => !CONTACT_PROFILE_WORDS.has(s.toLowerCase()))
    .map(s => escapeRegExp(s));

  const extractMatches = (patterns: string[]): string[] => {
    const found: string[] = [];
    for (const pattern of patterns) {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const match = jobDescription.match(regex);
      if (match) found.push(match[0]);
    }
    return [...new Set(found)];
  };

  const hardFound = extractMatches(hardSkillPatterns);
  if (hardFound.length < 3) {
    const techWordRegex = /\b([A-Z][a-zA-Z0-9+#.]+(?:\.[jJ][sS])?)\b/g;
    const nonTechWords = new Set([
      'the', 'this', 'our', 'we', 'you', 'your', 'they', 'their', 'with', 'for', 'and', 'but',
      'can', 'will', 'must', 'have', 'has', 'are', 'is', 'an', 'in', 'on', 'of', 'to', 'as',
      'at', 'by', 'do', 'be', 'it', 'if', 'or', 'not', 'from', 'that', 'which', 'about',
      'after', 'before', 'under', 'above', 'into', 'through', 'over', 'between', 'within',
      'without', 'during', 'against', 'along', 'across', 'behind', 'beyond', 'including',
      'role', 'company', 'team', 'work', 'working', 'digital', 'services', 'key', 'performing',
      'workplace', 'multicloud', 'responsible', 'required', 'preferred', 'strong', 'excellent',
      'good', 'ability', 'experience', 'years', 'level', 'position', 'department', 'manager',
      'senior', 'junior', 'lead', 'staff', 'associate', 'principal', 'director', 'analyst',
      'engineer', 'developer', 'designer', 'architect', 'consultant', 'specialist', 'coordinator',
      'environment', 'industry', 'client', 'customer', 'business', 'solution', 'solutions',
      'enterprise', 'global', 'local', 'remote', 'hybrid', 'onsite', 'office', 'location',
      'salary', 'benefits', 'bonus', 'equity', 'stock', 'option', 'compensation',
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
      'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
      'september', 'october', 'november', 'december',
      'github', 'linkedin', 'portfolio', 'email', 'phone', 'website', 'twitter', 'medium',
    ]);

    const extra: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = techWordRegex.exec(jobDescription)) !== null) {
      const word = match[1];
      if (word.length >= 2 && word.length <= 25 && !nonTechWords.has(word.toLowerCase())) {
        extra.push(word);
      }
    }
    hardFound.push(...[...new Set(extra)].slice(0, 10));
  }

  const industryWords: string[] = [];
  const sentences = jobDescription.split(/[.!?\n]+/);
  for (const sentence of sentences) {
    const words = sentence.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g);
    if (words) industryWords.push(...words);
  }

  return {
    hard: [...new Set(hardFound)],
    soft: extractMatches(softSkillPatterns),
    tools: extractMatches(toolPatterns),
    industry: [...new Set(industryWords)].slice(0, 15),
  };
}

function isValidSkillName(text: string): boolean {
  if (text.length < 2 || text.length > 35) return false;
  if (/\d+%/.test(text)) return false;
  if (/\d+x\b/.test(text)) return false;
  if (/\$\d+/.test(text)) return false;
  if (/(?:improving|reducing|achieving|serving|increasing|decreasing|saving|generating)\s/i.test(text)) return false;
  if (/\b(?:by|of|to|from|with|for|the|and|or|in|at)\s.*\b(?:by|of|to|from|with|for|the|and|or|in|at)\s/i.test(text)) return false;
  if ((text.match(/\s+/g) || []).length > 3) return false;
  if (/^\d+\s/.test(text)) return false;
  return true;
}

function extractResumeSkills(resumeText: string, resumeData: ResumeData): string[] {
  const skills: string[] = [];
  for (const category of resumeData.skills || []) {
    skills.push(...category.list.filter(isValidSkillName));
  }

  const textSkills = resumeText.match(/(?:skills?|technologies?|tools?)[\s:]*([^\n]+)/gi);
  if (textSkills) {
    for (const line of textSkills) {
      const items = line.replace(/^[^:]+:\s*/, '').split(/[,;|]/);
      for (const item of items) {
        const trimmed = item.trim();
        if (isValidSkillName(trimmed)) skills.push(trimmed);
      }
    }
  }

  return [...new Set(skills.map(s => s.trim()).filter(Boolean))];
}

function normalizeSkillKey(skill: string): string {
  return skill.toLowerCase()
    .replace(/\.js$/i, '')
    .replace(/\.?js$/i, '')
    .replace(/[-_./]/g, '')
    .trim();
}

function isContactWord(skill: string): boolean {
  return CONTACT_PROFILE_WORDS.has(skill.toLowerCase().trim());
}

function buildSkillBuckets(
  resumeText: string,
  jobDescription: string,
  resumeData: ResumeData,
  jdKeywords: JDKeywordExtraction
): SkillBucketAnalysis {
  const resumeSkills = extractResumeSkills(resumeText, resumeData);
  const resumeLower = resumeText.toLowerCase();
  const allJDSkills = [...jdKeywords.hard, ...jdKeywords.tools].filter(s => !isContactWord(s));
  const allJDSoft = jdKeywords.soft;

  const mustHave: SkillBucketItem[] = [];
  const supporting: SkillBucketItem[] = [];
  const missing: SkillBucketItem[] = [];
  const irrelevant: SkillBucketItem[] = [];
  const seenKeys = new Set<string>();

  for (const skill of allJDSkills) {
    const key = normalizeSkillKey(skill);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const inResume = resumeLower.includes(skill.toLowerCase());
    if (inResume) {
      mustHave.push({ skill, inResume: true, inJD: true, importance: 'critical' });
    } else {
      missing.push({ skill, inResume: false, inJD: true, importance: 'critical' });
    }
  }

  for (const skill of allJDSoft) {
    const key = normalizeSkillKey(skill);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const inResume = resumeLower.includes(skill.toLowerCase());
    if (inResume) {
      supporting.push({ skill, inResume: true, inJD: true, importance: 'important' });
    } else {
      missing.push({ skill, inResume: false, inJD: true, importance: 'nice_to_have' });
    }
  }

  const categoryHeaders = new Set([
    'tools', 'platforms', 'languages', 'frameworks', 'databases', 'technologies',
    'skills', 'technical', 'soft skills', 'other',
  ]);

  const jdLower = jobDescription.toLowerCase();
  for (const skill of resumeSkills) {
    const skillLower = skill.toLowerCase();
    if (isContactWord(skillLower)) continue;
    if (categoryHeaders.has(skillLower)) continue;

    const key = normalizeSkillKey(skill);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    if (jdLower.includes(skillLower)) {
      supporting.push({ skill, inResume: true, inJD: true, importance: 'nice_to_have' });
    } else {
      irrelevant.push({ skill, inResume: true, inJD: false, importance: 'nice_to_have' });
    }
  }

  return { mustHave, supporting, missing, irrelevant };
}

function buildKeywordSkillScoringContext(resume: ResumeData, jobDescription: string): KeywordSkillScoringContext {
  const resumeText = getFullResumeText(resume);
  const jdKeywords = extractJDKeywords(jobDescription);
  const skillBuckets = buildSkillBuckets(resumeText, jobDescription, resume, jdKeywords);
  return {
    resumeText,
    resumeLower: resumeText.toLowerCase(),
    jdKeywords,
    skillBuckets,
  };
}

function getFullResumeText(resume: ResumeData): string {
  const parts: string[] = [];
  if (resume.summary) parts.push(resume.summary);
  if (resume.careerObjective) parts.push(resume.careerObjective);
  resume.workExperience?.forEach(exp => {
    parts.push(`${exp.role} ${exp.company}`);
    exp.bullets?.forEach(b => parts.push(b));
  });
  resume.projects?.forEach(p => {
    parts.push(p.title);
    p.bullets?.forEach(b => parts.push(b));
    if (p.techStack) parts.push(p.techStack.join(', '));
  });
  resume.skills?.forEach(s => parts.push(s.list.join(', ')));
  resume.education?.forEach(e => parts.push(`${e.degree} ${e.school}`));
  resume.certifications?.forEach(c => {
    if (typeof c === 'string') parts.push(c);
    else parts.push(`${c.title} ${c.description}`);
  });
  return parts.join(' ');
}

function getAllBullets(resume: ResumeData): string[] {
  const bullets: string[] = [];
  resume.workExperience?.forEach(exp => exp.bullets?.forEach(b => bullets.push(b)));
  resume.projects?.forEach(p => p.bullets?.forEach(b => bullets.push(b)));
  return bullets;
}

function analyzeJD(jd: string): JDAnalysis {
  const jdLower = jd.toLowerCase();

  const hardSkills: string[] = [];
  TECH_SKILLS.forEach(skill => {
    if (jdLower.includes(skill)) hardSkills.push(skill);
  });

  const tools: string[] = [];
  TOOL_KEYWORDS.forEach(tool => {
    if (jdLower.includes(tool)) tools.push(tool);
  });

  const softSkills: string[] = [];
  SOFT_SKILLS_LIST.forEach(skill => {
    if (jdLower.includes(skill)) softSkills.push(skill);
  });

  const roleKeywords: string[] = [];
  const roleMatches = jd.match(/\b(engineer|developer|architect|lead|senior|junior|manager|analyst|specialist|consultant|designer|devops|sre|full.?stack|front.?end|back.?end|data|software|web|mobile)\b/gi) || [];
  roleMatches.forEach(m => {
    const n = m.toLowerCase();
    if (!roleKeywords.includes(n)) roleKeywords.push(n);
  });

  let seniorityLevel = 'mid';
  if (/\b(principal|staff|distinguished|director)\b/i.test(jd)) seniorityLevel = 'principal';
  else if (/\b(lead|tech lead|team lead)\b/i.test(jd)) seniorityLevel = 'lead';
  else if (/\b(senior|sr\.?)\b/i.test(jd)) seniorityLevel = 'senior';
  else if (/\b(junior|jr\.?|entry|fresher|graduate|intern)\b/i.test(jd)) seniorityLevel = 'entry';

  const yearsMatch = jd.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
  const yearsRequired = yearsMatch ? parseInt(yearsMatch[1]) : 0;

  const responsibilities: string[] = [];
  const respPatterns = /(?:responsible for|will be|you will|duties include)[:\s]*([^.]+)/gi;
  let respMatch;
  while ((respMatch = respPatterns.exec(jd)) !== null) {
    responsibilities.push(respMatch[1].trim());
  }

  return {
    hardSkills: [...new Set(hardSkills)],
    softSkills: [...new Set(softSkills)],
    tools: [...new Set(tools)],
    roleKeywords: [...new Set(roleKeywords)],
    seniorityLevel,
    yearsRequired,
    responsibilities,
  };
}

function scoreP1SingleColumn(resume: ResumeData): ParameterScore {
  let score = 10;
  const suggestions: string[] = [];
  const text = getFullResumeText(resume);
  if (/\t{2,}/.test(text) || /\|/.test(text)) {
    score -= 5;
    suggestions.push('Use single-column layout for ATS compatibility');
  }
  return { id: 1, name: 'Single Column Detection', category: 'ATS Compatibility', score, maxScore: 10, percentage: Math.round((score / 10) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP2NoTablesImages(resume: ResumeData): ParameterScore {
  let score = 10;
  const suggestions: string[] = [];
  const text = getFullResumeText(resume);
  if (/\[image\]|\[icon\]|\[table\]/i.test(text)) {
    score -= 5;
    suggestions.push('Remove tables, images, and icons for ATS parsing');
  }
  return { id: 2, name: 'No Tables/Images/Icons', category: 'ATS Compatibility', score, maxScore: 10, percentage: Math.round((score / 10) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP3StandardHeadings(resume: ResumeData): ParameterScore {
  let score = 0;
  const maxScore = 10;
  const suggestions: string[] = [];
  const hasExp = (resume.workExperience?.length || 0) > 0;
  const hasEdu = (resume.education?.length || 0) > 0;
  const hasSkills = (resume.skills?.length || 0) > 0;
  const hasProjects = (resume.projects?.length || 0) > 0;
  const hasSummary = !!resume.summary && resume.summary.length > 20;

  if (hasExp) score += 2;
  else suggestions.push('Add Work Experience section');
  if (hasEdu) score += 2;
  else suggestions.push('Add Education section');
  if (hasSkills) score += 2;
  else suggestions.push('Add Skills section');
  if (hasProjects) score += 2;
  else suggestions.push('Add Projects section');
  if (hasSummary) score += 2;
  else suggestions.push('Add Summary/Objective section');

  return { id: 3, name: 'Standard Section Headings', category: 'ATS Compatibility', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP4BulletFormatting(resume: ResumeData): ParameterScore {
  let score = 0;
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    suggestions.push('Add bullet points to experience and projects');
    return { id: 4, name: 'Proper Bullet Formatting', category: 'ATS Compatibility', score: 0, maxScore, percentage: 0, suggestions, fixable: true, fixType: 'ai' };
  }

  const wellFormatted = bullets.filter(b => {
    const trimmed = b.trim();
    return trimmed.length >= 20 && trimmed.length <= 300 && /^[A-Z]/.test(trimmed);
  }).length;

  score = Math.round((wellFormatted / bullets.length) * maxScore);
  if (score < maxScore) suggestions.push('Ensure bullets are 20-300 chars, start with capital letter');

  return { id: 4, name: 'Proper Bullet Formatting', category: 'ATS Compatibility', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP5PdfParsingSafety(resume: ResumeData): ParameterScore {
  let score = 8;
  const suggestions: string[] = [];
  const text = getFullResumeText(resume);
  if (text.length < 200) {
    score = 3;
    suggestions.push('Resume text appears too short, may have parsing issues');
  }
  return { id: 5, name: 'PDF Parsing Safety', category: 'ATS Compatibility', score, maxScore: 10, percentage: Math.round((score / 10) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP6HardSkillMatch(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 15;
  const suggestions: string[] = [];

  if (context) {
    const criticalMissing = context.skillBuckets.missing.filter(s => s.importance === 'critical');
    const matched = context.skillBuckets.mustHave.length;
    const totalCritical = matched + criticalMissing.length;

    if (totalCritical === 0) {
      return { id: 6, name: 'JD Hard Skill Match %', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
    }

    const matchPct = matched / totalCritical;
    const score = Math.round(matchPct * maxScore);
    if (criticalMissing.length > 0) {
      suggestions.push(`Missing hard skills: ${criticalMissing.slice(0, 5).map(s => s.skill).join(', ')}`);
    }

    return { id: 6, name: 'JD Hard Skill Match %', category: 'Keyword Alignment', score, maxScore, percentage: Math.round(matchPct * 100), suggestions, fixable: true, fixType: 'ai' };
  }

  const resumeText = getFullResumeText(resume).toLowerCase();
  const resumeSkills = resume.skills?.flatMap(s => s.list.map(sk => sk.toLowerCase())) || [];
  const combined = `${resumeText} ${resumeSkills.join(' ')}`;

  if (jdAnalysis.hardSkills.length === 0) {
    return { id: 6, name: 'JD Hard Skill Match %', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = jdAnalysis.hardSkills.filter(s => combined.includes(s.toLowerCase()));
  const matchPct = matched.length / jdAnalysis.hardSkills.length;
  const score = Math.round(matchPct * maxScore);
  const missing = jdAnalysis.hardSkills.filter(s => !combined.includes(s.toLowerCase()));
  if (missing.length > 0) suggestions.push(`Missing hard skills: ${missing.slice(0, 5).join(', ')}`);

  return { id: 6, name: 'JD Hard Skill Match %', category: 'Keyword Alignment', score, maxScore, percentage: Math.round(matchPct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP7ToolMatch(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];

  const resumeText = context?.resumeLower || getFullResumeText(resume).toLowerCase();
  const jdTools = context?.jdKeywords.tools || jdAnalysis.tools;

  if (jdTools.length === 0) {
    return { id: 7, name: 'JD Tool Match %', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = jdTools.filter(t => resumeText.includes(t.toLowerCase()));
  const matchPct = matched.length / jdTools.length;
  const score = Math.round(matchPct * maxScore);
  const missing = jdTools.filter(t => !resumeText.includes(t.toLowerCase()));
  if (missing.length > 0) suggestions.push(`Missing tools: ${missing.slice(0, 5).join(', ')}`);

  return { id: 7, name: 'JD Tool Match %', category: 'Keyword Alignment', score, maxScore, percentage: Math.round(matchPct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP8MandatorySkillPresence(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];

  if (context) {
    const criticalMissing = context.skillBuckets.missing.filter(s => s.importance === 'critical');
    const matched = context.skillBuckets.mustHave.length;
    const totalCritical = matched + criticalMissing.length;

    if (totalCritical === 0) {
      return { id: 8, name: 'Mandatory Skill Presence', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
    }

    const coverage = matched / totalCritical;
    let score = Math.round(coverage * maxScore);
    if (criticalMissing.length > 5) score = Math.min(score, 2);
    else if (criticalMissing.length > 2) score = Math.min(score, 6);

    if (criticalMissing.length > 0) {
      suggestions.push(`Add critical missing keywords: ${criticalMissing.slice(0, 5).map(s => s.skill).join(', ')}`);
    }

    return { id: 8, name: 'Mandatory Skill Presence', category: 'Keyword Alignment', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
  }

  const resumeText = getFullResumeText(resume).toLowerCase();
  const mandatory = jdAnalysis.hardSkills.slice(0, 5);

  if (mandatory.length === 0) {
    return { id: 8, name: 'Mandatory Skill Presence', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = mandatory.filter(s => resumeText.includes(s.toLowerCase()));
  const matchPct = matched.length / mandatory.length;
  const score = Math.round(matchPct * maxScore);
  const missing = mandatory.filter(s => !resumeText.includes(s.toLowerCase()));
  if (missing.length > 0) suggestions.push(`Missing mandatory skills: ${missing.join(', ')}`);

  return { id: 8, name: 'Mandatory Skill Presence', category: 'Keyword Alignment', score, maxScore, percentage: Math.round(matchPct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP9RoleTitleAlignment(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  jobDescription: string,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const roles = resume.workExperience?.map(e => e.role?.toLowerCase() || '') || [];
  const allRolesText = `${roles.join(' ')} ${resume.targetRole?.toLowerCase() || ''} ${context?.resumeLower || ''}`;

  const jdLower = jobDescription.toLowerCase();
  const titleMatch = jdLower.match(/(?:looking for|hiring|role of|position:?)\s*([^\n.]+)/i);
  const jdTitle = titleMatch ? titleMatch[1].trim() : '';
  const titleWords = jdTitle.split(/\s+/).filter(w => w.length > 2);

  const titleMatched = titleWords.filter(w => allRolesText.includes(w)).length;
  const titlePct = titleWords.length > 0
    ? Math.round((titleMatched / titleWords.length) * 100)
    : (jdAnalysis.roleKeywords.length > 0
      ? Math.round((jdAnalysis.roleKeywords.filter(kw => allRolesText.includes(kw)).length / jdAnalysis.roleKeywords.length) * 100)
      : 50);

  // Role title alignment is guidance, not a hard penalty (career switchers).
  let score = Math.round(7 + (titlePct / 100) * 3);
  score = Math.max(8, Math.min(maxScore, score));
  if (titlePct < 50) suggestions.push('Optional: align target role wording with the JD role title for better ATS signaling');

  return { id: 9, name: 'Role Title Alignment', category: 'Advanced Diagnostics', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP10KeywordDensityBalance(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const resumeText = context?.resumeLower || getFullResumeText(resume).toLowerCase();
  const words = resumeText.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  const jdTerms = context
    ? [...new Set([...context.jdKeywords.hard, ...context.jdKeywords.soft, ...context.jdKeywords.tools])]
    : jdAnalysis.hardSkills;
  const hardTerms = context ? context.jdKeywords.hard : jdAnalysis.hardSkills;

  // This metric only penalizes keyword stuffing. Missing keywords are scored in #6/#7/#8/#28.
  if (totalWords < 50 || jdTerms.length === 0) {
    return { id: 10, name: 'Keyword Density Balance', category: 'Keyword Alignment', score: 8, maxScore, percentage: 80, suggestions: ['Maintain natural keyword usage and avoid repetition'], fixable: true, fixType: 'ai' };
  }

  let score = maxScore;

  const keywordCounts: Record<string, number> = {};
  hardTerms.forEach(kw => {
    const regex = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi');
    keywordCounts[kw] = (resumeText.match(regex) || []).length;
  });

  const maxRepetition = Math.max(...Object.values(keywordCounts), 0);
  if (maxRepetition > 12) {
    score -= 4;
    suggestions.push('Some keywords appear too many times - avoid stuffing');
  } else if (maxRepetition > 8) {
    score -= 2;
    suggestions.push('Reduce repeated use of the same keyword');
  }

  const stuffedTerms = Object.values(keywordCounts).filter(count => totalWords > 0 && (count / totalWords) > 0.035).length;
  if (stuffedTerms >= 3) {
    score -= 2;
    suggestions.push('Distribute keywords naturally across sections instead of clustering');
  }

  score = Math.max(0, Math.min(score, maxScore));
  return { id: 10, name: 'Keyword Density Balance', category: 'Keyword Alignment', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP11MetricDensity(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    return { id: 11, name: 'Measurable Metrics %', category: 'Impact & Metrics', score: 0, maxScore, percentage: 0, suggestions: ['Add quantified results'], fixable: true, fixType: 'ai' };
  }

  const metricPattern = /\d+%|\$\d+|\d+\s*(users?|customers?|clients?|team|people|million|k\b|x\b|hrs?|hours?|days?|weeks?|months?|requests?|transactions?|records?)/i;
  const withMetrics = bullets.filter(b => metricPattern.test(b));
  const pct = withMetrics.length / bullets.length;
  const score = Math.round(pct * maxScore);
  if (pct < 0.5) suggestions.push('Add measurable metrics to more bullets');

  return { id: 11, name: 'Measurable Metrics %', category: 'Impact & Metrics', score, maxScore, percentage: Math.round(pct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP12WritingStrength(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    return { id: 12, name: 'Strong, Direct Achievement Bullets', category: 'Impact & Metrics', score: 4, maxScore, percentage: 40, suggestions: ['Add achievement-focused bullets with direct outcomes'], fixable: true, fixType: 'ai' };
  }

  const actionVerbRatio = bullets.filter(b => {
    const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    return IMPACT_VERBS.has(firstWord);
  }).length / bullets.length;

  const vagueCount = bullets.filter(b => VAGUE_PHRASES.some(v => b.toLowerCase().includes(v))).length;
  const noVagueRatio = 1 - (vagueCount / bullets.length);

  const passiveCount = bullets.filter(b => PASSIVE_PATTERNS.some(p => p.test(b))).length;
  const activeVoiceRatio = 1 - (passiveCount / bullets.length);

  const weighted = (noVagueRatio * 0.4) + (actionVerbRatio * 0.35) + (activeVoiceRatio * 0.25);
  const score = Math.round(weighted * maxScore);

  if (noVagueRatio < 0.8) suggestions.push('Replace vague phrasing with specific ownership language');
  if (actionVerbRatio < 0.6) suggestions.push('Start more bullets with strong action verbs');
  if (activeVoiceRatio < 0.85) suggestions.push('Prefer active voice in bullet statements');

  return { id: 12, name: 'Strong, Direct Achievement Bullets', category: 'Impact & Metrics', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP13NoVaguePhrases(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    return { id: 13, name: 'No Vague Phrases', category: 'Impact & Metrics', score: maxScore, maxScore, percentage: 100, suggestions, fixable: true, fixType: 'ai' };
  }

  const vagueCount = bullets.filter(b => VAGUE_PHRASES.some(v => b.toLowerCase().includes(v))).length;
  const cleanPct = 1 - (vagueCount / bullets.length);
  const score = Math.round(cleanPct * maxScore);
  if (vagueCount > 0) suggestions.push(`Remove vague phrases from ${vagueCount} bullet(s)`);

  return { id: 13, name: 'No Vague Phrases', category: 'Impact & Metrics', score, maxScore, percentage: Math.round(cleanPct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP14StrongActionVerbs(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    return { id: 14, name: 'Strong Action Verbs', category: 'Advanced Diagnostics', score: 8, maxScore, percentage: 80, suggestions: ['Diagnostic only: add bullet points starting with action verbs'], fixable: false, fixType: 'none' };
  }

  const withActionVerb = bullets.filter(b => {
    const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    return IMPACT_VERBS.has(firstWord);
  });
  const pct = withActionVerb.length / bullets.length;
  const score = Math.max(8, Math.round(pct * maxScore));
  if (pct < 0.6) suggestions.push('Start more bullets with strong action verbs');

  return { id: 14, name: 'Strong Action Verbs', category: 'Advanced Diagnostics', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP15VerbRepetition(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length < 3) {
    return { id: 15, name: 'No Verb Repetition Dominance', category: 'Advanced Diagnostics', score: 8, maxScore, percentage: 80, suggestions, fixable: false, fixType: 'none' };
  }

  const firstVerbs: Record<string, number> = {};
  bullets.forEach(b => {
    const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord) firstVerbs[firstWord] = (firstVerbs[firstWord] || 0) + 1;
  });

  const maxVerbCount = Math.max(...Object.values(firstVerbs), 0);
  const dominanceRatio = maxVerbCount / bullets.length;
  let score = maxScore;
  if (dominanceRatio > 0.4) {
    score -= 5;
    const dominant = Object.entries(firstVerbs).sort((a, b) => b[1] - a[1])[0];
    suggestions.push(`"${dominant[0]}" used ${dominant[1]} times - diversify starting verbs`);
  } else if (dominanceRatio > 0.25) {
    score -= 2;
  }

  score = Math.max(8, score);
  return { id: 15, name: 'No Verb Repetition Dominance', category: 'Advanced Diagnostics', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP16NoPassiveVoice(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const bullets = getAllBullets(resume);
  if (bullets.length === 0) {
    return { id: 16, name: 'No Passive Voice', category: 'Advanced Diagnostics', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const passiveCount = bullets.filter(b => PASSIVE_PATTERNS.some(p => p.test(b))).length;
  const activePct = 1 - (passiveCount / bullets.length);
  const score = Math.max(8, Math.round(activePct * maxScore));
  if (passiveCount > 0) suggestions.push(`Convert ${passiveCount} passive voice bullet(s) to active voice`);

  return { id: 16, name: 'No Passive Voice', category: 'Advanced Diagnostics', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: false, fixType: 'none' };
}

function scoreP17YearsMatch(resume: ResumeData, jdAnalysis: JDAnalysis): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];

  if (jdAnalysis.yearsRequired === 0) {
    return { id: 17, name: 'Years Match JD', category: 'Experience Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  let totalYears = 0;
  resume.workExperience?.forEach(exp => {
    const yearMatch = exp.year?.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|ongoing)/i);
    if (yearMatch) {
      const start = parseInt(yearMatch[1]);
      const end = yearMatch[2].toLowerCase() === 'present' || yearMatch[2].toLowerCase() === 'current' || yearMatch[2].toLowerCase() === 'ongoing'
        ? new Date().getFullYear()
        : parseInt(yearMatch[2]);
      totalYears += end - start;
    }
  });

  // Soft scoring: years mismatch should guide, not heavily penalize.
  const gap = jdAnalysis.yearsRequired - totalYears;
  let score: number;
  if (gap <= 0) score = maxScore;
  else if (gap <= 1) score = 8;
  else if (gap <= 2) score = 7;
  else if (gap <= 3) score = 6;
  else score = 5;

  if (gap > 0) {
    suggestions.push(`JD asks for ${jdAnalysis.yearsRequired}+ years; resume reflects ~${totalYears} years. Highlight equivalent project/internship depth.`);
  }

  return { id: 17, name: 'Years Match JD', category: 'Experience Alignment', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP18SeniorityAlignment(resume: ResumeData, jdAnalysis: JDAnalysis): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const rolesText = (resume.workExperience?.map(e => e.role || '').join(' ') || '').toLowerCase();

  const seniorityMap: Record<string, string[]> = {
    'entry': ['junior', 'intern', 'associate', 'trainee', 'graduate'],
    'mid': ['developer', 'engineer', 'analyst', 'specialist'],
    'senior': ['senior', 'sr', 'experienced'],
    'lead': ['lead', 'principal', 'staff', 'architect', 'head'],
    'principal': ['principal', 'staff', 'distinguished', 'director', 'vp'],
  };

  const expected = seniorityMap[jdAnalysis.seniorityLevel] || [];
  const hasMatch = expected.some(t => rolesText.includes(t));

  let detectedLevel: string = 'mid';
  if (seniorityMap.principal.some(t => rolesText.includes(t))) detectedLevel = 'principal';
  else if (seniorityMap.lead.some(t => rolesText.includes(t))) detectedLevel = 'lead';
  else if (seniorityMap.senior.some(t => rolesText.includes(t))) detectedLevel = 'senior';
  else if (seniorityMap.entry.some(t => rolesText.includes(t))) detectedLevel = 'entry';

  const levelOrder: Record<string, number> = { entry: 1, mid: 2, senior: 3, lead: 4, principal: 5 };
  const expectedRank = levelOrder[jdAnalysis.seniorityLevel] ?? 2;
  const detectedRank = levelOrder[detectedLevel] ?? 2;
  const diff = Math.abs(expectedRank - detectedRank);

  let score = maxScore;
  if (!hasMatch) score = Math.max(6, maxScore - (diff * 2));
  if (!hasMatch) suggestions.push(`Optional: emphasize responsibilities/titles aligned with ${jdAnalysis.seniorityLevel} level`);

  return { id: 18, name: 'Seniority Alignment', category: 'Experience Alignment', score, maxScore, percentage: Math.round((score / maxScore) * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP19ProjectSkillAlignment(resume: ResumeData, jdAnalysis: JDAnalysis): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];

  if (projects.length === 0) {
    suggestions.push('Add projects demonstrating relevant skills');
    return { id: 19, name: 'Project Skill Alignment %', category: 'Project Relevance', score: 0, maxScore, percentage: 0, suggestions, fixable: true, fixType: 'ai' };
  }

  const projectText = projects.map(p => {
    const parts = [p.title, ...(p.bullets || []), ...(p.techStack || [])];
    return parts.join(' ');
  }).join(' ').toLowerCase();

  const allJdSkills = [...jdAnalysis.hardSkills, ...jdAnalysis.tools];
  if (allJdSkills.length === 0) {
    return { id: 19, name: 'Project Skill Alignment %', category: 'Project Relevance', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = allJdSkills.filter(s => projectText.includes(s.toLowerCase()));
  const pct = matched.length / allJdSkills.length;
  const score = Math.round(pct * maxScore);
  if (pct < 0.5) suggestions.push('Add projects that use JD-required technologies');

  return { id: 19, name: 'Project Skill Alignment %', category: 'Project Relevance', score, maxScore, percentage: Math.round(pct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP20TechStackRelevance(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];
  if (projects.length === 0) {
    suggestions.push('Add projects with explicit tech stacks to improve this score');
    return { id: 20, name: 'Tech Stack Relevance', category: 'Project Relevance', score: 0, maxScore, percentage: 0, suggestions, fixable: true, fixType: 'ai' };
  }

  const techStacks = projects.flatMap(p => p.techStack || []).map(t => t.toLowerCase());

  if (techStacks.length === 0) {
    suggestions.push('Add tech stack details to projects');
    return { id: 20, name: 'Tech Stack Relevance', category: 'Project Relevance', score: 2, maxScore, percentage: 20, suggestions, fixable: true, fixType: 'ai' };
  }

  const allJdSkills = context
    ? [...new Set([...context.jdKeywords.hard, ...context.jdKeywords.tools])].slice(0, 12)
    : [...jdAnalysis.hardSkills, ...jdAnalysis.tools];
  if (allJdSkills.length === 0) {
    return { id: 20, name: 'Tech Stack Relevance', category: 'Project Relevance', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = allJdSkills.filter(s => techStacks.some(t => t.includes(s.toLowerCase())));
  const pct = matched.length / allJdSkills.length;
  const score = Math.round(pct * maxScore);
  if (pct < 0.4) suggestions.push('Include JD-relevant technologies in project tech stacks');

  return { id: 20, name: 'Tech Stack Relevance', category: 'Project Relevance', score, maxScore, percentage: Math.round(pct * 100), suggestions, fixable: true, fixType: 'ai' };
}

function scoreP21OnlinePresence(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  let score = 0;

  const hasLinkedIn = !!resume.linkedin && /linkedin\.com/i.test(resume.linkedin);
  const hasGitHub = !!resume.github && /github\.com/i.test(resume.github);
  const hasEmail = !!resume.email && resume.email.includes('@');
  const hasPhone = !!resume.phone && resume.phone.trim().length >= 10;
  const hasName = !!resume.name && resume.name.trim().length >= 2;

  if (hasName) score += 3;
  else suggestions.push('Add your full name to the resume header');

  if (hasEmail) score += 3;
  else suggestions.push('Add your email address');

  if (hasPhone) score += 2;
  else suggestions.push('Add your phone number');

  if (hasLinkedIn) score += 1;
  else suggestions.push('Optional: add LinkedIn profile URL');

  if (hasGitHub) score += 1;
  else suggestions.push('Optional: add GitHub/portfolio URL');

  const pct = Math.round((score / maxScore) * 100);
  return { id: 21, name: 'Online Presence & Contact', category: 'Profile Completeness', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP22SkillsCategorization(
  resume: ResumeData,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const skills = resume.skills || [];
  let score = 0;

  const hasCategorized = skills.length >= 2;
  if (hasCategorized) score += 3;
  else suggestions.push('Organize skills into categories (e.g., Programming Languages, Frameworks, Tools, Databases)');

  const allSkills = skills.flatMap(s => s.list).map(s => s.toLowerCase());
  const duplicates = allSkills.filter((s, i) => allSkills.indexOf(s) !== i);
  if (duplicates.length === 0) score += 2;
  else suggestions.push(`Remove duplicate skills: ${[...new Set(duplicates)].slice(0, 3).join(', ')}`);

  const softInTech = skills.some(s => {
    const cat = s.category.toLowerCase();
    const isTechCategory = /programming|language|framework|tool|database|technolog/i.test(cat);
    if (!isTechCategory) return false;
    return s.list.some(skill => /^(communication|teamwork|leadership|problem.solving|time management|collaboration|flexibility|adaptability)$/i.test(skill.trim()));
  });
  if (!softInTech) score += 2;
  else suggestions.push('Move soft skills (communication, teamwork) out of technical skill categories');

  const companyNames = ['wipro', 'tcs', 'infosys', 'cognizant', 'accenture', 'capgemini', 'hcl', 'tech mahindra'];
  const skillsText = context?.resumeText || getFullResumeText(resume);
  const skillsSection = skillsText.match(/(?:skills?|technical skills?)[\s\S]*?(?=\n[A-Z][A-Za-z\s]+:|\n\n|$)/i);
  const skillsSectionText = skillsSection ? skillsSection[0].toLowerCase() : allSkills.join(' ');
  const hasFakeSkills = companyNames.some(c => skillsSectionText.includes(c));
  if (!hasFakeSkills) score += 3;
  else suggestions.push('Remove company names or non-skill entries from your skills section');

  const pct = Math.round((score / maxScore) * 100);
  return { id: 22, name: 'Skills Categorization Quality', category: 'Skills Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP23SkillRelevance(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];

  if (context) {
    const criticalMissing = context.skillBuckets.missing.filter(s => s.importance === 'critical');
    const criticalTotal = context.skillBuckets.mustHave.length + criticalMissing.length;
    const criticalCoverage = criticalTotal > 0 ? context.skillBuckets.mustHave.length / criticalTotal : 1;

    const jdSkillTotal = context.skillBuckets.mustHave.length + context.skillBuckets.supporting.length + context.skillBuckets.missing.length;
    const overallCoverage = jdSkillTotal > 0
      ? (context.skillBuckets.mustHave.length + context.skillBuckets.supporting.length) / jdSkillTotal
      : 1;

    const weightedCoverage = (criticalCoverage * 0.7) + (overallCoverage * 0.3);
    let score = Math.round(weightedCoverage * maxScore);

    const resumeSkillTotal = context.skillBuckets.mustHave.length + context.skillBuckets.supporting.length + context.skillBuckets.irrelevant.length;
    const irrelevantRatio = resumeSkillTotal > 0 ? context.skillBuckets.irrelevant.length / resumeSkillTotal : 0;
    if (irrelevantRatio > 0.5) {
      score = Math.max(0, score - 2);
      suggestions.push('Reduce irrelevant skills and prioritize JD-matching skills');
    }

    if (criticalMissing.length > 0) {
      suggestions.push(`Missing critical skills from JD: ${criticalMissing.slice(0, 5).map(s => s.skill).join(', ')}`);
    }

    const pct = Math.round((score / maxScore) * 100);
    return { id: 23, name: 'Skill Relevance to JD', category: 'Skills Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
  }

  const allSkills = (resume.skills || []).flatMap(s => s.list);

  if (allSkills.length === 0) {
    suggestions.push('Add a skills section with relevant technical skills');
    return { id: 23, name: 'Skill Relevance to JD', category: 'Skills Quality', score: 0, maxScore, percentage: 0, suggestions, fixable: true, fixType: 'ai' };
  }

  const jdSkills = [...jdAnalysis.hardSkills, ...jdAnalysis.tools];
  if (jdSkills.length === 0) {
    return { id: 23, name: 'Skill Relevance to JD', category: 'Skills Quality', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const relevant = allSkills.filter(s => jdSkills.some(j => s.toLowerCase().includes(j.toLowerCase()) || j.toLowerCase().includes(s.toLowerCase())));
  const relevancePct = relevant.length / allSkills.length;
  const score = Math.round(relevancePct * maxScore);

  if (relevancePct < 0.4) suggestions.push('Remove skills not relevant to this role and add JD-matching skills');

  const pct = Math.round(relevancePct * 100);
  return { id: 23, name: 'Skill Relevance to JD', category: 'Skills Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP24ProjectCount(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];
  const currentYear = new Date().getFullYear();
  const years = (resume.workExperience || []).reduce((acc, exp) => {
    const match = exp.year?.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|ongoing)/i);
    if (!match) return acc;
    const start = parseInt(match[1], 10);
    const end = /present|current|ongoing/i.test(match[2]) ? currentYear : parseInt(match[2], 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return acc;
    return acc + Math.max(0, end - start);
  }, 0);

  const isFresher = years < 2;
  const minProjects = isFresher ? 2 : 1;
  let score = maxScore;

  if (projects.length >= minProjects) {
    score = maxScore;
  } else if (projects.length === 1 && isFresher) {
    score = 6;
    suggestions.push('For fresher profiles, add one more relevant project (target 2+)');
  } else if (projects.length === 0 && isFresher) {
    score = 2;
    suggestions.push('For fresher profiles, add at least 2 relevant projects');
  } else if (projects.length === 0) {
    score = 5;
    suggestions.push('Add at least one relevant project with impact and measurable outcomes');
  }

  const pct = Math.round((score / maxScore) * 100);
  return { id: 24, name: 'Project Count (Minimum Requirement)', category: 'Project Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP25ProjectTools(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];

  if (projects.length === 0) {
    return { id: 25, name: 'Project Tools Mentioned', category: 'Project Quality', score: 0, maxScore, percentage: 0, suggestions: ['Add projects with specific technologies listed'], fixable: true, fixType: 'ai' };
  }

  let withTools = 0;
  for (const proj of projects) {
    const allText = `${proj.title} ${proj.description || ''} ${(proj.bullets || []).join(' ')}`.toLowerCase();
    const hasTech = (proj.techStack && proj.techStack.length > 0) ||
      /(?:react|python|java|node|express|django|flask|mongodb|sql|aws|docker|kubernetes|tensorflow|pytorch|typescript|javascript|angular|vue|spring|go|rust|ruby|php|swift|kotlin)/i.test(allText);
    if (hasTech) withTools++;
  }

  const ratio = withTools / projects.length;
  const score = Math.round(ratio * maxScore);
  if (ratio < 0.5) suggestions.push('List specific technologies used in each project');

  const pct = Math.round(ratio * 100);
  return { id: 25, name: 'Project Tools Mentioned', category: 'Project Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP26ProjectMetrics(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];

  if (projects.length === 0) {
    return { id: 26, name: 'Project Measurable Results', category: 'Project Quality', score: 0, maxScore, percentage: 0, suggestions: ['Add projects with quantifiable results'], fixable: true, fixType: 'ai' };
  }

  let withMetrics = 0;
  for (const proj of projects) {
    const allText = `${proj.title} ${proj.description || ''} ${(proj.bullets || []).join(' ')}`;
    if (/\d+%|\d+x|\$\d+|\d+\s*(?:users?|customers?|requests?|transactions?|ms|seconds?|hours?|days?|records?|members?|projects?|clients?)/i.test(allText)) {
      withMetrics++;
    }
  }

  const ratio = withMetrics / projects.length;
  const score = Math.round(ratio * maxScore);
  if (ratio < 0.5) suggestions.push('Add quantifiable results to projects (e.g., "reduced load time by 40%", "served 1000+ users")');

  const pct = Math.round(ratio * 100);
  return { id: 26, name: 'Project Measurable Results', category: 'Project Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP27ProjectImpact(resume: ResumeData): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];
  const projects = resume.projects || [];

  if (projects.length === 0) {
    return { id: 27, name: 'Project Business Impact', category: 'Project Quality', score: 0, maxScore, percentage: 0, suggestions: ['Add projects demonstrating business impact'], fixable: true, fixType: 'ai' };
  }

  let withImpact = 0;
  for (const proj of projects) {
    const allText = `${proj.title} ${proj.description || ''} ${(proj.bullets || []).join(' ')}`.toLowerCase();
    if (/(?:increased|decreased|reduced|improved|saved|generated|achieved|resulted|enhanced|boosted|automated|streamlined|optimized|solved|built|developed|implemented)/i.test(allText)) {
      withImpact++;
    }
  }

  const ratio = withImpact / projects.length;
  const score = Math.round(ratio * maxScore);
  if (ratio < 0.5) suggestions.push('Describe the real-world impact of each project (users served, time saved, problems solved)');

  const pct = Math.round(ratio * 100);
  return { id: 27, name: 'Project Business Impact', category: 'Project Quality', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function scoreP28IndustryKeywords(
  resume: ResumeData,
  jdAnalysis: JDAnalysis,
  context?: KeywordSkillScoringContext
): ParameterScore {
  const maxScore = 10;
  const suggestions: string[] = [];

  const resumeText = context?.resumeLower || [
    resume.summary || '',
    ...(resume.workExperience || []).flatMap(e => [e.role, e.company, ...e.bullets]),
    ...(resume.projects || []).flatMap(p => [p.title, p.description || '', ...p.bullets]),
    ...(resume.skills || []).flatMap(s => s.list),
  ].join(' ').toLowerCase();

  const contextIndustryTerms = context?.jdKeywords.industry.map(w => w.toLowerCase()).filter(Boolean) || [];
  if (contextIndustryTerms.length > 0) {
    const uniqueTerms = [...new Set(contextIndustryTerms)];
    const matched = uniqueTerms.filter(term => resumeText.includes(term));
    const ratio = matched.length / uniqueTerms.length;
    const score = Math.round(ratio * maxScore);
    if (ratio < 0.3) {
      const missing = uniqueTerms.filter(term => !resumeText.includes(term)).slice(0, 5);
      suggestions.push(`Add industry-relevant keywords: ${missing.join(', ')}`);
    }
    const pct = Math.round(ratio * 100);
    return { id: 28, name: 'Industry Keyword Coverage', category: 'Keyword Alignment', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
  }

  const industryTerms = jdAnalysis.responsibilities.flatMap(r => {
    const words = r.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    return words.filter(w => !TECH_SKILLS.has(w) && !/^(?:the|and|for|with|from|that|this|will|have|your|about|more|what|when|been|also|into|some|than|them|they|each|make|like|over|such|take|only|come|made|after|first|their|could|other|which|would)$/.test(w));
  });

  const uniqueTerms = [...new Set(industryTerms)].slice(0, 20);
  if (uniqueTerms.length === 0) {
    return { id: 28, name: 'Industry Keyword Coverage', category: 'Keyword Alignment', score: maxScore, maxScore, percentage: 100, suggestions, fixable: false, fixType: 'none' };
  }

  const matched = uniqueTerms.filter(t => resumeText.includes(t));
  const ratio = matched.length / uniqueTerms.length;
  const score = Math.round(ratio * maxScore);
  if (ratio < 0.3) {
    const missing = uniqueTerms.filter(t => !resumeText.includes(t)).slice(0, 5);
    suggestions.push(`Add industry-relevant keywords: ${missing.join(', ')}`);
  }

  const pct = Math.round(ratio * 100);
  return { id: 28, name: 'Industry Keyword Coverage', category: 'Keyword Alignment', score, maxScore, percentage: pct, suggestions, fixable: true, fixType: 'ai' };
}

function getMatchBand(score: number): string {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Very Good Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  if (score >= 50) return 'Below Average';
  if (score >= 40) return 'Poor Match';
  if (score >= 30) return 'Very Poor';
  if (score >= 20) return 'Inadequate';
  return 'Minimal Match';
}

function getInterviewProbability(score: number): string {
  if (score >= 90) return '85-100%';
  if (score >= 80) return '70-84%';
  if (score >= 70) return '55-69%';
  if (score >= 60) return '35-54%';
  if (score >= 50) return '20-34%';
  if (score >= 40) return '8-19%';
  if (score >= 30) return '3-7%';
  if (score >= 20) return '1-2%';
  return '0-0.5%';
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  'ATS Compatibility': 18,
  'Keyword Alignment': 24,
  'Impact & Metrics': 18,
  'Experience Alignment': 8,
  'Project Relevance': 10,
  'Skills Quality': 12,
  'Project Quality': 8,
  'Profile Completeness': 2,
  'Advanced Diagnostics': 0,
};

export function scoreResumeAgainstJD(resume: ResumeData, jobDescription: string): JDScoringResult {
  const jd = analyzeJD(jobDescription);
  const keywordSkillContext = buildKeywordSkillScoringContext(resume, jobDescription);

  const parameters: ParameterScore[] = [
    scoreP1SingleColumn(resume),
    scoreP2NoTablesImages(resume),
    scoreP3StandardHeadings(resume),
    scoreP4BulletFormatting(resume),
    scoreP5PdfParsingSafety(resume),
    scoreP6HardSkillMatch(resume, jd, keywordSkillContext),
    scoreP7ToolMatch(resume, jd, keywordSkillContext),
    scoreP8MandatorySkillPresence(resume, jd, keywordSkillContext),
    scoreP9RoleTitleAlignment(resume, jd, jobDescription, keywordSkillContext),
    scoreP10KeywordDensityBalance(resume, jd, keywordSkillContext),
    scoreP11MetricDensity(resume),
    scoreP12WritingStrength(resume),
    scoreP13NoVaguePhrases(resume),
    scoreP14StrongActionVerbs(resume),
    scoreP15VerbRepetition(resume),
    scoreP16NoPassiveVoice(resume),
    scoreP17YearsMatch(resume, jd),
    scoreP18SeniorityAlignment(resume, jd),
    scoreP19ProjectSkillAlignment(resume, jd),
    scoreP20TechStackRelevance(resume, jd, keywordSkillContext),
    scoreP21OnlinePresence(resume),
    scoreP22SkillsCategorization(resume, keywordSkillContext),
    scoreP23SkillRelevance(resume, jd, keywordSkillContext),
    scoreP24ProjectCount(resume),
    scoreP25ProjectTools(resume),
    scoreP26ProjectMetrics(resume),
    scoreP27ProjectImpact(resume),
    scoreP28IndustryKeywords(resume, jd, keywordSkillContext),
  ];

  const categoryNames = Object.keys(CATEGORY_WEIGHTS);
  const categories: CategoryScore[] = categoryNames.map(catName => {
    const catParams = parameters.filter(p => p.category === catName);
    const catScore = catParams.reduce((sum, p) => sum + p.score, 0);
    const catMax = catParams.reduce((sum, p) => sum + p.maxScore, 0);
    return {
      name: catName,
      weight: CATEGORY_WEIGHTS[catName],
      parameters: catParams,
      score: catScore,
      maxScore: catMax,
      percentage: catMax > 0 ? Math.round((catScore / catMax) * 100) : 0,
    };
  });

  let weightedTotal = 0;
  let weightSum = 0;
  categories.forEach(cat => {
    weightedTotal += cat.percentage * cat.weight;
    weightSum += cat.weight;
  });
  const overallScore = Math.round(weightedTotal / weightSum);

  const fixableCount = parameters.filter(p => p.fixable && p.percentage < 80).length;
  const nonFixableCount = parameters.filter(p => !p.fixable && p.percentage < 80).length;

  return {
    overallScore,
    categories,
    parameters,
    matchBand: getMatchBand(overallScore),
    interviewProbability: getInterviewProbability(overallScore),
    fixableCount,
    nonFixableCount,
  };
}
