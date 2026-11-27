import { describe, it, expect } from 'vitest';
import { fitResumeToOnePage } from './exportUtils';
import { defaultExportOptions, gradeLabel } from '../types/export';
import type { ResumeData } from '../types/resume';

const bullet = 'Built and shipped a production feature in React and Node.js used by 2,000 people, cutting load time by 35% with caching.';
const resume = (jobs: number): ResumeData => ({
  name: 'Test Person', phone: '+91 90000 00000', email: 'test@example.com', linkedin: '', github: '',
  summary: 'Engineer with several years of experience building web products.',
  education: [{ degree: 'B.Tech', school: 'Some College', year: '2019 - 2023', cgpa: '8.1' }],
  workExperience: Array.from({ length: jobs }, (_, i) => ({ role: 'Engineer', company: `Company ${i}`, year: '2023', bullets: [bullet, bullet, bullet, bullet] })),
  projects: [], skills: [{ category: 'Languages', count: 2, list: ['TypeScript', 'Python'] }], certifications: [],
});

describe('fitResumeToOnePage', () => {
  it('fits a normal resume that runs to two pages at default size', async () => {
    const fit = await fitResumeToOnePage(resume(3), 'experienced', defaultExportOptions);
    expect(fit.pages).toBe(1);
    expect(fit.options.bodyTextSize).toBeGreaterThanOrEqual(9);
  });

  it('reports the real page count when even the smallest size cannot fit', async () => {
    const fit = await fitResumeToOnePage(resume(15), 'experienced', defaultExportOptions);
    expect(fit.pages).toBeGreaterThan(1);
    expect(fit.options.bodyTextSize).toBe(9);
  });
});

describe('gradeLabel', () => {
  it('calls a % value a percentage', () => {
    expect(gradeLabel('96%')).toBe('Percentage');
    expect(gradeLabel('8.4')).toBe('CGPA');
  });
});
