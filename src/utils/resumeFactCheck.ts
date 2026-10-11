import { ResumeData } from '../types/resume';

// Compares a tailored resume with the text of the resume the user uploaded and
// lists every fact the tailored one states that the original does not. Rewording
// is fine; a new employer, date, qualification, skill or figure is not, and the
// user has to see it before the resume is sent anywhere.

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#%]+/g, ' ').trim();

/**
 * Returns one line per unsupported fact, in the order a reader meets them on
 * the resume. An empty list means every checked fact appears in the original.
 */
export function findUnsupportedClaims(originalText: string, tailored: ResumeData): string[] {
  const original = ` ${normalize(originalText)} `;
  const supported = (value: string) => {
    const wanted = normalize(value);
    return !wanted || original.includes(` ${wanted} `);
  };
  const flags: string[] = [];
  const check = (kind: string, value: string | undefined) => {
    if (value && !supported(value)) flags.push(`${kind}: ${value.trim()}`);
  };
  const years = (value: string | undefined) => (value || '').match(/\b(?:19|20)\d{2}\b/g) || [];
  // Percentages and multipliers are claims of achievement, so each must be the user's own.
  const figures = (lines: string[] | undefined) =>
    (lines || []).flatMap((line) => line.match(/\d+(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?x\b/gi) || []);

  for (const job of tailored.workExperience || []) {
    check('Employer', job.company);
    check('Job title', job.role);
    for (const year of years(job.year)) check('Year', year);
    for (const figure of figures(job.bullets)) check('Figure', figure);
  }
  for (const school of tailored.education || []) {
    check('School', school.school);
    check('Degree', school.degree);
    for (const year of years(school.year)) check('Year', year);
  }
  for (const certification of tailored.certifications || []) {
    check('Certification', typeof certification === 'string' ? certification : certification.title);
  }
  for (const project of tailored.projects || []) {
    check('Project', project.title);
    for (const figure of figures(project.bullets)) check('Figure', figure);
  }
  for (const figure of figures(tailored.achievements)) check('Figure', figure);
  for (const group of tailored.skills || []) {
    for (const skill of group.list || []) check('Skill', skill);
  }
  return [...new Set(flags)];
}
