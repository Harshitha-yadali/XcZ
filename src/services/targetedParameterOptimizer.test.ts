import { beforeEach, describe, expect, it, vi } from 'vitest';
import { optimizeByParameter } from './targetedParameterOptimizer';
import type { ResumeData } from '../types/resume';

const { chatWithSystemMock } = vi.hoisted(() => ({
  chatWithSystemMock: vi.fn(),
}));

vi.mock('./aiProxyService', () => ({
  openrouter: {
    chatWithSystem: chatWithSystemMock,
  },
}));

describe('targetedParameterOptimizer', () => {
  beforeEach(() => {
    chatWithSystemMock.mockReset();
  });

  it('rebuilds skills locally from resume evidence when AI categorization times out', async () => {
    chatWithSystemMock.mockRejectedValue(
      new Error('AI proxy request failed (504): {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit reached"}')
    );

    const resume: ResumeData = {
      name: 'Alice Smith',
      phone: '+91 9876543210',
      email: 'alice@example.com',
      linkedin: '',
      github: '',
      summary: 'Frontend engineer with experience in TypeScript, React, Node.js, PostgreSQL, Docker, SAP Fiori, and UI5.',
      targetRole: 'Frontend Engineer',
      education: [],
      workExperience: [
        {
          role: 'Software Engineer',
          company: 'Acme Corp',
          year: '2022 - Present',
          bullets: [
            'Built SAP Fiori dashboards with UI5 and React for enterprise users.',
            'Developed Node.js APIs with PostgreSQL and Docker deployment workflows.',
          ],
        },
      ],
      projects: [
        {
          title: 'Internal Portal',
          bullets: ['Created a TypeScript portal with React and automated testing.'],
          techStack: ['TypeScript', 'React', 'PostgreSQL'],
        },
      ],
      skills: [
        { category: 'Languages', count: 1, list: ['Scala'] },
        { category: 'Frontend', count: 1, list: ['Sap Fiori Ui5'] },
        { category: 'Tools', count: 1, list: ['Git'] },
        { category: 'Core Competencies', count: 2, list: ['Data Structures', 'Agile Methodologies'] },
      ],
      certifications: [],
    };

    const jd = 'We need a frontend engineer with React, TypeScript, SAP Fiori, UI5, Node.js, PostgreSQL, Docker and Git.';
    const result = await optimizeByParameter(resume, jd, []);

    const byCategory = Object.fromEntries(
      (result.optimizedResume.skills || []).map((category) => [category.category, category.list])
    ) as Record<string, string[]>;

    expect(byCategory['Languages']).toBeDefined();
    expect(byCategory['Languages'].length).toBeGreaterThanOrEqual(2);
    expect(byCategory['Languages']).toEqual(expect.arrayContaining(['Scala', 'TypeScript']));
    expect(byCategory['Frontend']).toEqual(expect.arrayContaining(['SAP Fiori', 'UI5', 'React']));
    expect(byCategory['Backend']).toEqual(expect.arrayContaining(['Node.js']));
    expect(byCategory['Databases']).toEqual(expect.arrayContaining(['PostgreSQL']));
    expect(byCategory['Cloud/DevOps']).toEqual(expect.arrayContaining(['Docker']));
    expect(byCategory['Tools']).toEqual(expect.arrayContaining(['Git']));
  });
});
