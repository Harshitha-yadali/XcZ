import {
  ResumeData,
  Education,
  WorkExperience,
  Project,
  Skill,
  Certification,
} from '../types/resume';
import { openrouter } from './aiProxyService';

export interface ParsedResume extends ResumeData {
  parsedText: string;
  parsingConfidence?: number;
  rawResponse?: any;
}

const MAX_PARSED_TEXT_LENGTH = 45000;
const MAX_RETRIES = 1;

const RESUME_PARSER_SYSTEM_PROMPT = `You are an enterprise-grade resume parsing and structuring engine.

Your task is to convert raw resume text into structured JSON format.

Strict rules:
1. Do not invent information.
2. Do not guess missing data.
3. Extract only what is explicitly present.
4. Preserve original wording of bullet points.
5. Preserve all numbers, percentages, and metrics exactly.
6. If a section is missing, return an empty array or empty string.
7. Do not summarize.
8. Do not improve wording.
9. Return ONLY valid JSON.
10. Do not include markdown formatting.

Extract structured resume data in this exact JSON schema:

{
  "name": "",
  "title": "",
  "contact": {
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "github": ""
  },
  "summary": "",
  "skills": [],
  "experience": [
    {
      "company": "",
      "role": "",
      "duration": "",
      "bullets": []
    }
  ],
  "projects": [
    {
      "name": "",
      "tech_stack": [],
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "year": "",
      "cgpa": "",
      "location": ""
    }
  ],
  "certifications": []
}

Important:
- Detect section headings even if named differently (e.g., Work History, Professional Experience).
- Separate bullet points correctly.
- Extract skills individually.
- Extract company names and roles properly.
- If multiple experiences exist, return all.
- CRITICAL: Internships, Trainee positions, and any "Internship" section MUST go into the "experience" array, NOT into "education". They are work experience.
- If you see a section titled "Internship" or "Internships", treat every entry under it as work experience with company, role, duration, and bullets.
- Only put academic degrees (B.Tech, M.Tech, BSc, MSc, MBA, PhD, High School, SSC, Intermediate, etc.) into the "education" array.`;

const REQUIRED_KEYS = ['name', 'contact', 'experience', 'education'];

function validateParsedJSON(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  for (const key of REQUIRED_KEYS) {
    if (!(key in data)) return false;
  }
  return true;
}

function safeParseJSON(raw: string): any {
  let cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (jsonMatch) {
    cleaned = jsonMatch[1];
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const fixed = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    return JSON.parse(fixed);
  }
}

async function extractWithGemini(text: string): Promise<any> {
  const userPrompt = `Resume Text:\n"""\n${text.slice(0, 12000)}\n"""`;

  const response = await openrouter.chatWithSystem(
    RESUME_PARSER_SYSTEM_PROMPT,
    userPrompt,
    { model: 'google/gemini-2.5-flash', temperature: 0.1 }
  );

  if (!response) {
    throw new Error('Empty response from Gemini');
  }

  const parsed = safeParseJSON(response);

  if (!validateParsedJSON(parsed)) {
    throw new Error('Response missing required keys');
  }

  return parsed;
}

async function extractWithRetry(text: string): Promise<any> {
  try {
    return await extractWithGemini(text);
  } catch (firstError: any) {
    console.warn('First parse attempt failed:', firstError.message);

    if (MAX_RETRIES > 0) {
      try {
        const retryPrompt = `Return ONLY valid JSON. Fix formatting.\n\nResume Text:\n"""\n${text.slice(0, 12000)}\n"""`;
        const response = await openrouter.chatWithSystem(
          RESUME_PARSER_SYSTEM_PROMPT,
          retryPrompt,
          { model: 'google/gemini-2.5-flash', temperature: 0.05 }
        );

        const parsed = safeParseJSON(response);
        if (validateParsedJSON(parsed)) return parsed;
      } catch (retryError: any) {
        console.error('Retry also failed:', retryError.message);
      }
    }

    throw firstError;
  }
}

const INTERNSHIP_PATTERN = /intern|trainee|apprentice|industrial training|summer training|winter training/i;
const DEGREE_PATTERN = /\b(b\.?\s*tech|m\.?\s*tech|b\.?\s*e\b|m\.?\s*e\b|b\.?\s*sc|m\.?\s*sc|b\.?\s*a\b|m\.?\s*a\b|b\.?\s*com|m\.?\s*com|mba|phd|diploma|ssc|hsc|10th|12th|intermediate|high school|bachelor|master|associate|doctorate)\b/i;

function isInternshipEntry(entry: any): boolean {
  const combined = [
    entry.degree || '',
    entry.institution || entry.school || '',
    entry.role || entry.title || '',
    entry.company || '',
    ...(Array.isArray(entry.bullets) ? entry.bullets : []),
  ].join(' ');
  if (INTERNSHIP_PATTERN.test(combined)) return true;
  if (entry.company && entry.role && !DEGREE_PATTERN.test(entry.degree || '')) return true;
  if (entry.bullets && Array.isArray(entry.bullets) && entry.bullets.length > 0 && !DEGREE_PATTERN.test(entry.degree || '')) return true;
  return false;
}

function mapToResume(parsed: any, rawText: string): ParsedResume {
  const truncatedText = rawText.length > MAX_PARSED_TEXT_LENGTH
    ? rawText.substring(0, MAX_PARSED_TEXT_LENGTH) + '... [truncated]'
    : rawText;

  const contact = parsed.contact || {};

  const rawEducation = parsed.education || [];
  const realEducation: any[] = [];
  const rescuedExperience: any[] = [];

  for (const e of rawEducation) {
    if (isInternshipEntry(e)) {
      rescuedExperience.push(e);
    } else {
      realEducation.push(e);
    }
  }

  const education: Education[] = realEducation.map((e: any) => ({
    degree: e.degree || '',
    school: e.institution || e.school || '',
    year: e.year || '',
    cgpa: e.cgpa || e.gpa || '',
    location: e.location || '',
  }));

  const parsedExperience = parsed.experience || parsed.workExperience || [];
  const allExperience = [
    ...parsedExperience,
    ...rescuedExperience.map((e: any) => ({
      company: e.institution || e.school || e.company || '',
      role: e.degree || e.role || e.title || '',
      duration: e.year || e.duration || '',
      bullets: Array.isArray(e.bullets) ? e.bullets : [],
    })),
  ];

  const workExperience: WorkExperience[] = allExperience.map((w: any) => ({
    role: w.role || w.title || '',
    company: w.company || '',
    year: w.duration || w.year || '',
    bullets: Array.isArray(w.bullets) ? w.bullets : [],
  }));

  const projects: Project[] = (parsed.projects || []).map((p: any) => ({
    title: p.name || p.title || '',
    bullets: Array.isArray(p.bullets) ? p.bullets : [],
    githubUrl: p.github_url || p.githubUrl || '',
  }));

  const rawSkills = parsed.skills || [];
  const skills: Skill[] = rawSkills.map((s: any) => {
    if (typeof s === 'string') return { category: 'Skills', count: 1, list: [s] };
    if (Array.isArray(s)) return { category: 'Skills', count: s.length, list: s };
    const list = Array.isArray(s.list) ? s.list : (Array.isArray(s.skills) ? s.skills : []);
    return { category: s.category || 'Skills', count: list.length, list };
  });

  const certifications: Certification[] = (parsed.certifications || []).map((c: any) => {
    if (typeof c === 'string') return { title: c, description: '' };
    return { title: c.title || c.name || '', description: c.description || '' };
  });

  return {
    name: parsed.name || '',
    phone: contact.phone || parsed.phone || '',
    email: contact.email || parsed.email || '',
    linkedin: contact.linkedin || parsed.linkedin || '',
    github: contact.github || parsed.github || '',
    location: contact.location || parsed.location || '',
    summary: parsed.summary || '',
    careerObjective: parsed.summary || parsed.career_objective || '',
    targetRole: parsed.title || '',
    education,
    workExperience,
    projects,
    skills,
    certifications,
    parsedText: truncatedText,
    parsingConfidence: 0.95,
    rawResponse: parsed,
    origin: 'gemini_parsed',
  };
}

export const parseResumeFromFile = async (file: File): Promise<ParsedResume> => {
  let extractedText = '';

  try {
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      extractedText = await file.text();
    } else {
      const { parseFile } = await import('../utils/fileParser');
      const result = await parseFile(file);
      extractedText = result.text;
    }

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Could not extract enough text from file. Please ensure the file contains readable text.');
    }

    const parsed = await extractWithRetry(extractedText);
    const resume = mapToResume(parsed, extractedText);

    if (resume.name === 'John Doe' || resume.email === 'johndoe@example.com') {
      throw new Error('Placeholder data received - extraction failed');
    }

    return resume;
  } catch (error: any) {
    console.error('Resume parsing failed:', error.message);
    throw new Error(`Failed to parse resume: ${error.message}`);
  }
};

export const parseResumeFromUrl = async (_: string): Promise<ParsedResume> => {
  throw new Error('URL parsing not supported');
};

export const geminiResumeParserService = { parseResumeFromFile, parseResumeFromUrl };
export default geminiResumeParserService;
