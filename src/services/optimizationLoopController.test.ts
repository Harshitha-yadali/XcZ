import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResumeData } from '../types/resume';

const { optimizeByParameterMock } = vi.hoisted(() => ({
  optimizeByParameterMock: vi.fn(),
}));

vi.mock('./targetedParameterOptimizer', () => ({
  optimizeByParameter: optimizeByParameterMock,
}));

import { scoreResumeAgainstJD } from './jdScoringEngine';
import { runOptimizationLoop } from './optimizationLoopController';

function cloneResume(resume: ResumeData): ResumeData {
  return JSON.parse(JSON.stringify(resume)) as ResumeData;
}

describe('optimizationLoopController', () => {
  beforeEach(() => {
    optimizeByParameterMock.mockReset();
    optimizeByParameterMock.mockImplementation(async (resume: ResumeData) => ({
      optimizedResume: cloneResume(resume),
      changes: [],
      parametersFixed: [],
    }));
  });

  it('uses the baseline resume for beforeScore when the input resume is already optimized', async () => {
    const baselineResume: ResumeData = {
      name: 'Baseline Candidate',
      phone: '+91 9000000001',
      email: 'baseline@example.com',
      linkedin: '',
      github: '',
      summary: 'Software engineer.',
      targetRole: 'Backend Engineer',
      education: [],
      workExperience: [],
      projects: [],
      skills: [],
      certifications: [],
    };

    const optimizedResume: ResumeData = {
      name: 'Optimized Candidate',
      phone: '+91 9000000002',
      email: 'optimized@example.com',
      linkedin: 'https://linkedin.com/in/optimized-candidate',
      github: 'https://github.com/optimized-candidate',
      summary: 'Backend engineer building Python and Django services with PostgreSQL, Docker, AWS, Terraform, and GitHub Actions.',
      targetRole: 'Backend Engineer',
      education: [
        {
          degree: 'B.Tech in Computer Science',
          school: 'Example Institute of Technology',
          year: '2024',
        },
      ],
      workExperience: [
        {
          role: 'Software Engineer',
          company: 'Acme Tech',
          year: '2024 - Present',
          bullets: [
            'Built Django REST APIs handling 1M monthly requests with PostgreSQL and Redis.',
            'Automated AWS deployment pipelines with Terraform, Docker, and GitHub Actions.',
          ],
        },
      ],
      projects: [
        {
          title: 'Order Platform',
          bullets: [
            'Developed a Python order-processing platform with Django, PostgreSQL, and Docker.',
            'Implemented CI workflows with GitHub Actions and infrastructure modules in Terraform.',
          ],
          techStack: ['Python', 'Django', 'PostgreSQL', 'Docker', 'Terraform', 'GitHub Actions', 'AWS'],
        },
      ],
      skills: [
        { category: 'Languages', count: 1, list: ['Python'] },
        { category: 'Backend', count: 2, list: ['Django', 'REST APIs'] },
        { category: 'Databases', count: 2, list: ['PostgreSQL', 'Redis'] },
        { category: 'Cloud/DevOps', count: 3, list: ['AWS', 'Terraform', 'Docker'] },
        { category: 'Tools', count: 1, list: ['GitHub Actions'] },
      ],
      certifications: [],
    };

    const jobDescription = 'Hiring a backend engineer with Python, Django, REST APIs, PostgreSQL, Redis, Docker, Terraform, AWS, and GitHub Actions.';

    const baselineScore = scoreResumeAgainstJD(baselineResume, jobDescription);
    const optimizedScore = scoreResumeAgainstJD(optimizedResume, jobDescription);

    expect(optimizedScore.overallScore).toBeGreaterThan(baselineScore.overallScore);

    const result = await runOptimizationLoop(
      optimizedResume,
      jobDescription,
      undefined,
      baselineResume
    );

    expect(result.beforeScore.overallScore).toBe(baselineScore.overallScore);
    expect(result.afterScore.overallScore).toBe(optimizedScore.overallScore);
  });
});
