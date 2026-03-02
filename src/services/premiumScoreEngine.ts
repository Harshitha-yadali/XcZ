import { ResumeData, UserType } from '../types/resume';
import {
  ALL_HARD_SKILLS,
  ALL_TOOL_SKILLS,
  SOFT_SKILLS,
  CONTACT_PROFILE_WORDS,
} from '../constants/skillsTaxonomy';
import { scoreResumeAgainstJD } from './jdScoringEngine';

export interface CategoryScore {
  id: string;
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  percentage: number;
  status: 'excellent' | 'good' | 'needs_work' | 'poor';
  subChecks: SubCheck[];
  suggestions: string[];
  quickWins: string[];
}

export interface SubCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'important' | 'minor';
  detail: string;
  fix?: string;
}

export interface SkillBucket {
  mustHave: SkillMatch[];
  supporting: SkillMatch[];
  irrelevant: SkillMatch[];
  missing: SkillMatch[];
}

export interface SkillMatch {
  skill: string;
  category?: string;
  inResume: boolean;
  inJD: boolean;
  importance: 'critical' | 'important' | 'nice_to_have';
}

export interface ProjectScore {
  title: string;
  score: number;
  maxScore: number;
  checks: {
    realWorldProblem: boolean;
    toolsMentioned: boolean;
    measurableResults: boolean;
    businessImpact: boolean;
    githubLink: boolean;
  };
  suggestions: string[];
}

export interface PremiumScoreResult {
  overallScore: number;
  userType: UserType;
  categories: CategoryScore[];
  skillBuckets: SkillBucket;
  projectScores: ProjectScore[];
  redFlags: RedFlagItem[];
  quickWins: QuickWin[];
  projectedScore: number;
  matchQuality: string;
  shortlistChance: string;
  onlinePresence: OnlinePresenceScore;
}

export interface RedFlagItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  fix: string;
  category: string;
}

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  impact: number;
  effort: 'easy' | 'medium' | 'hard';
  category: string;
}

export interface OnlinePresenceScore {
  score: number;
  maxScore: number;
  linkedin: boolean;
  github: boolean;
  portfolio: boolean;
  suggestions: string[];
}

const FRESHER_WEIGHTS: Record<string, number> = {
  section_order: 10,
  keyword_match: 25,
  projects_quality: 25,
  ats_compatibility: 15,
  skills_quality: 10,
  internship: 5,
  education: 5,
  online_presence: 5,
};

const EXPERIENCED_WEIGHTS: Record<string, number> = {
  keyword_match: 25,
  ats_compatibility: 15,
  impact_achievements: 20,
  skills_quality: 10,
  experience_quality: 15,
  structure_readability: 5,
  education: 5,
  online_presence: 5,
};

const STUDENT_WEIGHTS = { ...FRESHER_WEIGHTS };

function getWeights(userType: UserType): Record<string, number> {
  if (userType === 'experienced') return EXPERIENCED_WEIGHTS;
  if (userType === 'student') return STUDENT_WEIGHTS;
  return FRESHER_WEIGHTS;
}

function statusFromPercentage(pct: number): CategoryScore['status'] {
  if (pct >= 80) return 'excellent';
  if (pct >= 60) return 'good';
  if (pct >= 40) return 'needs_work';
  return 'poor';
}

function extractJDKeywords(jd: string): { hard: string[]; soft: string[]; tools: string[]; industry: string[] } {
  const hardSkillPatterns = ALL_HARD_SKILLS.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const softSkillPatterns = SOFT_SKILLS.map(s => s.replace(/-/g, '.'));

  const toolPatterns = ALL_TOOL_SKILLS
    .filter(s => !CONTACT_PROFILE_WORDS.has(s.toLowerCase()))
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const extractMatches = (patterns: string[]): string[] => {
    const found: string[] = [];
    for (const p of patterns) {
      const regex = new RegExp(`\\b${p}\\b`, 'gi');
      const match = jd.match(regex);
      if (match) {
        found.push(match[0]);
      }
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
    let m;
    while ((m = techWordRegex.exec(jd)) !== null) {
      const w = m[1];
      if (w.length >= 2 && w.length <= 25 && !nonTechWords.has(w.toLowerCase())) {
        extra.push(w);
      }
    }
    hardFound.push(...[...new Set(extra)].slice(0, 10));
  }

  const industryWords: string[] = [];
  const sentences = jd.split(/[.!?\n]+/);
  for (const s of sentences) {
    const words = s.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g);
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

function extractResumeSkills(resumeText: string, resumeData?: ResumeData): string[] {
  const skills: string[] = [];
  if (resumeData?.skills) {
    for (const cat of resumeData.skills) {
      skills.push(...cat.list.filter(isValidSkillName));
    }
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
  resumeData?: ResumeData
): SkillBucket {
  const jdKeywords = extractJDKeywords(jobDescription);
  const resumeSkills = extractResumeSkills(resumeText, resumeData);
  const resumeLower = resumeText.toLowerCase();

  const allJDSkills = [...jdKeywords.hard, ...jdKeywords.tools]
    .filter(s => !isContactWord(s));
  const allJDSoft = jdKeywords.soft;

  const mustHave: SkillMatch[] = [];
  const supporting: SkillMatch[] = [];
  const missing: SkillMatch[] = [];
  const irrelevant: SkillMatch[] = [];
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

  return { mustHave, supporting, irrelevant, missing };
}

function scoreSectionOrder(resumeText: string, userType: UserType): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 10;

  const text = resumeText.toLowerCase();

  const sectionPositions: Record<string, number> = {};
  const sectionPatterns: Record<string, RegExp> = {
    contact: /(?:email|phone|@|linkedin|github)/i,
    summary: /(?:summary|objective|profile|about me)/i,
    skills: /(?:technical skills?|skills?|technologies)/i,
    projects: /(?:projects?|portfolio)/i,
    experience: /(?:experience|work history|employment|internship)/i,
    education: /(?:education|academic|university|college|degree)/i,
    certifications: /(?:certification|certified|certificate)/i,
  };

  for (const [section, pattern] of Object.entries(sectionPatterns)) {
    const match = text.search(pattern);
    if (match !== -1) sectionPositions[section] = match;
  }

  const idealOrder = userType === 'experienced'
    ? ['contact', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications']
    : ['contact', 'summary', 'skills', 'projects', 'experience', 'education', 'certifications'];

  const skillsPos = sectionPositions.skills ?? Infinity;
  const textMidpoint = text.length / 2;
  const skillsInTopHalf = skillsPos < textMidpoint;
  checks.push({
    id: 'skills_top_half',
    label: 'Skills appear in top half',
    passed: skillsInTopHalf,
    severity: 'important',
    detail: skillsInTopHalf ? 'Skills section is prominently placed' : 'Skills section is too low',
    fix: 'Move your skills section higher in the resume',
  });
  if (skillsInTopHalf) raw += 2;

  if (userType !== 'experienced') {
    const projPos = sectionPositions.projects ?? Infinity;
    const eduPos = sectionPositions.education ?? Infinity;
    const projBeforeEdu = projPos < eduPos;
    checks.push({
      id: 'projects_before_education',
      label: 'Projects appear before Education',
      passed: projBeforeEdu,
      severity: 'important',
      detail: projBeforeEdu ? 'Projects section comes before education' : 'Education appears before projects',
      fix: 'Move projects section above education for fresher resumes',
    });
    if (projBeforeEdu) raw += 2;
    else suggestions.push('Move Projects section above Education - recruiters prioritize projects for freshers');
  } else {
    raw += 2;
    checks.push({
      id: 'projects_before_education',
      label: 'Experience before Education',
      passed: true,
      severity: 'important',
      detail: 'Checked',
    });
  }

  let orderScore = 0;
  const presentSections = idealOrder.filter(s => sectionPositions[s] !== undefined);
  for (let i = 1; i < presentSections.length; i++) {
    if ((sectionPositions[presentSections[i]] ?? 0) > (sectionPositions[presentSections[i - 1]] ?? 0)) {
      orderScore++;
    }
  }
  const flowGood = presentSections.length > 1 && orderScore >= presentSections.length - 2;
  checks.push({
    id: 'logical_flow',
    label: 'Clean logical flow',
    passed: flowGood,
    severity: 'minor',
    detail: flowGood ? 'Sections follow a logical order' : 'Section order could be improved',
    fix: 'Reorder sections to follow: ' + idealOrder.join(' > '),
  });
  if (flowGood) raw += 2;

  const wordCount = text.split(/\s+/).length;
  const isOnePage = wordCount <= 700;
  checks.push({
    id: 'one_page',
    label: userType === 'experienced' ? 'Appropriate length' : '1-page length',
    passed: userType === 'experienced' ? wordCount <= 1200 : isOnePage,
    severity: userType !== 'experienced' ? 'important' : 'minor',
    detail: userType === 'experienced'
      ? (wordCount <= 1200 ? 'Resume length is appropriate' : 'Resume may be too long')
      : (isOnePage ? 'Resume fits on one page' : 'Resume may exceed one page'),
    fix: userType !== 'experienced' ? 'Trim your resume to fit on one page' : 'Keep resume under 2 pages',
  });
  if ((userType !== 'experienced' && isOnePage) || (userType === 'experienced' && wordCount <= 1200)) raw += 2;
  else suggestions.push('Trim content to keep resume concise');

  const lines = resumeText.split('\n');
  const emptyLines = lines.filter(l => l.trim() === '').length;
  const spacingGood = emptyLines >= 3 && emptyLines <= lines.length * 0.35;
  checks.push({
    id: 'spacing',
    label: 'Proper spacing & white space',
    passed: spacingGood,
    severity: 'minor',
    detail: spacingGood ? 'Good use of white space' : 'Adjust spacing for readability',
    fix: 'Add appropriate spacing between sections',
  });
  if (spacingGood) raw += 2;

  if (userType !== 'experienced') {
    const eduPos = sectionPositions.education ?? Infinity;
    const eduAtTop = eduPos < textMidpoint * 0.3;
    if (eduAtTop) {
      suggestions.push('Education is at the top of resume - for tech freshers, Skills and Projects should come first');
      quickWins.push('Move Education section below Projects');
    }

    const hobbiesMatch = text.match(/(?:hobbies|interests|extracurricular)/i);
    if (hobbiesMatch && text.indexOf(hobbiesMatch[0]) < textMidpoint) {
      suggestions.push('Hobbies/Interests section is in the top half - move it to the bottom');
    }
  }

  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'section_order',
    name: 'Section Order & Structure',
    weight: getWeights(userType).section_order ?? getWeights(userType).structure_readability ?? 5,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreKeywordMatch(
  resumeText: string,
  jobDescription: string,
  skillBuckets: SkillBucket,
  userType: UserType
): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 25;

  const totalJD = skillBuckets.mustHave.length + skillBuckets.missing.filter(s => s.importance === 'critical').length;
  const matched = skillBuckets.mustHave.length;
  const hardPct = totalJD > 0 ? Math.round((matched / totalJD) * 100) : 75;
  checks.push({
    id: 'hard_skills_match',
    label: 'Hard skills match',
    passed: hardPct >= 60,
    severity: 'critical',
    detail: totalJD > 0
      ? `${hardPct}% of required hard skills found (${matched}/${totalJD})`
      : 'Could not extract specific skill requirements from JD',
    fix: hardPct < 60 ? 'Add missing technical skills from the job description' : undefined,
  });
  raw += Math.round((hardPct / 100) * 8);

  const jdKeywords = extractJDKeywords(jobDescription);
  const resumeLower = resumeText.toLowerCase();
  const toolsMatched = jdKeywords.tools.filter(t => resumeLower.includes(t.toLowerCase())).length;
  const toolsPct = jdKeywords.tools.length > 0 ? Math.round((toolsMatched / jdKeywords.tools.length) * 100) : 100;
  checks.push({
    id: 'tools_match',
    label: 'Tools match',
    passed: toolsPct >= 50,
    severity: 'important',
    detail: `${toolsPct}% of required tools found`,
    fix: 'Add missing tools mentioned in the job description',
  });
  raw += Math.round((toolsPct / 100) * 5);

  const industryMatched = jdKeywords.industry.filter(k => resumeLower.includes(k.toLowerCase())).length;
  const industryPct = jdKeywords.industry.length > 0 ? Math.round((industryMatched / jdKeywords.industry.length) * 100) : 50;
  checks.push({
    id: 'industry_keywords',
    label: 'Industry keywords',
    passed: industryPct >= 30,
    severity: 'minor',
    detail: `${industryPct}% industry keyword coverage`,
  });
  raw += Math.round((industryPct / 100) * 3);

  const criticalMissing = skillBuckets.missing.filter(s => s.importance === 'critical');
  checks.push({
    id: 'missing_keywords',
    label: 'No critical missing keywords',
    passed: criticalMissing.length <= 2,
    severity: 'critical',
    detail: criticalMissing.length > 0
      ? `${criticalMissing.length} critical keywords missing: ${criticalMissing.slice(0, 5).map(s => s.skill).join(', ')}`
      : 'All critical keywords present',
    fix: criticalMissing.length > 0 ? `Add: ${criticalMissing.slice(0, 3).map(s => s.skill).join(', ')}` : undefined,
  });
  if (criticalMissing.length <= 2) raw += 4;
  else if (criticalMissing.length <= 5) raw += 2;

  const jdLower = jobDescription.toLowerCase();
  const titlePatterns = jdLower.match(/(?:looking for|hiring|role of|position:?)\s*([^\n.]+)/i);
  const jdTitle = titlePatterns ? titlePatterns[1].trim() : '';
  const titleWords = jdTitle.split(/\s+/).filter(w => w.length > 2);
  const titleMatched = titleWords.filter(w => resumeLower.includes(w)).length;
  const titlePct = titleWords.length > 0 ? Math.round((titleMatched / titleWords.length) * 100) : 50;
  checks.push({
    id: 'title_alignment',
    label: 'Job title alignment',
    passed: titlePct >= 50,
    severity: 'important',
    detail: `${titlePct}% job title keyword alignment`,
  });
  raw += Math.round((titlePct / 100) * 3);

  const allJDTerms = [...jdKeywords.hard, ...jdKeywords.soft, ...jdKeywords.tools];
  const termCounts = allJDTerms.filter(t => resumeLower.includes(t.toLowerCase())).length;
  const densityPct = allJDTerms.length > 0 ? Math.round((termCounts / allJDTerms.length) * 100) : 0;
  checks.push({
    id: 'semantic_similarity',
    label: 'Overall keyword density',
    passed: densityPct >= 40,
    severity: 'minor',
    detail: `${densityPct}% overall keyword coverage`,
  });
  raw += Math.round((densityPct / 100) * 2);

  if (criticalMissing.length > 0) {
    quickWins.push(`Add these keywords to your skills: ${criticalMissing.slice(0, 3).map(s => s.skill).join(', ')}`);
  }
  if (hardPct < 60) {
    suggestions.push('Your resume is missing many required hard skills from the job description');
  }

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'keyword_match',
    name: 'Keyword & JD Match',
    weight: getWeights(userType).keyword_match,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreProjectsQuality(resumeText: string, resumeData?: ResumeData, userType?: UserType): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 25;

  const projects = resumeData?.projects || [];
  const projectCount = projects.length;

  const hasProjects = projectCount >= 2;
  checks.push({
    id: 'project_count',
    label: '2-4 strong projects',
    passed: projectCount >= 2 && projectCount <= 6,
    severity: 'critical',
    detail: `${projectCount} project(s) found`,
    fix: projectCount < 2 ? 'Add at least 2 relevant projects' : undefined,
  });
  if (hasProjects) raw += 4;
  else if (projectCount === 1) raw += 2;

  let totalToolsScore = 0;
  let totalMetricsScore = 0;
  let totalProblemScore = 0;
  let totalImpactScore = 0;
  let totalGithubScore = 0;

  for (const proj of projects) {
    const bullets = (proj.bullets || []).join(' ');
    const allText = `${proj.title} ${proj.description || ''} ${bullets}`;
    const textLower = allText.toLowerCase();

    const hasTools = proj.techStack?.length ? proj.techStack.length > 0 :
      /(?:react|python|java|node|express|django|flask|mongodb|sql|aws|docker|kubernetes|tensorflow|pytorch)/i.test(textLower);
    if (hasTools) totalToolsScore++;

    const hasMetrics = /\d+%|\d+x|\$\d+|\d+\s*(?:users?|customers?|requests?|transactions?|ms|seconds?|hours?|days?)/i.test(allText);
    if (hasMetrics) totalMetricsScore++;

    const hasProblem = /(?:solved|addressed|built|developed|created|implemented|designed|automated|optimized|reduced|improved|streamlined)/i.test(textLower);
    if (hasProblem) totalProblemScore++;

    const hasImpact = /(?:increased|decreased|reduced|improved|saved|generated|achieved|resulted|enhanced|boosted)/i.test(textLower);
    if (hasImpact) totalImpactScore++;

    if (proj.githubUrl || /github\.com/i.test(allText) || /portfolio/i.test(allText)) totalGithubScore++;
  }

  const effectiveCount = Math.max(projectCount, 1);

  checks.push({
    id: 'real_world_problem',
    label: 'Real-world problems solved',
    passed: totalProblemScore >= effectiveCount * 0.5,
    severity: 'important',
    detail: `${totalProblemScore}/${projectCount} projects describe real-world problems`,
    fix: 'Describe the problem each project solves',
  });
  raw += Math.round((totalProblemScore / effectiveCount) * 5);

  checks.push({
    id: 'tools_mentioned',
    label: 'Tools clearly mentioned',
    passed: totalToolsScore >= effectiveCount * 0.5,
    severity: 'important',
    detail: `${totalToolsScore}/${projectCount} projects mention specific tools/tech`,
    fix: 'List the specific technologies used in each project',
  });
  raw += Math.round((totalToolsScore / effectiveCount) * 4);

  checks.push({
    id: 'measurable_results',
    label: 'Measurable results (% / numbers)',
    passed: totalMetricsScore >= 1,
    severity: 'critical',
    detail: `${totalMetricsScore}/${projectCount} projects include metrics`,
    fix: 'Add quantifiable results like "reduced load time by 40%"',
  });
  raw += Math.round((totalMetricsScore / effectiveCount) * 5);
  if (totalMetricsScore === 0) quickWins.push('Add at least one metric to your top project (e.g., "served 1000+ users")');

  checks.push({
    id: 'business_impact',
    label: 'Business impact stated',
    passed: totalImpactScore >= 1,
    severity: 'important',
    detail: `${totalImpactScore}/${projectCount} projects show business impact`,
    fix: 'Describe the impact your project had (users served, time saved, etc.)',
  });
  raw += Math.round((totalImpactScore / effectiveCount) * 4);

  if (totalGithubScore > 0) raw += 3;

  if (projectCount < 2) suggestions.push('Add at least 2 projects with real-world relevance');
  if (totalMetricsScore === 0) suggestions.push('Include measurable outcomes in project descriptions');

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'projects_quality',
    name: 'Projects Quality',
    weight: getWeights(userType || 'fresher').projects_quality ?? 0,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreATSCompatibility(resumeText: string, userType: UserType): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 15;

  const tableChars = /[│┃┆┇┊┋]|[\u2500-\u257F]/g;
  const noTables = !tableChars.test(resumeText);
  checks.push({
    id: 'no_tables',
    label: 'No tables',
    passed: noTables,
    severity: 'critical',
    detail: noTables ? 'No table formatting detected' : 'Table formatting detected',
    fix: 'Remove all tables from your resume',
  });
  if (noTables) raw += 2;

  const noImages = !/\[image\]|\[logo\]|\.png|\.jpg|\.jpeg|\.gif|\.svg/i.test(resumeText);
  checks.push({
    id: 'no_images',
    label: 'No images/graphics',
    passed: noImages,
    severity: 'critical',
    detail: noImages ? 'No images detected' : 'Images or graphics references found',
    fix: 'Remove all images and graphics from your resume',
  });
  if (noImages) raw += 2;

  const standardHeadings = ['experience', 'education', 'skills', 'projects', 'summary', 'certifications'];
  const foundStandard = standardHeadings.filter(h =>
    new RegExp(`\\b${h}\\b`, 'i').test(resumeText)
  ).length;
  const headingsGood = foundStandard >= 3;
  checks.push({
    id: 'standard_headings',
    label: 'Standard headings',
    passed: headingsGood,
    severity: 'important',
    detail: `${foundStandard}/6 standard section headings found`,
    fix: 'Use standard headings: Experience, Education, Skills, Projects, etc.',
  });
  if (headingsGood) raw += 2;

  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resumeText);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText);
  checks.push({
    id: 'contact_info',
    label: 'Contact information present',
    passed: hasEmail && hasPhone,
    severity: 'critical',
    detail: `Email: ${hasEmail ? 'found' : 'missing'}, Phone: ${hasPhone ? 'found' : 'missing'}`,
    fix: !hasEmail ? 'Add your email address' : !hasPhone ? 'Add your phone number' : undefined,
  });
  if (hasEmail && hasPhone) raw += 2;

  const dateFormats = resumeText.match(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{2}\/\d{4}|\d{4}\s*[-–]\s*(?:present|\d{4})/gi) || [];
  const datesGood = dateFormats.length >= 1;
  checks.push({
    id: 'date_format',
    label: 'Proper date format',
    passed: datesGood,
    severity: 'minor',
    detail: datesGood ? 'Date formats look consistent' : 'Inconsistent or missing dates',
    fix: 'Use consistent date format (e.g., "Jan 2024 - Present")',
  });
  if (datesGood) raw += 2;

  const specialChars = /[★☆♦♣♠●○◆◇▶►▻◄◅✓✗✘✦✧✩✪✫✬✭✮✯✰]/g;
  const noSpecialChars = !specialChars.test(resumeText);
  checks.push({
    id: 'no_special_chars',
    label: 'No special characters',
    passed: noSpecialChars,
    severity: 'important',
    detail: noSpecialChars ? 'No problematic special characters' : 'Special characters found that may break ATS',
    fix: 'Replace decorative characters with standard bullets (-) or (*)' ,
  });
  if (noSpecialChars) raw += 2;

  const bulletStyles = resumeText.match(/^[\s]*[•\-\*\u2022\u2023\u25E6]/gm) || [];
  const uniqueStyles = new Set(bulletStyles.map(b => b.trim()[0]));
  const cleanParsing = uniqueStyles.size <= 2;
  checks.push({
    id: 'clean_parsing',
    label: 'Clean ATS parsing',
    passed: cleanParsing,
    severity: 'minor',
    detail: cleanParsing ? 'Consistent formatting for ATS' : 'Mixed formatting may confuse ATS parsers',
    fix: 'Use consistent bullet style throughout',
  });
  if (cleanParsing) raw += 3;

  if (!noTables) quickWins.push('Remove tables - use plain text formatting instead');
  if (!noSpecialChars) quickWins.push('Replace special characters with standard bullets');

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'ats_compatibility',
    name: 'ATS Compatibility',
    weight: getWeights(userType).ats_compatibility,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreSkillsQuality(
  resumeText: string,
  jobDescription: string,
  resumeData?: ResumeData,
  userType?: UserType
): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 10;

  const skillCategories = resumeData?.skills || [];
  const isCategorized = skillCategories.length >= 2;
  checks.push({
    id: 'categorized',
    label: 'Skills categorized properly',
    passed: isCategorized,
    severity: 'important',
    detail: isCategorized ? `${skillCategories.length} skill categories found` : 'Skills not categorized',
    fix: 'Organize skills into categories: Programming, Frameworks, Tools, etc.',
  });
  if (isCategorized) raw += 2;
  else quickWins.push('Categorize skills: Programming, Libraries, Tools, Databases');

  const textLower = resumeText.toLowerCase();
  const softSkillsInTech = /(?:skills?|technical)[\s\S]{0,200}(?:communication|teamwork|leadership|problem.solving)/i.test(resumeText);
  checks.push({
    id: 'tech_over_soft',
    label: 'Technical > Soft skills separation',
    passed: !softSkillsInTech,
    severity: 'important',
    detail: !softSkillsInTech ? 'Technical and soft skills properly separated' : 'Soft skills mixed with technical skills',
    fix: 'Move soft skills to a separate section or Core Competencies',
  });
  if (!softSkillsInTech) raw += 2;

  const companyNames = ['wipro', 'tcs', 'infosys', 'cognizant', 'accenture', 'capgemini', 'hcl', 'tech mahindra'];
  const skillsSection = resumeText.match(/(?:skills?|technical skills?)[\s\S]*?(?=\n[A-Z][A-Za-z\s]+:|\n\n|$)/i);
  const skillsSectionText = skillsSection ? skillsSection[0].toLowerCase() : '';
  const hasFakeSkills = companyNames.some(c => skillsSectionText.includes(c));
  checks.push({
    id: 'no_fake_skills',
    label: 'No fake/invalid skills',
    passed: !hasFakeSkills,
    severity: 'critical',
    detail: !hasFakeSkills ? 'No invalid entries in skills' : 'Company names or non-skill items found in skills section',
    fix: 'Remove company names from skills section',
  });
  if (!hasFakeSkills) raw += 2;
  else quickWins.push('Remove company names from your skills section');

  const jdLower = jobDescription.toLowerCase();
  const allSkills = resumeData?.skills?.flatMap(s => s.list) || [];
  const relevantCount = allSkills.filter(s => jdLower.includes(s.toLowerCase())).length;
  const relevancePct = allSkills.length > 0 ? Math.round((relevantCount / allSkills.length) * 100) : 0;
  checks.push({
    id: 'relevant_only',
    label: 'Relevant skills for this role',
    passed: relevancePct >= 40,
    severity: 'important',
    detail: `${relevancePct}% of listed skills are relevant to the JD`,
    fix: 'Remove skills not relevant to the target role and add missing ones',
  });
  if (relevancePct >= 40) raw += 2;

  const skillTexts = allSkills.map(s => s.toLowerCase());
  const duplicates = skillTexts.filter((s, i) => skillTexts.indexOf(s) !== i);
  checks.push({
    id: 'no_repetition',
    label: 'No skill repetition',
    passed: duplicates.length === 0,
    severity: 'minor',
    detail: duplicates.length === 0 ? 'No duplicate skills' : `${duplicates.length} duplicate skill(s) found`,
    fix: 'Remove duplicate skills',
  });
  if (duplicates.length === 0) raw += 2;

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'skills_quality',
    name: 'Skills Section Quality',
    weight: getWeights(userType || 'fresher').skills_quality,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreInternship(resumeText: string, resumeData?: ResumeData): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 5;

  const experiences = resumeData?.workExperience || [];
  const textLower = resumeText.toLowerCase();
  const hasPracticalExp = experiences.length > 0 ||
    /intern|internship|trainee|work experience|employment|worked at|worked for/i.test(textLower);
  const hasFreelance = /freelance|contract|self.employed|personal project|live project/i.test(textLower);

  if (hasPracticalExp) {
    const isInternship = /intern|internship|trainee/i.test(textLower) ||
      experiences.some(e => /intern|trainee/i.test((e.company || '') + (e.title || '') + (e.role || '')));
    checks.push({
      id: 'has_internship',
      label: isInternship ? 'Internship present' : 'Work experience present',
      passed: true,
      severity: 'important',
      detail: isInternship ? 'Internship experience found' : 'Work experience found',
    });
    raw += 2;

    const allBullets = experiences.flatMap(e => e.bullets || []).join(' ');
    const hasTools = /(?:python|java|react|sql|excel|power bi|aws|docker|node|angular|vue|typescript|javascript)/i.test(allBullets + ' ' + textLower);
    checks.push({
      id: 'tools_used',
      label: 'Tools/technologies mentioned',
      passed: hasTools,
      severity: 'minor',
      detail: hasTools ? 'Tools/technologies mentioned in experience' : 'No specific tools mentioned',
      fix: 'Add specific tools used in your experience',
    });
    if (hasTools) raw += 1;

    const hasMetrics = /\d+%|\d+x|\$\d+|\d+\s*(?:users|records|lines|files|clients|projects|members)/i.test(allBullets);
    checks.push({
      id: 'measurable_impact',
      label: 'Measurable impact',
      passed: hasMetrics,
      severity: 'important',
      detail: hasMetrics ? 'Quantified results present' : 'No measurable impact shown',
      fix: 'Add metrics to your experience bullets (e.g., "reduced load time by 40%")',
    });
    if (hasMetrics) raw += 2;
    else quickWins.push('Add at least one metric to your experience (e.g., "processed 5000+ records")');
  } else if (hasFreelance) {
    checks.push({
      id: 'has_internship',
      label: 'Freelance/live project experience',
      passed: true,
      severity: 'important',
      detail: 'Freelance or live project experience found',
    });
    raw += 3;
  } else {
    checks.push({
      id: 'has_internship',
      label: 'Practical experience',
      passed: false,
      severity: 'important',
      detail: 'No internship, work experience, or live project found',
      fix: 'Add any practical experience - internships, work experience, or live projects',
    });
    suggestions.push('Consider adding internship or work experience');
  }

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'internship',
    name: 'Internship / Practical Exposure',
    weight: 5,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreImpactAchievements(resumeText: string, resumeData?: ResumeData): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 20;

  const allBullets = resumeData?.workExperience?.flatMap(e => e.bullets || []) || [];
  const totalBullets = allBullets.length || 1;

  const quantified = allBullets.filter(b => /\d+%|\$\d+|\d+x|\d+\s*(?:users|clients|projects|team|members)/i.test(b));
  const quantPct = Math.round((quantified.length / totalBullets) * 100);
  checks.push({
    id: 'quantified_results',
    label: 'Quantified results (%, $, numbers)',
    passed: quantPct >= 30,
    severity: 'critical',
    detail: `${quantPct}% of bullets have quantified results`,
    fix: 'Add numbers, percentages, or dollar amounts to more bullet points',
  });
  raw += Math.round((Math.min(quantPct, 100) / 100) * 5);

  const actionVerbs = /^(?:led|managed|developed|built|designed|implemented|created|launched|achieved|delivered|optimized|reduced|increased|improved|automated|streamlined|spearheaded|orchestrated)/i;
  const strongVerbCount = allBullets.filter(b => actionVerbs.test(b.trim())).length;
  const verbPct = Math.round((strongVerbCount / totalBullets) * 100);
  checks.push({
    id: 'action_verbs',
    label: 'Strong action verbs',
    passed: verbPct >= 40,
    severity: 'important',
    detail: `${verbPct}% of bullets start with strong action verbs`,
    fix: 'Start bullet points with impactful verbs like Led, Built, Achieved',
  });
  raw += Math.round((Math.min(verbPct, 100) / 100) * 4);

  const achievementPattern = /(?:achieved|resulted|led to|increased|reduced|improved|saved|generated|delivered|produced)/i;
  const responsibilityPattern = /(?:responsible for|duties include|tasked with|in charge of)/i;
  const achievements = allBullets.filter(b => achievementPattern.test(b)).length;
  const responsibilities = allBullets.filter(b => responsibilityPattern.test(b)).length;
  const ratio = achievements / Math.max(achievements + responsibilities, 1);
  checks.push({
    id: 'results_vs_responsibilities',
    label: 'Results vs responsibilities ratio',
    passed: ratio >= 0.5,
    severity: 'important',
    detail: `${Math.round(ratio * 100)}% achievement-focused (target: 50%+)`,
    fix: 'Convert responsibility statements to achievement statements',
  });
  raw += Math.round(ratio * 5);

  const impactKeywords = /(?:revenue|cost|efficiency|performance|user|customer|growth|scale|productivity)/i;
  const impactBullets = allBullets.filter(b => impactKeywords.test(b)).length;
  const impactPct = Math.round((impactBullets / totalBullets) * 100);
  checks.push({
    id: 'business_impact',
    label: 'Business impact mentioned',
    passed: impactPct >= 20,
    severity: 'important',
    detail: `${impactPct}% of bullets mention business impact`,
    fix: 'Connect your work to business outcomes (revenue, efficiency, growth)',
  });
  raw += Math.round((Math.min(impactPct, 100) / 100) * 3);

  const metricsInExp = /(?:improved by \d|reduced by \d|increased \d|saved \d|generated \$)/i.test(allBullets.join(' '));
  checks.push({
    id: 'performance_metrics',
    label: 'Performance improvement metrics',
    passed: metricsInExp,
    severity: 'minor',
    detail: metricsInExp ? 'Performance metrics found in experience' : 'No specific performance metrics',
    fix: 'Add "improved X by Y%" type statements',
  });
  if (metricsInExp) raw += 3;

  if (quantPct < 30) quickWins.push('Add a number or percentage to your top 3 bullet points');
  if (verbPct < 40) quickWins.push('Start bullets with action verbs: Led, Built, Delivered, Achieved');

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'impact_achievements',
    name: 'Impact & Achievements',
    weight: 20,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreExperienceQuality(resumeText: string, resumeData?: ResumeData): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 15;

  const experiences = resumeData?.workExperience || [];

  const hasRoles = experiences.every(e => e.role && e.role.length > 2);
  checks.push({
    id: 'clear_roles',
    label: 'Clear job roles',
    passed: hasRoles,
    severity: 'important',
    detail: hasRoles ? 'All positions have clear role titles' : 'Some positions missing clear role titles',
    fix: 'Ensure every position has a specific job title',
  });
  if (hasRoles) raw += 3;

  const hasCompanies = experiences.every(e => e.company && e.company.length > 1);
  checks.push({
    id: 'company_names',
    label: 'Proper company names',
    passed: hasCompanies,
    severity: 'important',
    detail: hasCompanies ? 'All positions list company names' : 'Missing company names',
  });
  if (hasCompanies) raw += 2;

  const hasDuration = experiences.every(e => e.year && e.year.length > 3);
  checks.push({
    id: 'duration_clarity',
    label: 'Duration clarity',
    passed: hasDuration,
    severity: 'minor',
    detail: hasDuration ? 'All positions have date ranges' : 'Some positions missing dates',
    fix: 'Add date ranges to all positions',
  });
  if (hasDuration) raw += 2;

  const hasBullets = experiences.every(e => e.bullets && e.bullets.length >= 2);
  checks.push({
    id: 'bullet_clarity',
    label: 'Clear bullet points',
    passed: hasBullets,
    severity: 'important',
    detail: hasBullets ? 'All positions have detailed bullet points' : 'Some positions need more detail',
    fix: 'Add at least 3 bullet points per position',
  });
  if (hasBullets) raw += 3;

  const allBullets = experiences.flatMap(e => e.bullets || []);
  const specificBullets = allBullets.filter(b => /\b(?:developed|built|managed|led|implemented|designed|created|launched|automated|integrated)\b/i.test(b));
  const contributionClarity = allBullets.length > 0 ? specificBullets.length / allBullets.length >= 0.4 : false;
  checks.push({
    id: 'contribution_clarity',
    label: 'Contribution clarity',
    passed: contributionClarity,
    severity: 'important',
    detail: contributionClarity ? 'Clear individual contributions described' : 'Contributions could be more specific',
    fix: 'Use specific verbs to describe your individual contributions',
  });
  if (contributionClarity) raw += 3;

  if (experiences.length >= 3) {
    const titles = experiences.map(e => e.role.toLowerCase());
    const levels = ['intern', 'junior', 'associate', 'mid', 'senior', 'lead', 'principal', 'manager', 'director'];
    let progression = false;
    for (let i = 1; i < titles.length; i++) {
      const prevLevel = levels.findIndex(l => titles[i - 1].includes(l));
      const currLevel = levels.findIndex(l => titles[i].includes(l));
      if (currLevel > prevLevel && prevLevel >= 0) progression = true;
    }
    checks.push({
      id: 'role_progression',
      label: 'Role progression visible',
      passed: progression,
      severity: 'minor',
      detail: progression ? 'Career progression visible' : 'No clear career progression',
    });
    if (progression) raw += 2;
  } else {
    raw += 2;
  }

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'experience_quality',
    name: 'Experience Quality',
    weight: 15,
    score: raw,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreEducation(resumeText: string, resumeData?: ResumeData, userType?: UserType): CategoryScore {
  const checks: SubCheck[] = [];
  const suggestions: string[] = [];
  const quickWins: string[] = [];
  let raw = 0;
  const maxRaw = 5;

  const education = resumeData?.education || [];
  const certs = resumeData?.certifications || [];
  const textLower = resumeText.toLowerCase();

  const hasDegree = education.length > 0 || /(?:b\.tech|b\.e\.|b\.sc|m\.tech|m\.sc|mba|bachelor|master|phd|degree|diploma)/i.test(textLower);
  checks.push({
    id: 'relevant_degree',
    label: 'Relevant degree',
    passed: hasDegree,
    severity: 'important',
    detail: hasDegree ? 'Academic degree found' : 'No degree information found',
    fix: 'Add your educational qualifications',
  });
  if (hasDegree) raw += 2;

  if (userType !== 'experienced') {
    const gpaMatch = textLower.match(/(?:gpa|cgpa|percentage|score)[\s:]*(\d+\.?\d*)/i);
    const hasGPA = !!gpaMatch;
    const gpaValue = gpaMatch ? parseFloat(gpaMatch[1]) : 0;
    const isStrongGPA = gpaValue >= 7.0 || gpaValue >= 70;
    checks.push({
      id: 'gpa',
      label: 'GPA (if strong)',
      passed: hasGPA && isStrongGPA,
      severity: 'minor',
      detail: hasGPA ? `GPA: ${gpaValue}` : 'No GPA mentioned',
      fix: hasGPA && !isStrongGPA ? 'Consider removing GPA if below 7.0' : undefined,
    });
    if (hasGPA && isStrongGPA) raw += 1;
    else if (!hasGPA) raw += 0.5;
  } else {
    raw += 1;
  }

  const hasCerts = certs.length > 0 || /(?:certified|certification|certificate|coursera|udemy|aws certified|google certified)/i.test(textLower);
  checks.push({
    id: 'certifications',
    label: 'Relevant certifications',
    passed: hasCerts,
    severity: 'minor',
    detail: hasCerts ? `${certs.length || 'Some'} certification(s) found` : 'No certifications found',
    fix: 'Add relevant certifications from platforms like AWS, Google, Coursera',
  });
  if (hasCerts) raw += 1;
  else quickWins.push('Add at least one relevant certification');

  const credibleAuth = /(?:aws|google|microsoft|oracle|cisco|pmi|comptia|coursera|udemy|edx|mit|stanford|ibm)/i.test(textLower);
  checks.push({
    id: 'credible_authority',
    label: 'Credible authority',
    passed: credibleAuth || !hasCerts,
    severity: 'minor',
    detail: credibleAuth ? 'Certifications from recognized authorities' : 'Certification authority not recognized',
  });
  if (credibleAuth) raw += 1;

  raw = Math.min(raw, maxRaw);
  const pct = Math.round((raw / maxRaw) * 100);
  return {
    id: 'education',
    name: 'Education & Certifications',
    weight: getWeights(userType || 'fresher').education,
    score: Math.round(raw * 10) / 10,
    maxScore: maxRaw,
    percentage: pct,
    status: statusFromPercentage(pct),
    subChecks: checks,
    suggestions,
    quickWins,
  };
}

function scoreOnlinePresence(resumeText: string, resumeData?: ResumeData): OnlinePresenceScore {
  const textLower = resumeText.toLowerCase();

  const linkedin = /linkedin\.com\/in\//i.test(resumeText) || !!resumeData?.linkedin;
  const github = /github\.com\//i.test(resumeText) || !!resumeData?.github;
  const portfolio = /(?:portfolio|\.vercel\.app|\.netlify\.app|\.github\.io|\.dev|personal.website|\.com\/portfolio)/i.test(textLower);

  let score = 0;
  const maxScore = 5;
  const suggestions: string[] = [];

  if (linkedin) score += 2;
  else suggestions.push('Add your LinkedIn profile URL to your resume');

  if (github) score += 2;
  else suggestions.push('Add your GitHub profile URL to your resume');

  if (portfolio) score += 1;

  return { score, maxScore, linkedin, github, portfolio, suggestions };
}

function detectRedFlags(resumeText: string, resumeData?: ResumeData, userType?: UserType): RedFlagItem[] {
  const flags: RedFlagItem[] = [];
  const textLower = resumeText.toLowerCase();

  if (userType !== 'experienced') {
    const eduMatch = textLower.search(/education/i);
    const skillsMatch = textLower.search(/skills/i);
    if (eduMatch !== -1 && skillsMatch !== -1 && eduMatch < skillsMatch) {
      flags.push({
        id: 'edu_at_top',
        title: 'Education at top of resume',
        severity: 'high',
        description: 'For tech freshers, education should come after Skills and Projects',
        fix: 'Move Skills and Projects above Education section',
        category: 'structure',
      });
    }

    const softSkillsPos = textLower.search(/(?:soft skills|core competencies|interpersonal)/i);
    const projectsPos = textLower.search(/projects?/i);
    if (softSkillsPos !== -1 && projectsPos !== -1 && softSkillsPos < projectsPos) {
      flags.push({
        id: 'soft_above_projects',
        title: 'Soft skills section above projects',
        severity: 'medium',
        description: 'Soft skills appearing before projects reduces technical credibility',
        fix: 'Move Projects section above soft skills',
        category: 'structure',
      });
    }

    const hobbiesPos = textLower.search(/(?:hobbies|interests|extracurricular)/i);
    if (hobbiesPos !== -1 && hobbiesPos < textLower.length / 2) {
      flags.push({
        id: 'hobbies_top_half',
        title: 'Hobbies in top half of resume',
        severity: 'medium',
        description: 'Hobbies should be at the very bottom if included at all',
        fix: 'Move Hobbies/Interests to the bottom of your resume',
        category: 'structure',
      });
    }

    const wordCount = resumeText.split(/\s+/).length;
    if (wordCount > 700) {
      flags.push({
        id: 'two_page_resume',
        title: '2-page resume (for fresher)',
        severity: 'high',
        description: 'Fresher resumes should be 1 page maximum',
        fix: 'Trim content to fit on a single page',
        category: 'structure',
      });
    }
  }

  const hasLinkedin = /linkedin\.com\/in\//i.test(resumeText) || !!resumeData?.linkedin;
  const hasGithub = /github\.com\//i.test(resumeText) || !!resumeData?.github;

  if (!hasLinkedin) {
    flags.push({
      id: 'missing_linkedin',
      title: 'LinkedIn URL missing',
      severity: 'high',
      description: 'Recruiters expect a LinkedIn profile on every resume. Missing it reduces your online presence score.',
      fix: 'Add your LinkedIn profile URL (linkedin.com/in/yourname) to the contact section',
      category: 'online_presence',
    });
  }

  if (!hasGithub) {
    flags.push({
      id: 'missing_github',
      title: 'GitHub / Portfolio URL missing',
      severity: 'high',
      description: 'For tech roles, a GitHub or portfolio link shows your code quality and project work.',
      fix: 'Add your GitHub profile URL (github.com/yourname) to the contact section',
      category: 'online_presence',
    });
  }

  const companySkills = ['wipro', 'tcs', 'infosys', 'cognizant', 'accenture', 'capgemini', 'hcl'];
  const skillsSection = resumeText.match(/(?:skills?|technical)[\s\S]*?(?=\n[A-Z][A-Za-z\s]+:|\n\n|$)/i);
  if (skillsSection) {
    const sectionLower = skillsSection[0].toLowerCase();
    const foundCompanies = companySkills.filter(c => sectionLower.includes(c));
    if (foundCompanies.length > 0) {
      flags.push({
        id: 'company_in_skills',
        title: 'Company names in skills section',
        severity: 'critical',
        description: `Found: ${foundCompanies.join(', ')} in skills section`,
        fix: 'Remove all company names from skills - they trigger ATS keyword stuffing flags',
        category: 'skills',
      });
    }
  }

  const words = textLower.split(/\s+/);
  const wordCounts: Record<string, number> = {};
  for (const w of words) {
    if (w.length > 4) wordCounts[w] = (wordCounts[w] || 0) + 1;
  }
  const maxRepeat = Math.max(...Object.values(wordCounts), 0);
  if (maxRepeat > 15) {
    flags.push({
      id: 'keyword_stuffing',
      title: 'Keyword stuffing detected',
      severity: 'critical',
      description: 'Excessive repetition of keywords detected - ATS systems penalize this',
      fix: 'Use keywords naturally throughout the resume, avoid excessive repetition',
      category: 'skills',
    });
  }

  if (/[│┃┆┇┊┋]|[\u2500-\u257F]/.test(resumeText)) {
    flags.push({
      id: 'table_formatting',
      title: 'Table formatting detected',
      severity: 'high',
      description: 'Tables can break ATS parsing completely',
      fix: 'Replace tables with plain text formatting',
      category: 'formatting',
    });
  }

  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(resumeText);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(resumeText);
  if (!hasEmail || !hasPhone) {
    flags.push({
      id: 'missing_contact',
      title: 'Missing contact information',
      severity: 'critical',
      description: `Missing: ${!hasEmail ? 'email' : ''}${!hasEmail && !hasPhone ? ', ' : ''}${!hasPhone ? 'phone' : ''}`,
      fix: 'Add email and phone number at the top of your resume',
      category: 'formatting',
    });
  }

  return flags;
}

function buildQuickWins(categories: CategoryScore[], redFlags: RedFlagItem[]): QuickWin[] {
  const wins: QuickWin[] = [];
  let id = 1;

  for (const cat of categories) {
    for (const qw of cat.quickWins) {
      wins.push({
        id: `qw_${id++}`,
        title: qw,
        description: `Improve your ${cat.name} score`,
        impact: Math.round((cat.weight / 100) * 10),
        effort: 'easy',
        category: cat.id,
      });
    }
  }

  for (const flag of redFlags.filter(f => f.severity === 'critical' || f.severity === 'high')) {
    wins.push({
      id: `rf_${id++}`,
      title: flag.fix,
      description: flag.description,
      impact: flag.severity === 'critical' ? 8 : 5,
      effort: 'easy',
      category: flag.category,
    });
  }

  return wins.sort((a, b) => b.impact - a.impact).slice(0, 5);
}

function calculateProjectedScore(categories: CategoryScore[], quickWins: QuickWin[]): number {
  const currentTotal = categories.reduce((sum, c) => sum + (c.percentage * c.weight / 100), 0);
  const potentialBoost = quickWins.reduce((sum, w) => sum + w.impact, 0);
  return Math.min(100, Math.round(currentTotal + potentialBoost * 0.5));
}

function getMatchQuality(score: number): string {
  if (score >= 85) return 'Excellent Match';
  if (score >= 75) return 'Very Good Match';
  if (score >= 65) return 'Good Match';
  if (score >= 55) return 'Fair Match';
  if (score >= 45) return 'Below Average';
  if (score >= 35) return 'Poor Match';
  return 'Needs Improvement';
}

function getShortlistChance(score: number): string {
  if (score >= 90) return '90%+';
  if (score >= 80) return '70-85%';
  if (score >= 70) return '50-70%';
  if (score >= 60) return '30-50%';
  if (score >= 50) return '15-30%';
  if (score >= 40) return '5-15%';
  return '1-5%';
}

export function runPremiumScoreEngine(
  resumeText: string,
  jobDescription: string,
  userType: UserType,
  resumeData?: ResumeData
): PremiumScoreResult {
  const skillBuckets = buildSkillBuckets(resumeText, jobDescription, resumeData);
  const onlinePresence = scoreOnlinePresence(resumeText, resumeData);

  const categories: CategoryScore[] = [];

  if (userType !== 'experienced') {
    categories.push(scoreSectionOrder(resumeText, userType));
    categories.push(scoreKeywordMatch(resumeText, jobDescription, skillBuckets, userType));
    categories.push(scoreProjectsQuality(resumeText, resumeData, userType));
    categories.push(scoreATSCompatibility(resumeText, userType));
    categories.push(scoreSkillsQuality(resumeText, jobDescription, resumeData, userType));
    categories.push(scoreInternship(resumeText, resumeData));
    categories.push(scoreEducation(resumeText, resumeData, userType));

    const onlineCat: CategoryScore = {
      id: 'online_presence',
      name: 'Online Presence',
      weight: 5,
      score: onlinePresence.score,
      maxScore: onlinePresence.maxScore,
      percentage: Math.round((onlinePresence.score / onlinePresence.maxScore) * 100),
      status: statusFromPercentage(Math.round((onlinePresence.score / onlinePresence.maxScore) * 100)),
      subChecks: [
        { id: 'linkedin', label: 'LinkedIn profile', passed: onlinePresence.linkedin, severity: 'important', detail: onlinePresence.linkedin ? 'LinkedIn URL found' : 'No LinkedIn URL' },
        { id: 'github', label: 'GitHub profile', passed: onlinePresence.github, severity: 'important', detail: onlinePresence.github ? 'GitHub URL found' : 'No GitHub URL' },
        { id: 'portfolio', label: 'Portfolio website', passed: onlinePresence.portfolio, severity: 'minor', detail: onlinePresence.portfolio ? 'Portfolio URL found' : 'No portfolio URL' },
      ],
      suggestions: onlinePresence.suggestions,
      quickWins: onlinePresence.linkedin ? [] : ['Add your LinkedIn URL to resume header'],
    };
    categories.push(onlineCat);
  } else {
    categories.push(scoreKeywordMatch(resumeText, jobDescription, skillBuckets, userType));
    categories.push(scoreATSCompatibility(resumeText, userType));
    categories.push(scoreImpactAchievements(resumeText, resumeData));
    categories.push(scoreSkillsQuality(resumeText, jobDescription, resumeData, userType));
    categories.push(scoreExperienceQuality(resumeText, resumeData));
    categories.push(scoreSectionOrder(resumeText, userType));
    categories.push(scoreEducation(resumeText, resumeData, userType));

    const onlineCat: CategoryScore = {
      id: 'online_presence',
      name: 'Online Presence',
      weight: 5,
      score: onlinePresence.score,
      maxScore: onlinePresence.maxScore,
      percentage: Math.round((onlinePresence.score / onlinePresence.maxScore) * 100),
      status: statusFromPercentage(Math.round((onlinePresence.score / onlinePresence.maxScore) * 100)),
      subChecks: [
        { id: 'linkedin', label: 'LinkedIn profile', passed: onlinePresence.linkedin, severity: 'important', detail: onlinePresence.linkedin ? 'LinkedIn URL found' : 'No LinkedIn URL' },
        { id: 'github', label: 'GitHub profile', passed: onlinePresence.github, severity: 'important', detail: onlinePresence.github ? 'GitHub URL found' : 'No GitHub URL' },
        { id: 'portfolio', label: 'Portfolio website', passed: onlinePresence.portfolio, severity: 'minor', detail: onlinePresence.portfolio ? 'Portfolio URL found' : 'No portfolio URL' },
      ],
      suggestions: onlinePresence.suggestions,
      quickWins: onlinePresence.linkedin ? [] : ['Add your LinkedIn URL to resume header'],
    };
    categories.push(onlineCat);
  }

  const redFlags = detectRedFlags(resumeText, resumeData, userType);

  const projectScores: ProjectScore[] = (resumeData?.projects || []).map(proj => {
    const bullets = (proj.bullets || []).join(' ');
    const allText = `${proj.title} ${proj.description || ''} ${bullets}`.toLowerCase();

    const realWorldProblem = /(?:solved|built|developed|implemented|automated|optimized)/i.test(allText);
    const toolsMentioned = !!proj.techStack?.length || /(?:react|python|java|node|sql|aws|docker)/i.test(allText);
    const measurableResults = /\d+%|\d+x|\$\d+|\d+\s*(?:users|requests)/i.test(allText);
    const businessImpact = /(?:increased|decreased|reduced|improved|saved|generated)/i.test(allText);
    const githubLink = !!proj.githubUrl || /github\.com/i.test(allText);

    let score = 0;
    if (realWorldProblem) score += 2;
    if (toolsMentioned) score += 2;
    if (measurableResults) score += 3;
    if (businessImpact) score += 2;
    if (githubLink) score += 1;

    const sug: string[] = [];
    if (!measurableResults) sug.push('Add quantifiable results');
    if (!toolsMentioned) sug.push('List specific technologies used');

    return {
      title: proj.title,
      score,
      maxScore: 10,
      checks: { realWorldProblem, toolsMentioned, measurableResults, businessImpact, githubLink },
      suggestions: sug,
    };
  });

  const quickWins = buildQuickWins(categories, redFlags);

  const fallbackResumeData: ResumeData = resumeData || {
    name: '',
    phone: '',
    email: '',
    linkedin: '',
    github: '',
    education: [],
    workExperience: [],
    projects: [],
    skills: [],
    certifications: [],
  };

  let overallScore: number;
  try {
    const jdResult = scoreResumeAgainstJD(fallbackResumeData, jobDescription);
    overallScore = jdResult.overallScore;
  } catch {
    overallScore = Math.round(
      categories.reduce((sum, c) => sum + (c.percentage * c.weight / 100), 0)
    );
  }

  const quickWinBoost = quickWins.reduce((sum, w) => sum + w.impact, 0);
  const projectedScore = Math.min(100, Math.round(overallScore + quickWinBoost * 0.5));

  return {
    overallScore,
    userType,
    categories,
    skillBuckets,
    projectScores,
    redFlags,
    quickWins,
    projectedScore,
    matchQuality: getMatchQuality(overallScore),
    shortlistChance: getShortlistChance(overallScore),
    onlinePresence,
  };
}
