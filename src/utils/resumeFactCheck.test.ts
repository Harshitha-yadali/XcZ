import { describe, expect, it } from 'vitest';
import { findUnsupportedClaims } from './resumeFactCheck';
import { ResumeData } from '../types/resume';

const original = `
ASHA VERMA
Cloud Computing Intern - AWS Academy   May 2023 - November 2023
- Supported monitoring using AWS CLI and Python scripts, cutting manual tracking by 30%.
Bachelor of Technology - Electronics & Communication Engineering   Nov 2020 - Mar 2024
Aditya Engineering College, Kakinada
Skills: Python, SQL, MySQL, AWS EC2, Linux, C++
AWS Certified Cloud Practitioner
Travel Booking System | Python, Flask, MySQL
`;

const resume = (changes: Partial<ResumeData> = {}): ResumeData => ({
  name: 'Asha Verma', phone: '', email: '', linkedin: '', github: '',
  workExperience: [{
    role: 'Cloud Computing Intern', company: 'AWS Academy', year: 'May 2023 - November 2023',
    bullets: ['Automated monitoring with Python scripts, reducing manual tracking by 30%.'],
  }],
  education: [{ degree: 'Bachelor of Technology', school: 'Aditya Engineering College', year: '2020 - 2024' }],
  projects: [{ title: 'Travel Booking System', bullets: ['Built booking flows in Flask.'] }],
  skills: [{ category: 'Languages', count: 3, list: ['Python', 'SQL', 'C++'] }],
  certifications: ['AWS Certified Cloud Practitioner'],
  ...changes,
});

describe('findUnsupportedClaims', () => {
  it('passes a resume that only rewords the original', () => {
    expect(findUnsupportedClaims(original, resume())).toEqual([]);
  });

  it('flags an employer, title and year that are not in the original', () => {
    const flags = findUnsupportedClaims(original, resume({
      workExperience: [{ role: 'Senior Cloud Engineer', company: 'Amazon', year: '2021 - 2023', bullets: [] }],
    }));
    expect(flags).toEqual(['Employer: Amazon', 'Job title: Senior Cloud Engineer', 'Year: 2021']);
  });

  it('flags a skill the job asked for that the user never listed', () => {
    const flags = findUnsupportedClaims(original, resume({
      skills: [{ category: 'Cloud', count: 3, list: ['Python', 'Kubernetes', 'Terraform'] }],
    }));
    expect(flags).toEqual(['Skill: Kubernetes', 'Skill: Terraform']);
  });

  it('flags an invented figure but keeps the user\'s own', () => {
    const flags = findUnsupportedClaims(original, resume({
      workExperience: [{
        role: 'Cloud Computing Intern', company: 'AWS Academy', year: '2023',
        bullets: ['Reduced manual tracking by 30% and cut costs by 45%, a 3x improvement.'],
      }],
    }));
    expect(flags).toEqual(['Figure: 45%', 'Figure: 3x']);
  });

  it('flags a changed degree, school and certification', () => {
    const flags = findUnsupportedClaims(original, resume({
      education: [{ degree: 'Master of Technology', school: 'IIT Bombay', year: '2024' }],
      certifications: [{ title: 'AWS Solutions Architect', description: '' }],
    }));
    expect(flags).toEqual(['School: IIT Bombay', 'Degree: Master of Technology', 'Certification: AWS Solutions Architect']);
  });

  it('does not match a short skill inside a longer word', () => {
    // "C" must not be found inside "Cloud" or "C++".
    expect(findUnsupportedClaims(original, resume({ skills: [{ category: 'x', count: 1, list: ['C'] }] }))).toEqual(['Skill: C']);
  });
});
