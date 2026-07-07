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

  it('adds only JD skills that already have resume evidence', async () => {
    chatWithSystemMock.mockRejectedValue(
      new Error('AI proxy request failed (504): {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit reached"}')
    );

    const resume: ResumeData = {
      name: 'Backend Candidate',
      phone: '+91 9999999999',
      email: 'backend@example.com',
      linkedin: '',
      github: '',
      summary: 'Software engineer building backend services with Python and Django.',
      targetRole: 'Software Engineer',
      education: [],
      workExperience: [
        {
          role: 'Software Engineer',
          company: 'Acme',
          year: '2024 - Present',
          bullets: [
            'Developed backend APIs using Python and Django.',
            'Automated deployment workflows with GitHub Actions and Terraform.',
          ],
        },
      ],
      projects: [],
      skills: [
        { category: 'Languages', count: 1, list: ['Python'] },
        { category: 'Tools', count: 1, list: ['Git'] },
      ],
      certifications: [],
    };

    const jd = 'Hiring a backend engineer with Django, PostgreSQL, Redis, Terraform, and GitHub Actions.';
    const gaps = [
      {
        parameterId: 6,
        parameterName: 'Hard Skills Match',
        category: 'Skills',
        currentScore: 1,
        maxScore: 5,
        percentage: 20,
        fixType: 'ai' as const,
        suggestions: ['Add missing skills: Django, PostgreSQL, Redis, Terraform, GitHub Actions'],
        priority: 'critical' as const,
      },
    ];

    const result = await optimizeByParameter(resume, jd, gaps);
    const allSkills = (result.optimizedResume.skills || []).flatMap(category => category.list);

    expect(allSkills).toEqual(expect.arrayContaining(['Django', 'Terraform', 'GitHub Actions']));
    expect(allSkills).not.toContain('PostgreSQL');
    expect(allSkills).not.toContain('Redis');
  });

  it('builds project tech stacks from project evidence instead of JD-only tools', async () => {
    chatWithSystemMock.mockRejectedValue(
      new Error('AI proxy request failed (504): {"code":"IDLE_TIMEOUT","message":"Request idle timeout limit reached"}')
    );

    const resume: ResumeData = {
      name: 'Project Candidate',
      phone: '+91 8888888888',
      email: 'project@example.com',
      linkedin: '',
      github: '',
      summary: 'Backend engineer focused on Django services.',
      targetRole: 'Backend Engineer',
      education: [],
      workExperience: [],
      projects: [
        {
          title: 'Order Service',
          bullets: [
            'Built backend service using Django and PostgreSQL.',
            'Containerized deployment using Docker for local environments.',
          ],
          techStack: [],
        },
      ],
      skills: [],
      certifications: [],
    };

    const jd = 'Need backend experience with Django, PostgreSQL, Redis, Kafka, and Docker.';
    const gaps = [
      {
        parameterId: 20,
        parameterName: 'Project Tech Stack',
        category: 'Projects',
        currentScore: 1,
        maxScore: 5,
        percentage: 20,
        fixType: 'ai' as const,
        suggestions: ['Add project tech stack keywords: Django, PostgreSQL, Redis, Kafka, Docker'],
        priority: 'high' as const,
      },
    ];

    const result = await optimizeByParameter(resume, jd, gaps);
    const techStack = result.optimizedResume.projects?.[0]?.techStack || [];

    expect(techStack).toEqual(expect.arrayContaining(['Django', 'PostgreSQL', 'Docker']));
    expect(techStack).not.toContain('Redis');
    expect(techStack).not.toContain('Kafka');
  });
});
