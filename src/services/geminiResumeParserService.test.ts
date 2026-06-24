import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chatWithSystemMock } = vi.hoisted(() => ({
  chatWithSystemMock: vi.fn(),
}));

vi.mock('./aiProxyService', () => ({
  openrouter: {
    chatWithSystem: chatWithSystemMock,
  },
}));

import { parseResumeFromFile } from './geminiResumeParserService';

const sampleResumeText = `Alice Smith
alice@example.com
+91 9876543210
linkedin.com/in/alicesmith
github.com/alicesmith

SUMMARY
Frontend engineer with 3 years of experience building React and TypeScript applications for high-traffic products.

SKILLS
React, TypeScript, JavaScript, Node.js, PostgreSQL, Docker

WORK EXPERIENCE
Software Engineer | Acme Corp | 2022 - Present
- Built React dashboards used by internal operations teams.
- Improved API response time by 35% by optimizing Node.js services.

PROJECTS
Resume Optimizer
- Developed a resume analysis tool using React and TypeScript.
- Added PDF parsing and scoring workflows for job seekers.

EDUCATION
Bachelor of Technology in Computer Science
Sunrise Institute of Technology
2022
`;

describe('geminiResumeParserService', () => {
  beforeEach(() => {
    chatWithSystemMock.mockReset();
  });

  const createTextResumeFile = () =>
    ({
      name: 'resume.txt',
      type: 'text/plain',
      text: vi.fn().mockResolvedValue(sampleResumeText),
    }) as unknown as File;

  it('uses AI structured output when the proxy succeeds', async () => {
    chatWithSystemMock.mockResolvedValue(
      JSON.stringify({
        name: 'Alice Smith',
        title: 'Frontend Engineer',
        contact: {
          email: 'alice@example.com',
          phone: '+91 9876543210',
          location: 'Hyderabad',
          linkedin: 'linkedin.com/in/alicesmith',
          github: 'github.com/alicesmith',
        },
        summary: 'Frontend engineer with React expertise.',
        skills: ['React', 'TypeScript'],
        experience: [
          {
            company: 'Acme Corp',
            role: 'Software Engineer',
            duration: '2022 - Present',
            bullets: ['Built React dashboards used by internal operations teams.'],
          },
        ],
        projects: [
          {
            name: 'Resume Optimizer',
            tech_stack: ['React', 'TypeScript'],
            bullets: ['Developed a resume analysis tool using React and TypeScript.'],
          },
        ],
        education: [
          {
            degree: 'Bachelor of Technology in Computer Science',
            institution: 'Sunrise Institute of Technology',
            year: '2022',
            cgpa: '',
            location: '',
          },
        ],
        certifications: [],
      })
    );

    const parsed = await parseResumeFromFile(createTextResumeFile());

    expect(parsed.origin).toBe('gemini_parsed');
    expect(parsed.name).toBe('Alice Smith');
    expect(parsed.email).toBe('alice@example.com');
    expect(parsed.workExperience).toHaveLength(1);
    expect(parsed.projects).toHaveLength(1);
  });

  it('falls back to heuristic parsing when the AI proxy fails', async () => {
    chatWithSystemMock.mockRejectedValue(
      new Error(
        'AI proxy request failed (546): {"code":"WORKER_RESOURCE_LIMIT","message":"Function failed due to not having enough compute resources"}'
      )
    );

    const parsed = await parseResumeFromFile(createTextResumeFile());

    expect(parsed.origin).toBe('heuristic_parsed');
    expect(parsed.name).toBe('Alice Smith');
    expect(parsed.email).toBe('alice@example.com');
    expect(parsed.skills.some((category) => category.list.includes('React'))).toBe(true);
    expect(parsed.workExperience).toHaveLength(1);
    expect(parsed.rawResponse?.fallback).toBe('heuristic');
  });
});
