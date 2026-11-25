import { describe, expect, it } from 'vitest';
import type { ResumeData } from '../types/resume';
import { buildEvidenceReport } from './evidenceReport';

const submitted: ResumeData = {
  name: 'Asha Rao', phone: '', email: '', linkedin: '', github: '',
  summary: 'Backend developer with Node.js experience.',
  education: [], certifications: [], skills: [],
  workExperience: [
    { role: 'Intern', company: 'Acme', year: '2024', bullets: ['Worked on Node.js APIs for the billing team.', 'Wrote unit tests for payments.'] },
    { role: 'Intern', company: 'Beta', year: '2023', bullets: ['Maintained React dashboards for the support desk.'] },
  ],
  projects: [{ title: 'Task App', bullets: ['Made a task board in React.'] }],
};

const acme = (bullets: string[]): ResumeData => ({
  ...submitted,
  workExperience: [{ role: 'Intern', company: 'Acme', year: '2024', bullets }],
});
const jobLines = (resume: ResumeData) => buildEvidenceReport(submitted, resume).filter((line) => line.id.startsWith('job'));

describe('buildEvidenceReport', () => {
  it('marks an untouched resume as kept throughout', () => {
    expect(buildEvidenceReport(submitted, submitted).every((line) => line.status === 'kept')).toBe(true);
  });

  it('pairs a rewritten line with the line it came from, wherever it moved', () => {
    const [line] = jobLines(acme(['Developed unit tests covering payments.', 'Built Node.js APIs supporting the billing team.']));
    expect(line.status).toBe('rewritten');
    expect(line.original).toBe('Wrote unit tests for payments.');
  });

  it('asks the user to check a claim, or a line from nowhere', () => {
    const [invented, unrelated] = jobLines(acme([
      'Built Node.js APIs for the billing team, cutting latency by 40%.',
      'Mentored junior colleagues across regions.',
    ]));
    expect(invented.status).toBe('check');
    expect(invented.claims.join()).toContain('40%');
    expect(unrelated.status).toBe('check');
    expect(unrelated.original).toBeUndefined();
  });

  it('does not accept another employer\'s line as the source', () => {
    expect(jobLines(acme(['Maintained React dashboards for the support desk.']))[0].status).toBe('check');
  });

  it('replaces only the line it describes', () => {
    const resume = acme(['Developed unit tests covering payments.', 'Built Node.js APIs supporting the billing team.']);
    const restored = jobLines(resume)[0].replace(resume, 'Wrote unit tests for payments.');
    expect(restored.workExperience[0].bullets).toEqual(['Wrote unit tests for payments.', resume.workExperience[0].bullets[1]]);
    expect(jobLines(restored)[0].status).toBe('kept');
    expect(resume.workExperience[0].bullets[0]).toBe('Developed unit tests covering payments.');
  });
});
