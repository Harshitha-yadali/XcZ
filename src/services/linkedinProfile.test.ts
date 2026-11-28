import { describe, expect, it } from 'vitest';
import {
  applyRewrite,
  hasCustomUrl,
  normaliseRewrite,
  parseLinkedInPdfText,
  profileFromUserProfile,
  roleKeywords,
  scoreLinkedInProfile,
  unsupportedClaims,
} from './linkedinProfile';

// Synthetic export in LinkedIn's "Save to PDF" layout (sidebar first). Not a real person.
export const SAMPLE_PDF_TEXT = `Contact
testuser@example.com
www.linkedin.com/in/riya-test-
4b2a1c9 (LinkedIn)
Top Skills
Python
SQL
Microsoft Excel
Languages
English (Full Professional)
Hindi (Native or Bilingual)
Certifications
Google Data Analytics Certificate
SQL for Data Science
Riya Testname
Final year B.Tech student |
Python | SQL
Pune, Maharashtra, India
Summary
I am a final year student. I like working with data and I want to learn more.
Experience
Example Analytics Pvt Ltd
Data Analyst Intern
May 2024 - July 2024 (3 months)
Pune, Maharashtra, India
Cleaned sales data in Excel and built weekly reports.
Sample Tech Solutions
2 years 1 month
Web Developer Intern
January 2023 - March 2023 (3 months)
Made web pages.
Content Writer
June 2022 - December 2022 (7 months)
Page 1 of 2
Wrote blog posts on technology for the company website and handled
social media updates.
Education
Example Institute of Technology
Bachelor of Technology - BTech, Computer Science · (2021 - 2025)
Page 2 of 2`;

const opts = { targetRole: 'Data Analyst', level: 'student' as const };

describe('parseLinkedInPdfText', () => {
  const p = parseLinkedInPdfText(SAMPLE_PDF_TEXT);

  it('reads name, wrapped headline and location', () => {
    expect(p.name).toBe('Riya Testname');
    expect(p.headline).toBe('Final year B.Tech student | Python | SQL');
    expect(p.location).toBe('Pune, Maharashtra, India');
  });

  it('reads the sidebar and cuts the last sidebar section at the name', () => {
    expect(p.profileUrl).toBe('linkedin.com/in/riya-test-4b2a1c9');
    expect(p.skills).toEqual(['Python', 'SQL', 'Microsoft Excel']);
    expect(p.languages).toHaveLength(2);
    expect(p.certifications).toEqual(['Google Data Analytics Certificate', 'SQL for Data Science']);
  });

  it('reads experience entries, including several roles at one company', () => {
    expect(p.experience.map((e) => [e.org, e.title])).toEqual([
      ['Example Analytics Pvt Ltd', 'Data Analyst Intern'],
      ['Sample Tech Solutions', 'Web Developer Intern'],
      ['Sample Tech Solutions', 'Content Writer'],
    ]);
    expect(p.experience[0].description).toBe('Cleaned sales data in Excel and built weekly reports.');
    expect(p.experience[2].description).toMatch(/^Wrote blog posts.*social media updates\.$/);
  });

  it('reads summary and education, drops page footers', () => {
    expect(p.about).toMatch(/^I am a final year student/);
    expect(p.education).toEqual(['Example Institute of Technology', 'Bachelor of Technology - BTech, Computer Science · (2021 - 2025)']);
    expect(JSON.stringify(p)).not.toMatch(/Page \d of/);
  });

  it('finds the headline without a profile URL (main column first)', () => {
    const q = parseLinkedInPdfText('Asha Example\nSoftware Engineer | Java | Spring Boot\nBengaluru, Karnataka, India\nSummary\nBuilt things.');
    expect(q.name).toBe('Asha Example');
    expect(q.headline).toBe('Software Engineer | Java | Spring Boot');
  });
});

describe('hasCustomUrl', () => {
  it('spots the default random suffix', () => {
    expect(hasCustomUrl('linkedin.com/in/riya-test-4b2a1c9')).toBe(false);
    expect(hasCustomUrl('linkedin.com/in/riya-test-123456')).toBe(false);
    expect(hasCustomUrl('linkedin.com/in/riya-data-analyst')).toBe(true);
    expect(hasCustomUrl('')).toBe(false);
  });
});

describe('scoreLinkedInProfile', () => {
  const p = parseLinkedInPdfText(SAMPLE_PDF_TEXT);

  it('uses the curated role list for keywords', () => {
    expect(roleKeywords('Data Analyst').map((k) => k.toLowerCase())).toContain('sql');
    expect(roleKeywords('Underwater Basket Weaver')).toEqual([]);
  });

  it('scores the weak sample low and explains why', () => {
    const s = scoreLinkedInProfile(p, opts);
    expect(s.total).toBeGreaterThan(10);
    expect(s.total).toBeLessThan(45);
    const byId = Object.fromEntries(s.checks.map((c) => [c.id, c]));
    expect(byId['headline-role'].points).toBe(0);
    expect(byId['headline-keywords'].points).toBe(6); // Python, SQL
    expect(byId['about-hook'].points).toBe(0); // "I am a ..."
    expect(byId['about-length'].points).toBe(0);
    expect(byId['certifications'].points).toBe(3); // detected from the PDF
    expect(byId['customUrl'].points).toBe(0);
    expect(s.topFixes.length).toBe(5);
    expect(Object.values(s.sections).reduce((n, x) => n + x.max, 0)).toBe(100);
  });

  it('flags "Student at X" headlines', () => {
    const s = scoreLinkedInProfile({ ...p, headline: 'Student at Example Institute of Technology' }, opts);
    expect(s.checks.find((c) => c.id === 'headline-not-generic')!.points).toBe(0);
  });

  it('goes up live with the completeness ticks and the real skill count', () => {
    const before = scoreLinkedInProfile(p, opts).total;
    const after = scoreLinkedInProfile(p, { ...opts, completeness: { photo: true, banner: true, featured: true }, skillCount: 22 }).total;
    expect(after - before).toBe(5 + 3 + 4 + 9);
  });

  it('gives a strong profile a high score', () => {
    const strong = {
      ...p,
      headline: 'Data Analyst | SQL | Python | Power BI | Turning sales data into weekly business reports',
      about: `Data analyst who turns messy sales data into clear weekly reports. ${'At Example Analytics I cleaned 50,000 rows of sales data with SQL and Python, built Power BI dashboards and cut report time by 30%. '.repeat(6)}Open to Data Analyst roles - feel free to reach out.`,
      experience: p.experience.map((e) => ({ ...e, description: 'Built 4 Power BI dashboards and automated SQL reports for 3 teams, saving 5 hours a week.' })),
      skills: ['SQL', 'Python', 'Power BI', ...Array.from({ length: 18 }, (_, i) => `Skill ${i}`)],
    };
    const s = scoreLinkedInProfile(strong, { ...opts, completeness: { photo: true, banner: true, customUrl: true, openToWork: true, recommendations: true, featured: true } });
    expect(s.total).toBeGreaterThanOrEqual(95);
  });
});

describe('rewrite honesty', () => {
  const p = parseLinkedInPdfText(SAMPLE_PDF_TEXT);
  const ai = {
    headlines: ['Data Analyst | Python | SQL | Excel', 'x'.repeat(300)],
    about: 'Aspiring data analyst. Built weekly sales reports in Excel at Example Analytics. Skilled in Tableau. Improved speed by 40%.',
    experience: [{ index: 0, description: 'Cleaned sales data in Excel and built weekly reports for the sales team.' }, { index: 9, description: 'bad index' }],
    pinSkills: ['SQL', 'Python', 'Power BI'],
    addSkills: ['Data Cleaning', 'Tableau'],
    addIfYouHaveIt: ['Power BI'],
    customUrl: 'https://www.linkedin.com/in/Riya-Data-Analyst',
    bannerText: 'Data Analyst',
  };
  const r = normaliseRewrite(ai, p);

  it('keeps unproven skills out of the add list and caps lengths', () => {
    expect(r.headlines.every((h) => h.length <= 220)).toBe(true);
    expect(r.pinSkills).toEqual(['SQL', 'Python']);
    expect(r.addSkills).toEqual([]); // "Data Cleaning" is not written as such in the profile
    expect(r.addIfYouHaveIt).toEqual(['Data Cleaning', 'Tableau', 'Power BI']);
    expect(r.experience).toHaveLength(1);
    expect(r.customUrl).toBe('riya-data-analyst');
  });

  it('flags skills and numbers the profile does not support', () => {
    expect(unsupportedClaims(p, r, 'Data Analyst')).toEqual(expect.arrayContaining(['Tableau', '40%']));
  });

  it('scores the rewritten profile with the same scorer', () => {
    const after = scoreLinkedInProfile(applyRewrite(p, r), opts).total;
    expect(after).toBeGreaterThan(scoreLinkedInProfile(p, opts).total);
  });
});

describe('profileFromUserProfile', () => {
  it('maps the PrimoBoost profile', () => {
    const p = profileFromUserProfile({
      full_name: 'Test User',
      resume_headline: 'Computer science student who builds web apps.',
      experience_details: JSON.stringify([{ role: 'Intern', company: 'Example Co', year: '2024', bullets: ['Built a dashboard'] }]),
      projects_details: [{ title: 'Chat App', bullets: ['Made a chat app with React'] }],
      skills_details: [{ category: 'Tech', list: ['React', 'SQL', 'React'] }],
      certifications_details: [{ title: 'AWS Cloud Practitioner' }],
    });
    expect(p.experience.map((e) => e.org)).toEqual(['Example Co', 'Project']);
    expect(p.skills).toEqual(['React', 'SQL']);
    expect(p.headline).toBe('');
    expect(p.certifications).toEqual(['AWS Cloud Practitioner']);
  });
});

describe('mentions', () => {
  it('does not match single letters from "A/B Testing"', async () => {
    const { mentions } = await import('./linkedinProfile');
    expect(mentions('I am a student', 'A/B Testing')).toBe(false);
    expect(mentions('Ran A/B testing on emails', 'A/B Testing')).toBe(true);
    expect(mentions('Python and SQL', 'Python/R')).toBe(true);
    expect(mentions('Used Gradle', 'Maven/Gradle')).toBe(true);
  });
});

describe('profileFromExtension', () => {
  it('maps what the extension read into the profile shape and scores it', async () => {
    const { profileFromExtension } = await import('./linkedinProfile');
    const { profile, skillsTotal, truncated } = profileFromExtension({
      name: '  Riya Test ',
      headline: 'Aspiring Data Analyst | SQL | Python',
      location: 'Hyderabad, Telangana, India',
      about: 'I turn messy data into clear dashboards.\nBuilt 12 Power BI reports.',
      experience: [
        { title: 'Data Analyst Intern', org: 'Acme Analytics', dates: 'Jan 2024 - Jun 2024', description: 'Built 12 Power BI dashboards.' },
        { title: '', org: '', dates: '', description: 'orphan' },
        'not an entry',
      ],
      education: ['ABC Institute of Technology, B.Tech, 2019 - 2023', 42],
      skills: ['SQL', 'sql', 'Python', ''],
      certifications: ['Google Data Analytics'],
      profileUrl: 'linkedin.com/in/riya-test-4b2a1c9',
      skillsTotal: '25',
      truncated: ['Skills'],
      extra: '<script>',
    });
    expect(profile.name).toBe('Riya Test');
    expect(profile.about).toContain('\n');
    expect(profile.experience).toEqual([{ title: 'Data Analyst Intern', org: 'Acme Analytics', dates: 'Jan 2024 - Jun 2024', description: 'Built 12 Power BI dashboards.' }]);
    expect(profile.education).toEqual(['ABC Institute of Technology, B.Tech, 2019 - 2023']);
    expect(profile.skills).toEqual(['SQL', 'Python']);
    expect(profile.languages).toEqual([]);
    expect(profile.profileUrl).toBe('linkedin.com/in/riya-test-4b2a1c9');
    expect(skillsTotal).toBe(25);
    expect(truncated).toEqual(['Skills']);
    const score = scoreLinkedInProfile(profile, { targetRole: 'Data Analyst', level: 'fresher', skillCount: skillsTotal });
    expect(score.total).toBeGreaterThan(0);
  });

  it('survives junk input', async () => {
    const { profileFromExtension } = await import('./linkedinProfile');
    const { profile, skillsTotal } = profileFromExtension(null);
    expect(profile.headline).toBe('');
    expect(profile.experience).toEqual([]);
    expect(skillsTotal).toBe(0);
    expect(profileFromExtension({ profileUrl: 'https://evil.example/x', skillsTotal: -3 }).profile.profileUrl).toBe('');
  });
});
