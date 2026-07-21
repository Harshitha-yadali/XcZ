import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { findRequiredMissingSections } from './resumeMissingSections';

const baseResume = (overrides: Partial<ResumeData> = {}): ResumeData => ({
  name: 'Asha Sharma',
  phone: '',
  email: 'asha@example.com',
  linkedin: '',
  github: '',
  education: [{ degree: 'B.Tech', school: 'City University', year: '' }],
  workExperience: [],
  projects: [],
  skills: [{ category: 'Engineering', count: 2, list: ['React', 'TypeScript'] }],
  certifications: [],
  ...overrides,
});

describe('findRequiredMissingSections', () => {
  it('does not require optional projects, certifications, social links, or dates', () => {
    expect(findRequiredMissingSections(baseResume(), 'fresher')).toEqual([]);
  });

  it('accepts a partially parsed experience when useful content exists', () => {
    const resume = baseResume({
      workExperience: [{ role: 'Software Engineer', company: '', year: '', bullets: [] }],
    });
    expect(findRequiredMissingSections(resume, 'experienced')).toEqual([]);
  });

  it('uses saved profile contact information when the resume omits it', () => {
    const resume = baseResume({ name: '', email: '', phone: '' });
    expect(findRequiredMissingSections(resume, 'fresher', {
      name: 'Asha Sharma',
      phone: '+91 98765 43210',
    })).toEqual([]);
  });

  it('asks only for genuinely required information', () => {
    const resume = baseResume({
      name: '',
      email: '',
      education: [],
      skills: [],
    });
    expect(findRequiredMissingSections(resume, 'student')).toEqual([
      'skills',
      'education',
      'contactDetails:Name',
      'contactDetails',
    ]);
  });
});

