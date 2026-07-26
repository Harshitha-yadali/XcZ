import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { FullResumeRewriter16ParameterService } from './fullResumeRewriter16ParameterService';

const createResume = (): ResumeData => ({
  name: 'Sandhya P',
  email: 'sandhya@example.com',
  phone: '+91 9000000000',
  linkedin: '',
  github: '',
  targetRole: 'Software Engineer',
  summary: 'Frontend engineer building maintainable React applications.',
  skills: [
    {
      category: 'Programming Languages',
      count: 2,
      list: ['JavaScript', 'TypeScript'],
    },
    {
      category: 'Frontend Technologies',
      count: 1,
      list: ['React'],
    },
    {
      category: 'Soft Skills',
      count: 1,
      list: ['Collaboration'],
    },
  ],
  workExperience: [
    {
      role: 'Software Engineer',
      company: 'Example Tech',
      year: '2023-Present',
      bullets: [
        'Built reusable React components for customer dashboards.',
        'Integrated REST APIs and improved frontend reliability.',
      ],
    },
  ],
  projects: [
    {
      title: 'Job Portal',
      bullets: ['Developed job search interfaces using React and TypeScript.'],
    },
  ],
  education: [
    {
      degree: 'B.Tech Computer Science',
      school: 'Example University',
      year: '2023',
    },
  ],
  certifications: [],
});

describe('FullResumeRewriter16ParameterService', () => {
  it('completes soft-skill cleanup without referencing a removed category', async () => {
    const result = await FullResumeRewriter16ParameterService.rewriteResume(
      createResume(),
      `
        Build maintainable web applications using React, TypeScript, REST APIs,
        testing, Git, agile delivery, and cross-functional collaboration.
      `,
      'Software Engineer',
      'experienced',
    );

    expect(result.rewrittenResume.skills).toBeDefined();
    expect(
      result.rewrittenResume.skills?.some((skill) =>
        skill.category.toLowerCase().includes('soft'),
      ),
    ).toBe(false);
  });
});
