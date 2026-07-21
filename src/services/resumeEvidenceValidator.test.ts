import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { validateAndRepairResume } from './resumeEvidenceValidator';

const evidence: ResumeData = {
  name: 'Asha Rao',
  phone: '9000000000',
  email: 'asha@example.com',
  linkedin: '',
  github: '',
  summary: 'Backend developer.',
  education: [{ degree: 'B.Tech', school: 'Example College', year: '2024' }],
  workExperience: [{
    role: 'Developer Intern',
    company: 'Acme',
    year: '2024',
    bullets: ['Built Node.js APIs for an internal application.'],
  }],
  projects: [{ title: 'Task App', bullets: ['Built task workflows with React.'], techStack: ['React'] }],
  skills: [{ category: 'Technologies', count: 2, list: ['React', 'Node.js'] }],
  certifications: ['AWS Fundamentals'],
};

describe('resumeEvidenceValidator', () => {
  it('preserves rewrites while restoring unsupported facts and numeric claims', () => {
    const candidate: ResumeData = {
      ...JSON.parse(JSON.stringify(evidence)),
      name: 'Different Name',
      workExperience: [{
        role: 'Senior Engineer',
        company: 'Different Company',
        year: '2020 - 2025',
        bullets: ['Scaled Node.js APIs to 50,000 users.'],
      }],
      projects: [
        { title: 'Renamed Project', bullets: ['Improved React workflow clarity.'], techStack: ['React', 'Kubernetes'] },
        { title: 'Invented Project', bullets: ['Built an AI platform.'] },
      ],
      skills: [{ category: 'Technologies', count: 3, list: ['React', 'Node.js', 'Kubernetes'] }],
      certifications: ['Invented Certification'],
    };

    const result = validateAndRepairResume(evidence, candidate);

    expect(result.resume.name).toBe('Asha Rao');
    expect(result.resume.workExperience[0].role).toBe('Developer Intern');
    expect(result.resume.workExperience[0].bullets).toEqual(evidence.workExperience[0].bullets);
    expect(result.resume.projects).toHaveLength(1);
    expect(result.resume.projects[0].title).toBe('Task App');
    expect(result.resume.projects[0].bullets).toEqual(['Improved React workflow clarity.']);
    expect(result.resume.projects[0].techStack).toEqual(['React']);
    expect(result.resume.skills[0].list).toEqual(['React', 'Node.js']);
    expect(result.resume.certifications).toEqual(['AWS Fundamentals']);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('never adds projects when the evidence resume has none', () => {
    const noProjects = { ...evidence, projects: [] };
    const candidate = { ...noProjects, projects: [{ title: 'Generated', bullets: ['Generated project.'] }] };
    const result = validateAndRepairResume(noProjects, candidate);

    expect(result.resume.projects).toEqual([]);
    expect(result.violations.some((item) => item.section === 'projects')).toBe(true);
  });
});
