// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { ResumeData } from '../types/resume';
import { toPdfText } from './pdfText';
import { buildInterviewPackDocx, buildResumeDocx } from './resumeDocx';

const resume: ResumeData = {
  name: 'Asha Rao', phone: '+91 90000 00000', email: 'asha@example.com', location: 'Hyderabad',
  linkedin: 'https://www.linkedin.com/in/asharao/', github: '', careerObjective: 'Backend role.',
  education: [{ degree: 'B.Tech', school: 'Example College', year: '2024' }],
  workExperience: [{ role: 'Intern', company: 'Acme & Sons', year: '2024', bullets: ['Cut cost by ₹2,00,000 <fast>.'] }],
  projects: [], skills: [{ category: 'Languages', count: 1, list: ['C++'] }],
  certifications: ['AWS Cloud Practitioner'], achievements: ['తెలుగు prize'],
};

describe('resume export', () => {
  it('keeps every PDF character inside the font, so a line is never re-encoded', () => {
    expect(toPdfText('Saved ₹2,00,000 – “fast” C++ → Python • naïve')).toBe('Saved Rs. 2,00,000 - "fast" C++ -> Python • naïve');
    expect(toPdfText('Ravi Śarmā ✓ 中')).toBe('Ravi Sarma  ');
    expect([...toPdfText('₹→≥’—…™€● ​🚀')].every((char) => char === '•' || char.charCodeAt(0) <= 0xff)).toBe(true);
  });

  it('writes a real Word file with headings, bullets, full links and no tables', () => {
    const files = unzipSync(buildResumeDocx(resume, 'fresher'));
    const body = strFromU8(files['word/document.xml']);
    const text = body.replace(/<[^>]+>/g, '\n');

    expect(Object.keys(files)).toContain('[Content_Types].xml');
    expect(text).toContain('linkedin.com/in/asharao');
    expect(text).toContain('Hyderabad | +91 90000 00000 | asha@example.com');
    expect(text).toContain('Intern | Acme &amp; Sons');
    expect(text).toContain('Cut cost by ₹2,00,000 &lt;fast&gt;.');
    expect(text).toContain('తెలుగు prize');
    expect(body).not.toContain('<w:tbl>');
    expect(body.indexOf('SKILLS')).toBeLessThan(body.indexOf('WORK EXPERIENCE'));
  });

  it('writes the interview pack as a Word file', () => {
    const body = strFromU8(unzipSync(buildInterviewPackDocx([{ question: 'Why <us>?', answer: '' }], 'Dear Team,\n\nHello.'))['word/document.xml']);
    expect(body).toContain('1. Why &lt;us&gt;?');
    expect(body).toContain('does not show this');
    expect(body).toContain('Hello.');
  });
});
