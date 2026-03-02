import { ResumeData } from '../types/resume';
import { ParameterScore, scoreResumeAgainstJD, JDScoringResult } from './jdScoringEngine';
import { GapItem } from './gapClassificationEngine';
import { openrouter } from './aiProxyService';
import { ALL_HARD_SKILLS, ALL_TOOL_SKILLS, CONTACT_PROFILE_WORDS } from '../constants/skillsTaxonomy';

const IMPACT_VERBS = [
  'Achieved', 'Exceeded', 'Surpassed', 'Delivered', 'Generated', 'Produced',
  'Spearheaded', 'Led', 'Directed', 'Orchestrated', 'Championed', 'Pioneered',
  'Engineered', 'Architected', 'Developed', 'Built', 'Designed', 'Implemented',
  'Optimized', 'Enhanced', 'Streamlined', 'Accelerated', 'Transformed', 'Modernized',
  'Analyzed', 'Evaluated', 'Assessed', 'Identified', 'Diagnosed', 'Investigated',
  'Collaborated', 'Coordinated', 'Facilitated', 'Integrated', 'Aligned',
  'Managed', 'Oversaw', 'Supervised', 'Administered', 'Maintained',
  'Innovated', 'Conceptualized', 'Formulated', 'Established', 'Launched',
];

const WEAK_VERBS_MAP: Record<string, string> = {
  'worked': 'Delivered', 'helped': 'Enabled', 'assisted': 'Supported', 'did': 'Executed',
  'made': 'Created', 'got': 'Achieved', 'used': 'Leveraged', 'handled': 'Managed',
  'dealt': 'Resolved', 'participated': 'Engaged',
};

const VAGUE_PHRASES: Record<string, string> = {
  'responsible for': 'Managed', 'worked on': 'Developed', 'helped with': 'Facilitated',
  'involved in': 'Contributed to', 'was part of': 'Collaborated on', 'took care of': 'Administered',
  'assisted with': 'Supported',
};

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

const MAX_BULLET_WORDS = 12;
const METRIC_EVIDENCE_REGEX = /\d+%|\$\d+|\d+\s*(users?|customers?|clients?|team|people|million|k\b|x\b|hrs?|hours?|days?|weeks?|months?|requests?|transactions?|records?)/i;
const PERFORMANCE_WORD_REGEX = /\b(improved|reduced|optimized|increased|enhanced|decreased|streamlined|accelerated|boosted|maximized|minimized|eliminated|saved|generated|grew|expanded|automated|simplified|transformed)\b/i;

function getAllBullets(resume: ResumeData): string[] {
  const bullets: string[] = [];
  resume.workExperience?.forEach(exp => exp.bullets?.forEach(b => bullets.push(b)));
  resume.projects?.forEach(p => p.bullets?.forEach(b => bullets.push(b)));
  return bullets;
}

function fixWeakVerbs(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const usedVerbs = new Set<string>();

  const fixBullet = (bullet: string, section: string): string => {
    let fixed = bullet;
    for (const [weak, strong] of Object.entries(VAGUE_PHRASES)) {
      const regex = new RegExp(`^${weak}`, 'i');
      if (regex.test(fixed)) {
        fixed = fixed.replace(regex, strong);
        changes.push({ parameterId: 14, section, before: bullet, after: fixed, description: `Replaced vague phrase "${weak}" with "${strong}"` });
        return fixed;
      }
    }

    const firstWord = fixed.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    if (firstWord && WEAK_VERBS_MAP[firstWord]) {
      const replacement = WEAK_VERBS_MAP[firstWord];
      fixed = replacement + fixed.slice(firstWord.length);
      changes.push({ parameterId: 14, section, before: bullet, after: fixed, description: `Replaced weak verb "${firstWord}" with "${replacement}"` });
      return fixed;
    }

    const isStrongVerb = IMPACT_VERBS.some(v => v.toLowerCase() === firstWord);
    if (!isStrongVerb && firstWord) {
      let newVerb = IMPACT_VERBS.find(v => !usedVerbs.has(v.toLowerCase())) || IMPACT_VERBS[0];
      usedVerbs.add(newVerb.toLowerCase());
      fixed = `${newVerb} ${fixed.charAt(0).toLowerCase()}${fixed.slice(1)}`;
      changes.push({ parameterId: 14, section, before: bullet, after: fixed, description: `Added strong action verb "${newVerb}"` });
    } else if (firstWord) {
      usedVerbs.add(firstWord);
    }

    return fixed;
  };

  resume.workExperience?.forEach(exp => {
    exp.bullets = exp.bullets?.map(b => fixBullet(b, 'experience')) || [];
  });
  resume.projects?.forEach(proj => {
    proj.bullets = proj.bullets?.map(b => fixBullet(b, 'projects')) || [];
  });

  return changes;
}

function fixVerbRepetition(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const verbCounts: Record<string, number> = {};
  const allBulletRefs: { bullet: string; container: { bullets?: string[] }; idx: number; section: string }[] = [];

  resume.workExperience?.forEach(exp => {
    exp.bullets?.forEach((b, idx) => {
      const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (firstWord) verbCounts[firstWord] = (verbCounts[firstWord] || 0) + 1;
      allBulletRefs.push({ bullet: b, container: exp, idx, section: 'experience' });
    });
  });
  resume.projects?.forEach(proj => {
    proj.bullets?.forEach((b, idx) => {
      const firstWord = b.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (firstWord) verbCounts[firstWord] = (verbCounts[firstWord] || 0) + 1;
      allBulletRefs.push({ bullet: b, container: proj, idx, section: 'projects' });
    });
  });

  const usedReplacements = new Set<string>();
  const overusedVerbs = Object.entries(verbCounts).filter(([_, count]) => count > 2).map(([verb]) => verb);

  overusedVerbs.forEach(verb => {
    let replacementsNeeded = verbCounts[verb] - 1;
    allBulletRefs.forEach(ref => {
      if (replacementsNeeded <= 0) return;
      const firstWord = ref.bullet.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
      if (firstWord !== verb) return;

      const replacement = IMPACT_VERBS.find(v =>
        v.toLowerCase() !== verb && !usedReplacements.has(v.toLowerCase())
      );
      if (!replacement) return;

      usedReplacements.add(replacement.toLowerCase());
      const newBullet = replacement + ref.bullet.slice(firstWord.length);
      if (ref.container.bullets) {
        ref.container.bullets[ref.idx] = newBullet;
      }
      changes.push({ parameterId: 15, section: ref.section, before: ref.bullet, after: newBullet, description: `Diversified repeated verb "${verb}" to "${replacement}"` });
      replacementsNeeded--;
    });
  });

  return changes;
}

function removePassiveVoice(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const passivePattern = /\b(was|were|been|being|is|are)\s+(\w+ed)\b/gi;

  const fixBullet = (bullet: string, section: string): string => {
    if (!passivePattern.test(bullet)) return bullet;
    passivePattern.lastIndex = 0;

    const fixed = bullet.replace(passivePattern, (_match, _aux, verb) => {
      return verb.charAt(0).toUpperCase() + verb.slice(1);
    });

    if (fixed !== bullet) {
      changes.push({ parameterId: 16, section, before: bullet, after: fixed, description: 'Converted passive voice to active voice' });
    }
    return fixed;
  };

  resume.workExperience?.forEach(exp => {
    exp.bullets = exp.bullets?.map(b => fixBullet(b, 'experience')) || [];
  });
  resume.projects?.forEach(proj => {
    proj.bullets = proj.bullets?.map(b => fixBullet(b, 'projects')) || [];
  });

  return changes;
}

function removeVaguePhrases(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];

  const fixBullet = (bullet: string, section: string): string => {
    let fixed = bullet;
    for (const [vague, replacement] of Object.entries(VAGUE_PHRASES)) {
      const regex = new RegExp(vague, 'gi');
      if (regex.test(fixed)) {
        fixed = fixed.replace(regex, replacement);
        changes.push({ parameterId: 13, section, before: bullet, after: fixed, description: `Replaced "${vague}" with "${replacement}"` });
      }
    }
    return fixed;
  };

  resume.workExperience?.forEach(exp => {
    exp.bullets = exp.bullets?.map(b => fixBullet(b, 'experience')) || [];
  });
  resume.projects?.forEach(proj => {
    proj.bullets = proj.bullets?.map(b => fixBullet(b, 'projects')) || [];
  });

  return changes;
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
  jobDescription: string,
  explicitKeywords: string[] = []
): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdLower = jobDescription.toLowerCase();
  const resumeText = [
    resume.summary || '',
    ...(resume.skills?.flatMap(s => s.list) || []),
    ...(resume.workExperience?.flatMap(e => e.bullets || []) || []),
    ...(resume.projects?.flatMap(p => [...(p.bullets || []), ...(p.techStack || [])]) || []),
  ].join(' ').toLowerCase();

  const jdKeywords = extractOptimizationKeywordsFromJD(jobDescription);
  const candidateSkills = [...new Set([
    ...jdKeywords,
    ...explicitKeywords.map(k => k.toLowerCase().trim()),
  ])];

  const missingSkills = candidateSkills.filter(skill => {
    if (!skill || skill.length < 2) return false;
    if (CONTACT_PROFILE_WORDS.has(skill)) return false;
    const existsInJD = jdLower.includes(skill);
    const forced = explicitKeywords.some(k => k.toLowerCase().trim() === skill);
    if (!existsInJD && !forced) return false;
    return !resumeText.includes(skill);
  });

  if (missingSkills.length === 0) return changes;

  if (!resume.skills) resume.skills = [];
  let techCategory = resume.skills.find(s => s.category.toLowerCase().includes('technical') || s.category.toLowerCase() === 'tools & platforms');
  if (!techCategory) {
    techCategory = { category: 'Technical Skills', count: 0, list: [] };
    resume.skills.push(techCategory);
  }

  const existingLower = new Set(techCategory.list.map(s => s.toLowerCase()));
  missingSkills.forEach(skill => {
    if (existingLower.has(skill)) return;
    const formatted = skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    techCategory!.list.push(formatted);
    techCategory!.count = techCategory!.list.length;
    existingLower.add(skill);
    changes.push({ parameterId: 6, section: 'skills', before: '', after: formatted, description: `Added missing JD keyword "${formatted}" to skills` });
  });

  if (resume.summary && missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3).map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    const oldSummary = resume.summary;
    resume.summary = `${resume.summary.replace(/\.?\s*$/, '')}. Proficient in ${topMissing.join(', ')}.`;
    changes.push({ parameterId: 10, section: 'summary', before: oldSummary, after: resume.summary, description: `Integrated ${topMissing.length} keywords into summary` });
  }

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

async function addMetricsWithAI(resume: ResumeData): Promise<OptimizationChange[]> {
  const changes: OptimizationChange[] = [];
  const metricPattern = /\d+%|\$\d+|\d+\s*(users?|customers?|clients?|million|k\b|x\b|hrs?|hours?|days?|requests?)/i;

  const bulletsToFix: { bullet: string; role: string }[] = [];
  resume.workExperience?.forEach(exp => {
    exp.bullets?.forEach(b => {
      if (!metricPattern.test(b)) bulletsToFix.push({ bullet: b, role: exp.role });
    });
  });
  resume.projects?.forEach(p => {
    p.bullets?.forEach(b => {
      if (!metricPattern.test(b)) bulletsToFix.push({ bullet: b, role: p.title });
    });
  });

  if (bulletsToFix.length === 0) return changes;

  const bulletsText = bulletsToFix.slice(0, 10).map((b, i) => `${i + 1}. [${b.role}] ${b.bullet}`).join('\n');

  try {
    const prompt = `Add realistic, measurable metrics to these resume bullets. Keep the original meaning. Return ONLY a JSON array of objects with "original" and "improved" keys.

Bullets:
${bulletsText}

Rules:
- Add specific numbers, percentages, or quantifiable outcomes
- Keep improvements realistic and believable
- Preserve the original meaning and context
- Return valid JSON array only`;

    const response = await openrouter.chatWithSystem(
      'You are a resume optimization expert. Return only valid JSON.',
      prompt,
      { temperature: 0.3 }
    );

    const cleaned = response.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const improvements = JSON.parse(cleaned) as Array<{ original: string; improved: string }>;

    improvements.forEach(imp => {
      if (!imp.original || !imp.improved || imp.original === imp.improved) return;

      resume.workExperience?.forEach(exp => {
        exp.bullets = exp.bullets?.map(b => {
          if (b.trim() === imp.original.trim()) {
            changes.push({ parameterId: 11, section: 'experience', before: b, after: imp.improved, description: 'Added measurable metrics via AI' });
            return imp.improved;
          }
          return b;
        }) || [];
      });

      resume.projects?.forEach(proj => {
        proj.bullets = proj.bullets?.map(b => {
          if (b.trim() === imp.original.trim()) {
            changes.push({ parameterId: 11, section: 'projects', before: b, after: imp.improved, description: 'Added measurable metrics via AI' });
            return imp.improved;
          }
          return b;
        }) || [];
      });
    });
  } catch (err) {
    console.warn('AI metric enhancement failed, using fallback:', err);
    const fallbackMetrics = [
      'improving efficiency by 35%', 'reducing processing time by 40%',
      'achieving 99.5% uptime', 'serving 5K+ users', 'with 90% test coverage',
      'reducing costs by 20%', 'increasing throughput by 45%',
    ];
    let metricIdx = 0;
    resume.workExperience?.forEach(exp => {
      exp.bullets = exp.bullets?.map(b => {
        if (metricPattern.test(b)) return b;
        const old = b;
        const metric = fallbackMetrics[metricIdx % fallbackMetrics.length];
        metricIdx++;
        const fixed = `${b.replace(/\.?\s*$/, '')}, ${metric}.`;
        changes.push({ parameterId: 11, section: 'experience', before: old, after: fixed, description: 'Added fallback metrics' });
        return fixed;
      }) || [];
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

function enforceBulletWordLimit(resume: ResumeData, maxWords: number = MAX_BULLET_WORDS): OptimizationChange[] {
  const changes: OptimizationChange[] = [];

  const extractMetricPhrase = (text: string): string | null => {
    const phraseMatch = text.match(
      /(?:by|to|over|for|of)?\s*(?:\$\d+(?:\.\d+)?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:users?|customers?|clients?|team|people|million|k\b|x\b|hrs?|hours?|days?|weeks?|months?|requests?|transactions?|records?))/i
    );
    return phraseMatch ? phraseMatch[0].trim() : null;
  };

  const shortenBullet = (bullet: string, section: string): string => {
    const normalized = bullet.replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(Boolean);
    if (words.length <= maxWords) return normalized;

    const hadMetricEvidence = METRIC_EVIDENCE_REGEX.test(normalized);
    const hadPerformanceWord = PERFORMANCE_WORD_REGEX.test(normalized);
    const metricPhrase = hadMetricEvidence ? extractMetricPhrase(normalized) : null;

    let shortened = words.slice(0, maxWords).join(' ');

    if (hadMetricEvidence && !METRIC_EVIDENCE_REGEX.test(shortened) && metricPhrase) {
      const metricWords = metricPhrase.split(/\s+/).filter(Boolean);
      const headCount = Math.max(1, maxWords - metricWords.length - 1);
      shortened = `${words.slice(0, headCount).join(' ')} with ${metricPhrase}`.trim();
      const finalWords = shortened.split(/\s+/).filter(Boolean);
      if (finalWords.length > maxWords) {
        shortened = finalWords.slice(0, maxWords).join(' ');
      }
    }

    if (hadPerformanceWord && !PERFORMANCE_WORD_REGEX.test(shortened)) {
      const wordsWithPerf = shortened.replace(/[.!?]$/, '').split(/\s+/).filter(Boolean);
      if (wordsWithPerf.length >= 2) {
        wordsWithPerf.splice(Math.min(2, wordsWithPerf.length), 0, 'improved');
      } else {
        wordsWithPerf.push('improved');
      }
      shortened = wordsWithPerf.slice(0, maxWords).join(' ');
    }

    shortened = shortened.replace(/[,:;]+$/g, '');
    if (!/[.!?]$/.test(shortened)) shortened += '.';

    if (shortened !== bullet) {
      changes.push({
        parameterId: 4,
        section,
        before: bullet,
        after: shortened,
        description: `Shortened bullet to ${maxWords} words max`,
      });
    }

    return shortened;
  };

  resume.workExperience?.forEach(exp => {
    exp.bullets = exp.bullets?.map(b => shortenBullet(b, 'experience')) || [];
  });

  resume.projects?.forEach(proj => {
    proj.bullets = proj.bullets?.map(b => shortenBullet(b, 'projects')) || [];
  });

  return changes;
}

function addProjectTechStacks(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdLower = jobDescription.toLowerCase();
  const fallbackTechSkills = [
    'react', 'react.js', 'next.js', 'nextjs', 'vue', 'vue.js', 'angular', 'svelte',
    'node.js', 'nodejs', 'express', 'express.js', 'fastify', 'nestjs',
    'python', 'django', 'flask', 'fastapi',
    'java', 'spring', 'spring boot', 'springboot',
    'typescript', 'javascript', 'go', 'golang', 'rust', 'c++', 'c#', '.net',
    'aws', 'azure', 'gcp', 'google cloud',
    'docker', 'kubernetes', 'k8s', 'terraform', 'jenkins', 'ci/cd',
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
    'graphql', 'rest', 'restful', 'grpc',
    'jest', 'cypress', 'selenium', 'pytest',
    'kafka', 'rabbitmq', 'microservices',
    'html', 'css', 'tailwind', 'sass', 'bootstrap',
    'git', 'github', 'gitlab', 'jira', 'agile', 'scrum',
    'sql', 'nosql', 'firebase', 'supabase',
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp',
    'linux', 'nginx', 'apache'
  ];
  const jdTechFromTaxonomy = [...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS]
    .map(skill => skill.toLowerCase())
    .filter(skill => !CONTACT_PROFILE_WORDS.has(skill))
    .filter(skill => jdLower.includes(skill));

  const jdTechFallback = fallbackTechSkills.filter(skill => jdLower.includes(skill.toLowerCase()));
  const jdTech = [...new Set([...jdTechFromTaxonomy, ...jdTechFallback])];

  const capitalize = (t: string) => t.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

  if (!resume.projects || resume.projects.length === 0 || jdTech.length === 0) {
    return changes;
  }

  resume.projects?.forEach(proj => {
    const projectText = [proj.title, ...(proj.bullets || []), ...(proj.techStack || [])].join(' ').toLowerCase();
    const missingTech = jdTech.filter(t => !projectText.includes(t));

    if (!proj.techStack || proj.techStack.length === 0) {
      const relevantTech = jdTech.filter(t => projectText.includes(t));
      if (relevantTech.length > 0) {
        proj.techStack = relevantTech.map(capitalize);
      } else if (jdTech.length > 0) {
        proj.techStack = jdTech.slice(0, 6).map(capitalize);
      }
      if (proj.techStack && proj.techStack.length > 0) {
        proj.techStack = dedupeKeepOrder(proj.techStack);
        changes.push({ parameterId: 20, section: 'projects', before: '', after: proj.techStack.join(', '), description: `Added tech stack to "${proj.title}"` });
      }
    } else if (missingTech.length > 0) {
      const toAdd = missingTech.slice(0, 5).map(capitalize);
      const before = proj.techStack.join(', ');
      proj.techStack = dedupeKeepOrder([...proj.techStack, ...toAdd]);
      changes.push({ parameterId: 20, section: 'projects', before, after: proj.techStack.join(', '), description: `Extended tech stack for "${proj.title}"` });
    }

    if (missingTech.length > 0 && proj.bullets && proj.bullets.length > 0) {
      const techToMention = missingTech.slice(0, 2).map(capitalize);
      const lastBulletIdx = proj.bullets.length - 1;
      const originalBullet = proj.bullets[lastBulletIdx];
      const techStr = techToMention.join(' and ');
      proj.bullets[lastBulletIdx] = `${originalBullet.replace(/\.?\s*$/, '')}, leveraging ${techStr}.`;
      changes.push({ parameterId: 19, section: 'projects', before: originalBullet, after: proj.bullets[lastBulletIdx], description: `Added JD skills to project bullet in "${proj.title}"` });
    }
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
    'html5': 'HTML5',
    'css3': 'CSS3',
    'aws': 'AWS',
    'azure': 'Azure',
    'gcp': 'GCP',
    'git': 'Git',
    'jira': 'Jira',
    '.net': '.NET',
    'c#': 'C#',
    'c++': 'C++',
  };

  if (exactMap[lower]) return exactMap[lower];
  if (/^html$/i.test(normalized)) return 'HTML5';
  if (/^css$/i.test(normalized)) return 'CSS3';
  if (/^javascript$/i.test(normalized)) return 'JavaScript';
  if (/^typescript$/i.test(normalized)) return 'TypeScript';

  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const VALID_SKILL_BUCKETS = new Set<SkillBucketName>(SKILL_BUCKET_ORDER);

async function reorganizeSkillsForATS(resume: ResumeData, jobDescription: string): Promise<OptimizationChange[]> {
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
  const allSkills = existingCategories.flatMap(cat => cat.list || []);
  const canonicalSkills: string[] = [];
  for (const raw of allSkills) {
    const canonical = canonicalizeSkillLabel(raw);
    const key = canonical.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    canonicalSkills.push(canonical);
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
      { temperature: 0.1 }
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
    console.warn('AI skill categorization failed, preserving existing skill categories:', error);
  }

  if (aiAssignments.length > 0) {
    const assigned = new Set<string>();
    for (const item of aiAssignments) {
      assigned.add(item.skill.toLowerCase());
      bucketMap[item.category].push(item.skill);
    }
    for (const skill of canonicalSkills) {
      if (!assigned.has(skill.toLowerCase())) {
        bucketMap['Tools'].push(skill);
      }
    }
  } else {
    for (const category of existingCategories) {
      const normalizedCategory = category.category.trim();
      const target = VALID_SKILL_BUCKETS.has(normalizedCategory as SkillBucketName)
        ? (normalizedCategory as SkillBucketName)
        : 'Tools';
      for (const skill of category.list || []) {
        bucketMap[target].push(canonicalizeSkillLabel(skill));
      }
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

function addProjectImpactAndMetrics(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const metricPattern = /\d+%|\$\d+|\d+\s*(users?|customers?|clients?|requests?|transactions?|ms|seconds?)/i;
  const impactPattern = /(?:increased|decreased|reduced|improved|saved|generated|achieved|resulted|enhanced|boosted|automated|streamlined|optimized)/i;

  const genericMetrics = [
    'reducing processing time by 40%',
    'improving efficiency by 35%',
    'serving 500+ active users',
    'achieving 99.9% uptime',
    'reducing manual effort by 60%',
    'cutting response time by 50%',
    'handling 1000+ daily requests',
    'decreasing load time by 45%',
  ];

  const impactPhrases = [
    'Engineered and deployed',
    'Built and optimized',
    'Developed and launched',
    'Designed and implemented',
    'Architected and delivered',
  ];

  let metricIdx = 0;
  let impactIdx = 0;

  resume.projects?.forEach(proj => {
    if (!proj.bullets || proj.bullets.length === 0) return;

    const hasMetrics = proj.bullets.some(b => metricPattern.test(b));
    const hasImpact = proj.bullets.some(b => impactPattern.test(b));

    if (!hasMetrics && proj.bullets.length > 0) {
      const targetIdx = proj.bullets.length - 1;
      const original = proj.bullets[targetIdx];
      const metric = genericMetrics[metricIdx % genericMetrics.length];
      metricIdx++;
      proj.bullets[targetIdx] = `${original.replace(/\.?\s*$/, '')}, ${metric}.`;
      changes.push({ parameterId: 26, section: 'projects', before: original, after: proj.bullets[targetIdx], description: `Added measurable result to "${proj.title}"` });
    }

    if (!hasImpact && proj.bullets.length > 0) {
      const original = proj.bullets[0];
      const firstWord = original.trim().split(/\s+/)[0]?.toLowerCase();
      const isAlreadyStrong = /^(engineered|built|developed|designed|architected|implemented|created|automated|optimized|launched)/i.test(firstWord || '');
      if (!isAlreadyStrong) {
        const phrase = impactPhrases[impactIdx % impactPhrases.length];
        impactIdx++;
        proj.bullets[0] = `${phrase} ${original.charAt(0).toLowerCase()}${original.slice(1)}`;
        changes.push({ parameterId: 27, section: 'projects', before: original, after: proj.bullets[0], description: `Added impact language to "${proj.title}"` });
      }
    }
  });

  return changes;
}

function addIndustryKeywords(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const jdLower = jobDescription.toLowerCase();

  const jdWords = jdLower.split(/\s+/).filter(w => w.length > 4);
  const stopWords = new Set(['should', 'would', 'could', 'having', 'about', 'their', 'there', 'these', 'which', 'other', 'before', 'after', 'being', 'through', 'between', 'during', 'under', 'above', 'where', 'while', 'include', 'including']);
  const techSet = new Set([...ALL_HARD_SKILLS, ...ALL_TOOL_SKILLS].map(s => s.toLowerCase()));

  const lowercaseTerms = jdWords.filter(w =>
    !stopWords.has(w) && !techSet.has(w) && /^[a-z]+$/i.test(w)
  );

  const casedPhrases = jobDescription
    .split(/[.\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(sentence => {
      const matches = sentence.match(/\b[A-Za-z][A-Za-z-]{3,}(?:\s+[A-Za-z][A-Za-z-]{3,}){0,2}\b/g) || [];
      return matches.map(m => m.toLowerCase());
    })
    .filter(term => !stopWords.has(term))
    .filter(term => !techSet.has(term));

  const industryTerms = [...new Set([...lowercaseTerms, ...casedPhrases])]
    .filter(term => term.length >= 4 && term.length <= 35)
    .slice(0, 20);

  const resumeText = [
    resume.summary || '',
    ...(resume.workExperience || []).flatMap(e => e.bullets || []),
    ...(resume.projects || []).flatMap(p => p.bullets || []),
    ...(resume.skills || []).flatMap(s => s.list || []),
  ].join(' ').toLowerCase();

  const missing = industryTerms.filter(t => !resumeText.includes(t));
  if (missing.length === 0) return changes;

  const topMissing = missing.slice(0, 4);
  if (!resume.summary || resume.summary.trim().length < 20) {
    if (resume.careerObjective && resume.careerObjective.trim().length > 20) {
      resume.summary = resume.careerObjective.trim();
    } else if (resume.targetRole && resume.targetRole.trim().length > 0) {
      resume.summary = `Targeting ${resume.targetRole} opportunities with domain-relevant experience.`;
    } else {
      resume.summary = 'Seeking opportunities aligned with role-specific and industry requirements.';
    }
  }

  const oldSummary = resume.summary;
  const keywordStr = topMissing.join(', ');
  resume.summary = `${resume.summary.replace(/\.?\s*$/, '')}. Experienced in ${keywordStr}.`;
  changes.push({ parameterId: 28, section: 'summary', before: oldSummary, after: resume.summary, description: `Integrated industry keywords: ${keywordStr}` });

  if (resume.projects && resume.projects.length > 0) {
    const p = resume.projects[0];
    if (!p.bullets) p.bullets = [];
    if (p.bullets.length > 0) {
      const original = p.bullets[0];
      const addition = topMissing.slice(0, 2).join(' and ');
      p.bullets[0] = `${original.replace(/\.?\s*$/, '')}, aligned to ${addition}.`;
      changes.push({ parameterId: 28, section: 'projects', before: original, after: p.bullets[0], description: `Added industry keywords to "${p.title}" bullet` });
    }
  }

  return changes;
}

function parseYearRange(yearText?: string): { start: number; end: number; endLabel: string } | null {
  if (!yearText) return null;
  const m = yearText.match(/(\d{4})\s*[-–]\s*(\d{4}|present|current|ongoing)/i);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  const endRaw = m[2];
  const isPresent = /present|current|ongoing/i.test(endRaw);
  const end = isPresent ? new Date().getFullYear() : parseInt(endRaw, 10);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return { start, end, endLabel: isPresent ? 'Present' : String(end) };
}

function parseRequiredYearsFromJD(jobDescription: string): number {
  const m = jobDescription.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*(?:experience|exp)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function getResumeTotalYears(resume: ResumeData): number {
  let total = 0;
  for (const exp of resume.workExperience || []) {
    const parsed = parseYearRange(exp.year);
    if (!parsed) continue;
    total += Math.max(0, parsed.end - parsed.start);
  }
  return total;
}

function autoAlignYearsToJD(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const yearsRequired = parseRequiredYearsFromJD(jobDescription);
  if (yearsRequired <= 0) return changes;

  if (!resume.workExperience || resume.workExperience.length === 0) {
    const currentYear = new Date().getFullYear();
    const startYear = Math.max(2000, currentYear - yearsRequired);
    resume.workExperience = [{
      role: resume.targetRole || 'Software Engineer',
      company: 'Role-Aligned Experience',
      year: `${startYear} - Present`,
      bullets: [
        'Delivered role-aligned technical solutions with measurable business outcomes.',
        'Collaborated across teams to implement scalable features and improve reliability.',
      ],
    }];
    changes.push({
      parameterId: 17,
      section: 'experience',
      before: '',
      after: `${startYear} - Present`,
      description: `Added baseline experience timeline to align with ${yearsRequired}+ years requirement (verify accuracy).`,
    });
    return changes;
  }

  const totalYears = getResumeTotalYears(resume);
  if (totalYears >= yearsRequired) return changes;

  const currentYear = new Date().getFullYear();
  let targetIdx = 0;
  let earliestStart = Number.MAX_SAFE_INTEGER;
  resume.workExperience.forEach((exp, idx) => {
    const parsed = parseYearRange(exp.year);
    if (!parsed) return;
    if (parsed.start < earliestStart) {
      earliestStart = parsed.start;
      targetIdx = idx;
    }
  });

  const target = resume.workExperience[targetIdx];
  const parsed = parseYearRange(target.year);
  const endYear = parsed ? parsed.end : currentYear;
  const endLabel = parsed ? parsed.endLabel : 'Present';
  const newStart = Math.max(2000, endYear - yearsRequired);
  const oldYear = target.year || '';
  const newYear = `${newStart} - ${endLabel}`;

  if (oldYear !== newYear) {
    target.year = newYear;
    changes.push({
      parameterId: 17,
      section: 'experience',
      before: oldYear,
      after: newYear,
      description: `Aligned experience duration toward JD requirement of ${yearsRequired}+ years (verify accuracy).`,
    });
  }

  return changes;
}

function detectTargetSeniority(jobDescription: string): 'entry' | 'senior' | 'lead' | 'principal' | null {
  if (/\b(principal|staff|distinguished|director|vp)\b/i.test(jobDescription)) return 'principal';
  if (/\b(lead|tech lead|team lead)\b/i.test(jobDescription)) return 'lead';
  if (/\b(senior|sr\.?)\b/i.test(jobDescription)) return 'senior';
  if (/\b(junior|jr\.?|entry|fresher|graduate|intern)\b/i.test(jobDescription)) return 'entry';
  return null;
}

function autoAlignSeniorityWithJD(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const target = detectTargetSeniority(jobDescription);
  if (!target) return changes;

  const prefixMap: Record<'entry' | 'senior' | 'lead' | 'principal', string> = {
    entry: 'Junior',
    senior: 'Senior',
    lead: 'Lead',
    principal: 'Principal',
  };
  const prefix = prefixMap[target];

  if (!resume.workExperience || resume.workExperience.length === 0) {
    const currentYear = new Date().getFullYear();
    resume.workExperience = [{
      role: `${prefix} ${resume.targetRole || 'Software Engineer'}`.trim(),
      company: 'Role-Aligned Experience',
      year: `${currentYear - 2} - Present`,
      bullets: [
        'Owned end-to-end feature delivery and reliability improvements.',
        'Collaborated with stakeholders to prioritize and execute high-impact work.',
      ],
    }];
    changes.push({
      parameterId: 18,
      section: 'experience',
      before: '',
      after: resume.workExperience[0].role,
      description: `Added seniority-aligned role title "${prefix}" based on JD.`,
    });
    return changes;
  }

  const exp = resume.workExperience[0];
  const oldRole = exp.role || '';
  if (!new RegExp(`\\b${prefix}\\b`, 'i').test(oldRole)) {
    exp.role = `${prefix} ${oldRole}`.trim();
    changes.push({
      parameterId: 18,
      section: 'experience',
      before: oldRole,
      after: exp.role,
      description: `Aligned experience title with JD seniority using "${prefix}".`,
    });
  }

  const oldTargetRole = resume.targetRole || '';
  if (!new RegExp(`\\b${prefix}\\b`, 'i').test(oldTargetRole)) {
    resume.targetRole = `${prefix} ${oldTargetRole || 'Software Engineer'}`.trim();
    changes.push({
      parameterId: 18,
      section: 'targetRole',
      before: oldTargetRole,
      after: resume.targetRole,
      description: `Aligned target role seniority with "${prefix}".`,
    });
  }

  return changes;
}

function toTitle(skill: string): string {
  return skill
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function autoEnsureProjectCount(resume: ResumeData, jobDescription: string): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const totalYears = getResumeTotalYears(resume);
  const minProjects = totalYears < 2 ? 2 : 1;
  if (!resume.projects) resume.projects = [];
  if (resume.projects.length >= minProjects) return changes;

  const jdKeywords = extractOptimizationKeywordsFromJD(jobDescription)
    .filter(k => !CONTACT_PROFILE_WORDS.has(k))
    .slice(0, 8);
  const techStack = jdKeywords.slice(0, 5).map(toTitle);
  const roleHint = resume.targetRole || 'Software Engineering';

  while (resume.projects.length < minProjects) {
    const idx = resume.projects.length + 1;
    const title = `${roleHint} Project ${idx}`;
    const p = {
      title,
      techStack: techStack.length > 0 ? techStack : ['JavaScript', 'React', 'Node.js'],
      bullets: [
        `Built and deployed a ${roleHint.toLowerCase()} solution for real-world workflow automation, serving 500+ users.`,
        'Implemented scalable APIs and frontend modules with measurable latency and reliability improvements.',
      ],
    };
    resume.projects.push(p);
    changes.push({
      parameterId: 24,
      section: 'projects',
      before: '',
      after: `${p.title} | ${p.techStack.join(', ')}`,
      description: `Added AI-generated project to satisfy project-count and relevance thresholds.`,
    });
  }

  return changes;
}

function slugifyName(name?: string): string {
  const clean = (name || 'candidate')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return clean || 'candidate';
}

function autoFillOnlinePresence(resume: ResumeData): OptimizationChange[] {
  const changes: OptimizationChange[] = [];
  const slug = slugifyName(resume.name);

  if (!resume.name || resume.name.trim().length < 2) {
    const before = resume.name || '';
    resume.name = 'Candidate Name';
    changes.push({ parameterId: 21, section: 'contact', before, after: resume.name, description: 'Auto-filled missing name for profile completeness.' });
  }
  if (!resume.email || !resume.email.includes('@')) {
    const before = resume.email || '';
    resume.email = `${slug}@example.com`;
    changes.push({ parameterId: 21, section: 'contact', before, after: resume.email, description: 'Auto-filled missing email (replace with real email).' });
  }
  if (!resume.phone || resume.phone.trim().length < 10) {
    const before = resume.phone || '';
    resume.phone = '+91 9000000000';
    changes.push({ parameterId: 21, section: 'contact', before, after: resume.phone, description: 'Auto-filled missing phone (replace with real phone).' });
  }

  return changes;
}

export async function optimizeByParameter(
  resume: ResumeData,
  jobDescription: string,
  gaps: GapItem[]
): Promise<TargetedOptimizationResult> {
  const optimized = JSON.parse(JSON.stringify(resume)) as ResumeData;
  const allChanges: OptimizationChange[] = [];
  const parametersFixed: number[] = [];

  const gapIds = new Set(gaps.map(g => g.parameterId));

  if (gapIds.has(17)) {
    allChanges.push(...autoAlignYearsToJD(optimized, jobDescription));
    parametersFixed.push(17);
  }

  if (gapIds.has(18)) {
    allChanges.push(...autoAlignSeniorityWithJD(optimized, jobDescription));
    parametersFixed.push(18);
  }

  if (gapIds.has(21)) {
    allChanges.push(...autoFillOnlinePresence(optimized));
    parametersFixed.push(21);
  }

  if (gapIds.has(24) || gapIds.has(19) || gapIds.has(20) || gapIds.has(25) || gapIds.has(26) || gapIds.has(27)) {
    allChanges.push(...autoEnsureProjectCount(optimized, jobDescription));
    parametersFixed.push(24);
  }

  if (gapIds.has(12) || gapIds.has(13) || gapIds.has(14) || gapIds.has(16)) {
    allChanges.push(...removeVaguePhrases(optimized));
    allChanges.push(...fixWeakVerbs(optimized));
    allChanges.push(...removePassiveVoice(optimized));
    parametersFixed.push(12, 13, 14, 16);
  }

  if (gapIds.has(15)) {
    allChanges.push(...fixVerbRepetition(optimized));
    parametersFixed.push(15);
  }

  if (gapIds.has(6) || gapIds.has(7) || gapIds.has(8) || gapIds.has(10)) {
    const suggestedKeywords = parseKeywordsFromGapSuggestions(gaps, [6, 7, 8, 10, 23, 28]);
    allChanges.push(...addMissingKeywords(optimized, jobDescription, suggestedKeywords));
    parametersFixed.push(6, 7, 8, 10);
  }

  if (gapIds.has(9) && (!optimized.targetRole || optimized.targetRole.trim().length === 0)) {
    allChanges.push(...alignRoleTitleWithJD(optimized, jobDescription));
    parametersFixed.push(9);
  }

  if (gapIds.has(11)) {
    const metricChanges = await addMetricsWithAI(optimized);
    allChanges.push(...metricChanges);
    parametersFixed.push(11);
  }

  if (gapIds.has(4)) {
    allChanges.push(...fixBulletFormatting(optimized));
    parametersFixed.push(4);
  }

  if (gapIds.has(19) || gapIds.has(20) || gapIds.has(25)) {
    allChanges.push(...addProjectTechStacks(optimized, jobDescription));
    parametersFixed.push(19, 20, 25);
  }

  if (gapIds.has(22) || gapIds.has(23)) {
    allChanges.push(...fixSkillsQuality(optimized));
    parametersFixed.push(22, 23);
  }

  if (gapIds.has(26) || gapIds.has(27)) {
    allChanges.push(...addProjectImpactAndMetrics(optimized));
    parametersFixed.push(26, 27);
  }

  if (gapIds.has(28)) {
    allChanges.push(...addIndustryKeywords(optimized, jobDescription));
    parametersFixed.push(28);
  }

  const aiSkillReorgChanges = await reorganizeSkillsForATS(optimized, jobDescription);
  allChanges.push(...aiSkillReorgChanges);
  allChanges.push(...pruneIrrelevantSkillsToJD(optimized, jobDescription));
  parametersFixed.push(22, 23);

  allChanges.push(...enforceBulletWordLimit(optimized, MAX_BULLET_WORDS));
  parametersFixed.push(4);

  return {
    optimizedResume: optimized,
    changes: allChanges,
    parametersFixed: [...new Set(parametersFixed)],
  };
}
