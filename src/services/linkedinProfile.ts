// LinkedIn Profile Optimizer: read a LinkedIn "Save to PDF" export (or the
// user's PrimoBoost profile), score it 0-100 with fixed rules, and ask the AI
// for a rewrite that only uses facts already in the profile.
import { RESUME_ROLES } from '../data/seo/roles';
import { getJdOptimizationTier } from '../config/jdOptimizationTiers';

export type ExperienceLevel = 'student' | 'fresher' | 'experienced';

export interface LinkedInEntry {
  title: string;
  org: string;
  dates: string;
  description: string;
}

export interface LinkedInProfile {
  name: string;
  headline: string;
  location: string;
  about: string;
  experience: LinkedInEntry[];
  education: string[];
  skills: string[];
  certifications: string[];
  languages: string[];
  profileUrl: string;
}

export const emptyProfile = (): LinkedInProfile => ({
  name: '', headline: '', location: '', about: '', experience: [], education: [],
  skills: [], certifications: [], languages: [], profileUrl: '',
});

// ---------------------------------------------------------------- parsing

const HEADINGS: Record<string, string> = {
  contact: 'contact',
  'top skills': 'skills',
  skills: 'skills',
  languages: 'languages',
  certifications: 'certifications',
  'honors-awards': 'honors',
  publications: 'publications',
  patents: 'patents',
  summary: 'summary',
  about: 'summary',
  experience: 'experience',
  education: 'education',
  projects: 'projects',
};
const MAIN_SECTIONS = new Set(['summary', 'experience', 'education', 'projects']);

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
const DATE_RANGE = new RegExp(`^(?:${MONTH}\\s+)?\\d{4}\\s*[-–]\\s*(?:present|(?:${MONTH}\\s+)?\\d{4})`, 'i');
const DURATION = /^(?:\d+\s+years?)?\s*(?:\d+\s+months?)?$|^less than a year$/i;

const isLocation = (line: string) =>
  line.length <= 80 && !line.includes('|') && (/,/.test(line) || /\b(india|area|remote)\b/i.test(line)) && !DATE_RANGE.test(line);
const isNameLike = (line: string) =>
  /^[A-Za-z][A-Za-z.'-]*(\s+[A-Za-z][A-Za-z.'-]*){0,3}$/.test(line) && line.length <= 40;
const isHeader = (line: string) =>
  line.length <= 80 && !/[.!?:;]$/.test(line) && !isLocation(line) && !DATE_RANGE.test(line);

/** The vanity part of linkedin.com/in/<slug>, or ''. LinkedIn wraps long URLs after a hyphen. */
const findProfileUrl = (lines: string[]) => {
  const match = lines.join('\n').replace(/-\n/g, '-').match(/linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/i);
  return match ? `linkedin.com/in/${match[1]}` : '';
};

/** A custom URL is the default slug without LinkedIn's random suffix (e.g. -4b2a1c9 or -123456). */
export const hasCustomUrl = (profileUrl: string) => {
  const slug = profileUrl.split('/in/')[1] || '';
  return !!slug && !/-[0-9a-f]{6,}$/i.test(slug) && !/\d{4,}$/.test(slug);
};

const parseExperience = (lines: string[]): LinkedInEntry[] => {
  const dateIdx = lines.map((l, i) => (DATE_RANGE.test(l) ? i : -1)).filter((i) => i > 0);
  type Head = { start: number; title: string; org: string; dates: string; d: number };
  const heads: Head[] = [];
  let lastOrg = '';
  dateIdx.forEach((d, k) => {
    const floor = k === 0 ? 0 : dateIdx[k - 1] + 1;
    let start = d - 1;
    let org = lastOrg;
    if (d - 2 >= floor && DURATION.test(lines[d - 2]) && lines[d - 2] && d - 3 >= floor) {
      org = lines[d - 3]; start = d - 3; // company with several roles: Company / total time / Role / dates
    } else if (d - 2 >= floor && isHeader(lines[d - 2])) {
      org = lines[d - 2]; start = d - 2;
    }
    // ponytail: a short description line with no full stop just above a second
    // role at the same company reads as a company name; fine for most profiles.
    lastOrg = org;
    heads.push({ start, title: lines[d - 1], org, dates: lines[d], d });
  });
  return heads.map((h, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].start : lines.length;
    const body = lines.slice(h.d + 1, end);
    if (body.length && isLocation(body[0])) body.shift();
    return { title: h.title, org: h.org, dates: h.dates, description: body.join(' ').trim() };
  });
};

/**
 * LinkedIn's PDF has fixed headings. The sidebar (Contact, Top Skills,
 * Languages, Certifications) usually comes first in the text, then name,
 * headline and location, then Summary, Experience and Education.
 * Needs the text with its line breaks (parseFile(file, { keepLines: true })).
 */
export function parseLinkedInPdfText(text: string): LinkedInProfile {
  const profile = emptyProfile();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^page \d+ of \d+$/i.test(l));

  const heads: { i: number; key: string }[] = [];
  const seen = new Set<string>();
  lines.forEach((l, i) => {
    const key = HEADINGS[l.toLowerCase()];
    if (key && !seen.has(key)) { seen.add(key); heads.push({ i, key }); }
  });
  const body = (k: number) => lines.slice(heads[k].i + 1, k + 1 < heads.length ? heads[k + 1].i : lines.length);
  const sections: Record<string, string[]> = {};
  heads.forEach((h, k) => { sections[h.key] = body(k); });

  profile.profileUrl = findProfileUrl(sections.contact || []);

  // Name, headline and location sit just above the first main heading.
  const m = heads.findIndex((h) => MAIN_SECTIONS.has(h.key));
  if (m >= 0) {
    const blockStart = m > 0 ? heads[m - 1].i + 1 : 0;
    const block = lines.slice(blockStart, heads[m].i);
    let end = block.length;
    if (end > 1 && isLocation(block[end - 1])) profile.location = block[--end];

    const slugWords = (profile.profileUrl.split('/in/')[1] || '').toLowerCase().split(/[-_]/).filter((w) => /^[a-z]{2,}$/.test(w));
    let nameIdx = -1;
    for (let i = end - 2; i >= 0 && slugWords.length; i -= 1) {
      if (isNameLike(block[i]) && block[i].toLowerCase().split(/\s+/).some((w) => slugWords.includes(w))) { nameIdx = i; break; }
    }
    if (nameIdx < 0) {
      // No URL to match: the headline is the line above the location, plus
      // the line before it when the headline wrapped (ends with | , & - ·).
      let h = end - 1;
      while (h - 1 > 0 && (/[|,&\-–·:/]$/.test(block[h - 1]) || /^[a-z|&,·]/.test(block[h]))) h -= 1;
      nameIdx = h - 1;
    }
    if (nameIdx >= 0) profile.name = block[nameIdx];
    profile.headline = block.slice(nameIdx + 1, end).join(' ').replace(/\s+\|/g, ' |').trim();
    // The last sidebar section ran into the name block; cut it there.
    if (m > 0) sections[heads[m - 1].key] = block.slice(0, Math.max(nameIdx, 0));
  }

  profile.about = (sections.summary || []).join(' ').trim();
  profile.experience = [...parseExperience(sections.experience || []), ...parseExperience(sections.projects || [])];
  profile.education = sections.education || [];
  profile.skills = sections.skills || [];
  profile.certifications = sections.certifications || [];
  profile.languages = sections.languages || [];
  return profile;
}

/** The PrimoBoost profile (user_profiles row) as a LinkedIn profile. The LinkedIn headline is not stored there. */
export function profileFromUserProfile(row: any): LinkedInProfile {
  const list = (value: any): any[] => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  };
  const bullets = (b: any) => (Array.isArray(b) ? b : []).map((x: any) => String(x).trim()).filter(Boolean).join(' ');
  return {
    ...emptyProfile(),
    name: row?.full_name || '',
    location: row?.current_location || '',
    about: row?.resume_headline || '',
    profileUrl: (row?.linkedin_profile_url || '').replace(/^https?:\/\/(www\.)?/, ''),
    experience: [
      ...list(row?.experience_details).filter((e) => e?.role || e?.company)
        .map((e) => ({ title: e.role || '', org: e.company || '', dates: e.year || '', description: bullets(e.bullets) })),
      ...list(row?.projects_details).filter((p) => p?.title)
        .map((p) => ({ title: p.title, org: 'Project', dates: '', description: bullets(p.bullets) })),
    ],
    education: list(row?.education_details).map((e) => [e.degree, e.school, e.year].filter(Boolean).join(', ')).filter(Boolean),
    skills: [...new Set(list(row?.skills_details).flatMap((s) => (s?.list || []).map((x: any) => String(x).trim())).filter(Boolean))],
    certifications: list(row?.certifications_details).map((c) => c?.title || '').filter(Boolean),
  };
}

// ---------------------------------------------------------------- scoring

const STOP_WORDS = new Set(['aspiring', 'junior', 'senior', 'intern', 'fresher', 'trainee', 'entry', 'level', 'and', 'the', 'of', 'for', 'in', 'a', 'jr', 'sr']);
const roleWords = (role: string) =>
  role.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word, case-insensitive; "Maven/Gradle" matches either, "Python/R" matches Python, "A/B Testing" only whole. */
export const mentions = (text: string, keyword: string) => {
  const parts = keyword.split('/').map((k) => k.trim());
  const candidates = parts.every((k) => k.length > 1) ? parts : [keyword, ...(parts[0].length > 1 ? [parts[0]] : [])];
  return candidates.some((t) => !!t && new RegExp(`(^|[^a-z0-9])${escapeRe(t.toLowerCase())}($|[^a-z0-9])`).test(text.toLowerCase()));
};

/** Skills and keywords for the role, from the curated role list; the role's own words when it is not listed. */
export function roleKeywords(targetRole: string): string[] {
  const words = roleWords(targetRole);
  let best: (typeof RESUME_ROLES)[number] | null = null;
  let bestHits = 0;
  for (const r of RESUME_ROLES) {
    for (const title of [r.title, ...r.altTitles]) {
      const tw = roleWords(title);
      const hits = tw.filter((w) => words.includes(w)).length;
      if (hits === tw.length && hits > bestHits) { best = r; bestHits = hits; }
    }
  }
  // "Power BI/Tableau" is two skills; "Python/R" and "A/B Testing" stay whole.
  const split = (k: string) => (k.split('/').every((part) => part.trim().length > 1) ? k.split('/').map((s) => s.trim()) : [k]);
  return [...new Set(best ? [...best.skills, ...best.keywords].flatMap(split) : [])];
}

export const COMPLETENESS_ITEMS = [
  { id: 'photo', label: 'Professional profile photo', points: 5 },
  { id: 'banner', label: 'Custom banner image', points: 3 },
  { id: 'customUrl', label: 'Custom profile URL', points: 3 },
  { id: 'openToWork', label: '"Open to work" turned on (recruiters only is fine)', points: 3 },
  { id: 'recommendations', label: '2 or more recommendations', points: 4 },
  { id: 'certifications', label: 'Licenses & certifications added', points: 3 },
  { id: 'featured', label: 'Featured section (project, post or certificate)', points: 4 },
] as const;
export type CompletenessId = (typeof COMPLETENESS_ITEMS)[number]['id'];
export type Completeness = Partial<Record<CompletenessId, boolean>>;

/** What the parsed profile already proves, so the user does not have to tick it. */
export const detectedCompleteness = (p: LinkedInProfile): Completeness => ({
  customUrl: hasCustomUrl(p.profileUrl) || undefined,
  certifications: p.certifications.length > 0 || undefined,
});

export type ScoreSection = 'headline' | 'about' | 'experience' | 'skills' | 'completeness';
export interface ScoreCheck {
  id: string;
  section: ScoreSection;
  label: string;
  points: number;
  max: number;
  fix: string;
}
export interface LinkedInScore {
  total: number;
  checks: ScoreCheck[];
  sections: Record<ScoreSection, { points: number; max: number }>;
  topFixes: ScoreCheck[];
}

export interface ScoreOptions {
  targetRole: string;
  level: ExperienceLevel;
  completeness?: Completeness;
  /** LinkedIn's PDF lists only the top 3 skills; the user can say how many they really have. */
  skillCount?: number;
}

const ACTION_VERB = /\b(built|developed|designed|created|led|managed|implemented|analy[sz]ed|automated|improved|reduced|increased|launched|delivered|optimi[sz]ed|organi[sz]ed|trained|deployed|migrated|wrote|conducted|coordinated|achieved|won|presented|researched|tested|integrated|streamlined|cleaned|visuali[sz]ed|handled|resolved|mentored|planned)\b/i;
const CTA = /\b(reach out|connect|contact|email|e-mail|dm|message me|open to|let'?s|feel free|get in touch|hiring)\b/i;
const WEAK_OPENER = /^(hi|hello|hey|i am a|i'm a|my name is|myself)\b/i;
const GENERIC_STUDENT = /^\W*((final[- ]year |b\.?\s?tech |b\.?e\.? |mba |mca |bca |engineering |computer science )?(student|fresher|graduate|undergraduate))\b[^|,]*$/i;

export function scoreLinkedInProfile(p: LinkedInProfile, o: ScoreOptions): LinkedInScore {
  const checks: ScoreCheck[] = [];
  const add = (section: ScoreSection, id: string, label: string, max: number, points: number, fix: string) =>
    checks.push({ id, section, label, max, points: Math.max(0, Math.min(max, Math.round(points))), fix });

  const keywords = roleKeywords(o.targetRole);
  const words = roleWords(o.targetRole);
  const role = o.targetRole.trim() || 'your target role';
  const kwIn = (text: string) => keywords.filter((k) => mentions(text, k));

  // Headline: 20
  const h = p.headline.trim();
  add('headline', 'headline-role', `Headline names the role (${role})`, 8,
    words.length && words.every((w) => mentions(h, w)) ? 8 : words.some((w) => mentions(h, w)) ? 4 : 0,
    `Put "${role}" at the start of your headline. Recruiters search by job title.`);
  const hk = kwIn(h).filter((k) => !words.some((w) => k.toLowerCase() === w));
  add('headline', 'headline-keywords', 'Headline has 2+ role skills', 6, hk.length >= 2 ? 6 : hk.length * 3,
    `Add 2-3 skills recruiters search for, e.g. ${keywords.slice(0, 3).join(', ') || 'your top skills'}, separated by |.`);
  add('headline', 'headline-not-generic', 'Headline is more than "Student at X"', 3, h && !GENERIC_STUDENT.test(h) ? 3 : 0,
    'Replace "Student at <college>" with what you do: role | skills | what you are looking for.');
  add('headline', 'headline-length', 'Headline is filled in and 220 characters or less', 3, h && h.length <= 220 ? 3 : 0,
    h.length > 220 ? 'Shorten your headline to 220 characters; LinkedIn cuts the rest.' : 'Write a headline; it is the first thing people see.');

  // About: 20
  const a = p.about.trim();
  const firstSentence = a.split(/(?<=[.!?])\s/)[0] || '';
  add('about', 'about-length', 'About is 800-2,600 characters', 7,
    a.length >= 800 && a.length <= 2600 ? 7 : a.length >= 400 ? 3 : 0,
    a ? `Your About is ${a.length} characters. Aim for 800-2,600: what you do, proof, skills, how to reach you.` : 'Add an About section (800-2,600 characters).');
  add('about', 'about-hook', 'About opens with a strong first line', 4,
    firstSentence.length >= 20 && firstSentence.length <= 200 && !WEAK_OPENER.test(firstSentence) ? 4 : 0,
    'Open with one line that says what you do and for whom, not "Hi, I am...". Only the first ~2 lines show before "see more".');
  add('about', 'about-skills', 'About mentions 3+ role skills', 3, Math.min(3, kwIn(a).length),
    `Name the tools you actually use (${keywords.slice(0, 4).join(', ') || 'your main skills'}) in your About.`);
  add('about', 'about-proof', 'About shows a result or achievement (a number)', 3, /\d/.test(a) ? 3 : 0,
    'Add one concrete result with a number: a project outcome, rank, accuracy, users, time saved.');
  add('about', 'about-cta', 'About ends with a call to action', 3, CTA.test(a) ? 3 : 0,
    'End with how to reach you, e.g. "Open to Data Analyst roles - message me or email ...".');

  // Experience / projects: 20
  const label = o.level === 'experienced' ? 'experience' : 'experience or projects';
  const entries = p.experience;
  const share = (test: (e: LinkedInEntry) => boolean) => (entries.length ? entries.filter(test).length / entries.length : 0);
  add('experience', 'exp-present', `Has at least one ${label} entry`, 5, entries.length ? 5 : 0,
    o.level === 'experienced' ? 'Add your jobs to Experience.' : 'Add internships or projects (Projects section, or as Experience entries).');
  add('experience', 'exp-descriptions', 'Each entry has a description', 5, 5 * share((e) => e.description.length >= 60),
    'Write 2-4 lines under every entry: what you did, the tools, and the result.');
  add('experience', 'exp-verbs', 'Descriptions start with action verbs', 5, 5 * share((e) => ACTION_VERB.test(e.description)),
    'Start lines with action verbs: Built, Analysed, Automated, Led, Improved.');
  add('experience', 'exp-numbers', 'Descriptions include numbers', 5, 5 * share((e) => /\d/.test(e.description)),
    'Add numbers where true: users, %, time saved, dataset size, rank.');

  // Skills: 15
  const count = Math.max(p.skills.length, o.skillCount || 0);
  add('skills', 'skills-count', 'At least 10 skills (20+ is ideal)', 9, count >= 20 ? 9 : count >= 10 ? 6 : count >= 5 ? 3 : 0,
    `You have ${count} skills listed. Add skills you really have until you reach 20+.`);
  const topMatch = p.skills.slice(0, 3).filter((s) => keywords.some((k) => mentions(s, k) || mentions(k, s)) || words.some((w) => mentions(s, w)));
  add('skills', 'skills-top', 'Top 3 skills match the role', 6, topMatch.length * 2,
    `Pin your 3 skills most relevant to ${role} at the top of Skills.`);

  // Completeness: 25
  const ticked = { ...detectedCompleteness(p), ...o.completeness };
  for (const item of COMPLETENESS_ITEMS) {
    add('completeness', item.id, item.label, item.points, ticked[item.id] ? item.points : 0, `Add: ${item.label.toLowerCase()}.`);
  }

  const sections = { headline: { points: 0, max: 0 }, about: { points: 0, max: 0 }, experience: { points: 0, max: 0 }, skills: { points: 0, max: 0 }, completeness: { points: 0, max: 0 } };
  for (const c of checks) { sections[c.section].points += c.points; sections[c.section].max += c.max; }
  const total = checks.reduce((sum, c) => sum + c.points, 0);
  const topFixes = checks.filter((c) => c.points < c.max).sort((x, y) => (y.max - y.points) - (x.max - x.points)).slice(0, 5);
  return { total, checks, sections, topFixes };
}

// ---------------------------------------------------------------- AI rewrite

export interface LinkedInRewrite {
  headlines: string[];
  about: string;
  experience: { index: number; description: string }[];
  pinSkills: string[];
  /** Skills the profile already shows but has not listed under Skills. */
  addSkills: string[];
  /** Common for the role but not in the profile: add only if true. */
  addIfYouHaveIt: string[];
  customUrl: string;
  bannerText: string;
}

/** Everything the profile says, the evidence a rewrite is checked against. */
export const profileText = (p: LinkedInProfile) =>
  [p.headline, p.about, ...p.experience.flatMap((e) => [e.title, e.org, e.description]), ...p.education, ...p.skills, ...p.certifications, ...p.languages].join('\n');

const profileForPrompt = (p: LinkedInProfile) => JSON.stringify({
  headline: p.headline, about: p.about, location: p.location,
  experience: p.experience.map((e, index) => ({ index, ...e })),
  education: p.education, skills: p.skills, certifications: p.certifications, languages: p.languages,
});

const clip = (s: string, max: number) => {
  const t = String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).trim();
};

const parseJson = (raw: string): any => {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI answer was not in the expected format.');
  return JSON.parse(raw.slice(start, end + 1));
};

const strings = (v: any): string[] => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : []);

/** Shapes the AI answer and enforces the honesty rules in code, not just in the prompt. */
export function normaliseRewrite(data: any, p: LinkedInProfile): LinkedInRewrite {
  const evidence = profileText(p);
  const inProfile = (s: string) => mentions(evidence, s);
  const unique = (list: string[]) => [...new Map(list.map((s) => [s.toLowerCase(), s])).values()];
  const suggested = unique([...strings(data?.addSkills), ...strings(data?.addIfYouHaveIt)]);
  const listed = new Set(p.skills.map((s) => s.toLowerCase()));
  return {
    headlines: strings(data?.headlines).map((h) => clip(h, 220)).filter(Boolean).slice(0, 3),
    about: clip(data?.about || '', 2600),
    experience: (Array.isArray(data?.experience) ? data.experience : [])
      .map((e: any) => ({ index: Number(e?.index), description: String(e?.description || '').trim() }))
      .filter((e: { index: number; description: string }) => Number.isInteger(e.index) && e.index >= 0 && e.index < p.experience.length && e.description),
    pinSkills: unique(strings(data?.pinSkills).filter(inProfile)).slice(0, 3),
    addSkills: suggested.filter((s) => inProfile(s) && !listed.has(s.toLowerCase())).slice(0, 20),
    addIfYouHaveIt: suggested.filter((s) => !inProfile(s)).slice(0, 20),
    customUrl: String(data?.customUrl || '').toLowerCase().replace(/^.*\/in\//, '').replace(/[^a-z0-9-]/g, '').slice(0, 100),
    bannerText: clip(data?.bannerText || '', 120),
  };
}

/**
 * Role skills and numbers that appear in the rewrite but nowhere in the
 * profile: the user should check them before posting.
 */
export function unsupportedClaims(p: LinkedInProfile, r: LinkedInRewrite, targetRole: string): string[] {
  const evidence = profileText(p);
  const written = [r.about, ...r.headlines, ...r.experience.map((e) => e.description)].join('\n');
  const skills = roleKeywords(targetRole).filter((k) => mentions(written, k) && !mentions(evidence, k));
  const numbers = [...new Set(written.match(/\d+(?:\.\d+)?%?/g) || [])].filter((n) => !evidence.includes(n.replace('%', '')));
  return [...skills, ...numbers];
}

/** The profile with the rewrite applied (first headline), for the "after" score. */
export function applyRewrite(p: LinkedInProfile, r: LinkedInRewrite): LinkedInProfile {
  return {
    ...p,
    headline: r.headlines[0] || p.headline,
    about: r.about || p.about,
    experience: p.experience.map((e, i) => ({ ...e, description: r.experience.find((x) => x.index === i)?.description || e.description })),
    skills: [...new Map([...r.pinSkills, ...p.skills, ...r.addSkills].map((s) => [s.toLowerCase(), s])).values()],
  };
}

const levelText = (level: ExperienceLevel) =>
  level === 'student' ? 'a student' : level === 'fresher' ? 'a fresher (recent graduate, little or no work experience)' : 'an experienced professional';

/** Free: one headline from a short prompt on a free model. */
export async function generateHeadlineSample(p: LinkedInProfile, targetRole: string, level: ExperienceLevel): Promise<string> {
  const { openrouter } = await import('./aiProxyService');
  const prompt = `Write ONE LinkedIn headline (max 200 characters) for ${levelText(level)} targeting "${targetRole}" roles in India.
Format: Role | 2-3 skills | what they offer or seek. Use ONLY skills and facts from this profile, invent nothing.
Current headline: ${p.headline || '(none)'}
Skills: ${p.skills.slice(0, 15).join(', ') || '(none listed)'}
Experience/projects: ${p.experience.slice(0, 4).map((e) => `${e.title} - ${e.org}`).join('; ') || '(none)'}
Certifications: ${p.certifications.slice(0, 4).join('; ') || '(none)'}
Reply with the headline only, no quotes.`;
  const raw = await openrouter.chat(prompt, { maxTokens: 200, temperature: 0.5 });
  const line = String(raw || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  const headline = clip(line.replace(/^headline:\s*/i, ''), 220);
  if (!headline) throw new Error('No headline came back. Please try again.');
  return headline;
}

/** Paid: the full rewrite on the Quick tier model. The caller holds the credit reservation. */
export async function generateFullRewrite(p: LinkedInProfile, targetRole: string, level: ExperienceLevel): Promise<LinkedInRewrite> {
  const { openrouter } = await import('./aiProxyService');
  const tier = getJdOptimizationTier('quick');
  const prompt = `You are a LinkedIn profile writer for job seekers in India. The person is ${levelText(level)} targeting "${targetRole}" roles.

PROFILE (the only source of facts):
${profileForPrompt(p)}

STRICT HONESTY RULES:
- Use ONLY facts, skills, tools, numbers, employers, projects and certifications that appear in the PROFILE.
- Never invent numbers, results, employers, tools or certifications. If a description has no number, do not add one.
- Skills not in the PROFILE go ONLY in "addIfYouHaveIt", never into the headline, about or experience text.

Return ONLY this JSON:
{
  "headlines": ["3 different headlines, each max 220 characters: role | skills | value or what they seek"],
  "about": "max 2600 characters, first person, short paragraphs: a hook line -> what I do -> proof and achievements from the profile -> key skills -> a call to action (how to reach me / what roles I am open to)",
  "experience": [{"index": 0, "description": "improved description for that entry: 2-4 lines starting with action verbs, same facts"}],
  "pinSkills": ["the 3 skills from the profile most relevant to the role"],
  "addSkills": ["up to 20 skills the profile shows (in descriptions, projects, certifications) but are worth listing, most relevant first"],
  "addIfYouHaveIt": ["up to 10 skills common for ${targetRole} that the profile does NOT show"],
  "customUrl": "a short custom URL slug, e.g. firstname-lastname-role",
  "bannerText": "a short banner line (max 100 characters)"
}`;
  let lastError: unknown;
  for (const model of [tier.modelId, tier.refinementFallbackModel]) {
    try {
      const raw = await openrouter.chat(prompt, { model, maxTokens: 3500 });
      const rewrite = normaliseRewrite(parseJson(raw), p);
      if (!rewrite.headlines.length || !rewrite.about) throw new Error('The AI answer was incomplete.');
      return rewrite;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('The rewrite failed.');
}
