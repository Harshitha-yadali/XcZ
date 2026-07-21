import { describe, expect, it } from 'vitest';
import { parseResumeEvidence } from './resumeEvidenceExtractor';
import { scoreResumeAgainstJD } from './jdScoringEngine';
import type { ResumeData } from '../types/resume';

const fresherResumeText = `Ananya Rao
91 9000000000 | ananya@example.com
Graduate Software Engineer

CAREER SUMMARY
Graduate Software Engineer focused on backend development and reliable APIs.

CORE COMPETENCIES
JavaScript, nodejs, object oriented programming, Trustworthy systems, ongoing learning

ACADEMIC PROJECTS
Student Result Management System
Technologies: Python, Flask, MySQL, Postman, RESTful API
• Built a RESTful Flask backend for student result workflows and
validated endpoints using Postman.
– Designed and optimized database schemas in MySQL for reliable reporting.

ACADEMIC BACKGROUND
Bachelor of Technology in Computer Science
Sunrise College of Engineering, 2025

LICENSES AND CERTIFICATIONS
Python Fundamentals Certificate`;

const jobDescription = `Job Title: Graduate Software Engineer
Must have: Python, Flask, MySQL, and REST API.
Preferred: Docker and AWS.
Responsibilities: Build backend services and validate APIs using Postman.
Minimum qualification: Bachelor's degree in Computer Science.`;

describe('resumeEvidenceExtractor regression suite', () => {
  it('detects aliased sections, common bullets, wrapped lines, and grounded project technologies', () => {
    const evidence = parseResumeEvidence(fresherResumeText);

    expect(Object.keys(evidence.sections)).toEqual(expect.arrayContaining([
      'summary', 'skills', 'projects', 'education', 'certifications',
    ]));
    expect(evidence.bullets).toHaveLength(2);
    expect(evidence.bullets[0].text).toContain('validated endpoints using Postman');
    expect(evidence.projects[0]).toMatchObject({ title: 'Student Result Management System' });
    expect(evidence.projects[0].technologies.map(skill => skill.canonicalSkill)).toEqual(
      expect.arrayContaining(['Python', 'Flask', 'MySQL', 'Postman', 'REST API']),
    );
  });

  it('keeps every skill grounded to an exact source span and rejects substring hallucinations', () => {
    const evidence = parseResumeEvidence(fresherResumeText);
    for (const skill of evidence.skills) {
      expect(fresherResumeText.slice(skill.startIndex, skill.endIndex)).toBe(skill.sourceText);
    }

    const canonical = evidence.skills.map(skill => skill.canonicalSkill);
    expect(canonical).not.toContain('Go');
    expect(canonical).not.toContain('Rust');
  });

  it('meets the fresher scoring regression expectations with section-scoped evidence', () => {
    const evidenceDocument = parseResumeEvidence(fresherResumeText);
    const project = evidenceDocument.projects[0];
    const resume: ResumeData = {
      name: 'Ananya Rao',
      phone: '+91 9000000000',
      email: 'ananya@example.com',
      linkedin: '',
      github: '',
      targetRole: 'Graduate Software Engineer',
      summary: 'Graduate Software Engineer focused on backend development and reliable APIs.',
      education: [{ degree: 'Bachelor of Technology in Computer Science', school: 'Sunrise College of Engineering', year: '2025' }],
      workExperience: [],
      projects: [{
        title: project.title,
        techStack: project.technologies.map(skill => skill.canonicalSkill),
        bullets: project.bullets.map(bullet => bullet.text),
      }],
      skills: [{
        category: 'Technical Skills',
        count: evidenceDocument.skills.filter(skill => skill.sourceSection === 'skills').length,
        list: evidenceDocument.skills.filter(skill => skill.sourceSection === 'skills').map(skill => skill.canonicalSkill),
      }],
      certifications: ['Python Fundamentals Certificate'],
      evidenceDocument,
    };

    const result = scoreResumeAgainstJD(resume, jobDescription, 'fresher');
    const parameter = (id: number) => result.parameters.find(item => item.id === id)!;

    expect(parameter(1).score).toBe(10);
    expect(parameter(2).score).toBe(10);
    expect(parameter(3).score).toBe(10);
    expect(parameter(4).score).toBe(10);
    expect(parameter(19).score).toBeGreaterThan(0);
    expect(parameter(20).score).toBeGreaterThan(0);
    expect(parameter(17).applicable).toBe(false);
    expect(parameter(17).evidence?.join(' ')).not.toContain('College');
    expect(parameter(9).evidence).toContain('Graduate Software Engineer');
    expect(parameter(9).evidence?.join(' ')).not.toContain('College');
    expect(parameter(18).evidence?.join(' ')).not.toContain('College');
  });
});
