import type { ApplicantProfile } from './applyForm.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The applicant as a form sees them: their profile, plus what only the tailored resume says. */
export function applicantFrom(profile: any, content: any): ApplicantProfile {
  const schooling = Array.isArray(content?.education) ? content.education : [];
  const text = (entry: any) => `${entry?.degree || ''} ${entry?.school || ''}`;
  const twelfth = schooling.find((entry: any) => /intermediate|12th|xii|hsc|higher secondary|senior secondary|\bmpc\b|\bbipc\b|\bpuc\b|junior college/i.test(text(entry)));
  const tenth = schooling.find((entry: any) => entry !== twelfth && /\bssc\b|sslc|10th|matric|secondary school|high school/i.test(text(entry)));
  // The degree is whatever is neither school; resumes list it first.
  const education = schooling.find((entry: any) => entry !== twelfth && entry !== tenth) || null;
  // Whole skill names only, short enough for a typical 100-character box.
  const skills: string[] = [];
  for (const name of (Array.isArray(content?.skills) ? content.skills : []).flatMap((group: any) => group?.list || [])) {
    if ([...skills, name].join(', ').length > 100) break;
    skills.push(String(name));
  }
  const jobs = Array.isArray(content?.workExperience) ? content.workExperience : [];
  const latest = jobs[0];
  // "Jan 2024 – Apr 2024" or "June 2024 - Present".
  const [start = '', end = ''] = String(latest?.year || '').split(/\s*[–—-]\s*|\s+to\s+/i);
  const month = (part: string) => MONTHS.find((name) => part.toLowerCase().startsWith(name.slice(0, 3).toLowerCase())) || '';
  const year = (part: string) => part.match(/\d{4}/)?.[0] || '';
  const graduationYear = (String(education?.year || '').match(/\d{4}/g) || []).pop() || '';
  const phone = String(profile?.phone || '').replace(/[\s-]/g, '');
  return {
    company: latest?.company || '',
    title: latest?.role || '',
    startMonth: month(start),
    startYear: year(start),
    endMonth: month(end),
    endYear: year(end),
    yearsExperience: jobs.length && jobs.every((job: any) => /intern|trainee|apprentice/i.test(job?.role || '')) ? '0' : '',
    careerStage: graduationYear ? (Number(graduationYear) > new Date().getFullYear() ? 'Student' : 'Fresher') : '',
    // ponytail: only India from the dial code; add others as users from elsewhere arrive.
    country: /^(\+91|0091)\d{10}$/.test(phone) ? 'India' : '',
    tenthScore: String(tenth?.cgpa || '').trim(),
    twelfthScore: String(twelfth?.cgpa || '').trim(),
    degreeScore: String(education?.cgpa || '').trim(),
    // "Bachelor of Technology in Computer Science" -> "Computer Science".
    specialization: (String(education?.degree || '').match(/\b(?:in|of)\s+([A-Za-z&,. ]+)$/i)?.[1] || '').replace(/^technology\s+in\s+/i, '').trim(),
    fullName: profile?.full_name || '',
    email: profile?.email_address || '',
    phone: profile?.phone || '',
    linkedin: profile?.linkedin_profile_url || '',
    github: profile?.github_profile_url || '',
    location: profile?.current_location || content?.location || '',
    college: education?.school || '',
    degree: education?.degree || '',
    graduationYear,
    skills: skills.join(', '),
  };
}
