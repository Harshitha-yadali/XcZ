import { describe, expect, it } from 'vitest';
import { USER_ONLY, applyUrl, detectPlatform, leftTheJob, loginPageAllowed, planFill, sameSite, type FormField } from './applyForm.ts';
import { applicantFrom } from './applicant.ts';

const profile = {
  fullName: 'Asha Verma', email: 'asha@example.com', phone: '+91 98765 43210',
  linkedin: 'https://linkedin.com/in/asha', github: '', location: 'Bengaluru',
};
const field = (id: number, label: string, extra: Partial<FormField> = {}): FormField =>
  ({ id, label, type: 'text', required: true, options: [], ...extra });

describe('detectPlatform', () => {
  it('reads the platform from the hostname', () => {
    expect(detectPlatform('https://job-boards.greenhouse.io/gitlab/jobs/1')).toBe('greenhouse');
    expect(detectPlatform('https://jobs.lever.co/acme/abc')).toBe('lever');
    expect(detectPlatform('https://acme.wd5.myworkdayjobs.com/careers')).toBe('workday');
  });

  it('is not fooled by a platform name elsewhere in the URL', () => {
    expect(detectPlatform('https://evil.example/?next=greenhouse.io')).toBe('other');
    expect(detectPlatform('https://greenhouse.io.evil.example/jobs')).toBe('other');
    expect(detectPlatform('not a url')).toBe('other');
  });
});

describe('sameSite', () => {
  it('accepts the job link host and its subdomains only', () => {
    const job = 'https://acme.wd5.myworkdayjobs.com/careers/job/1';
    expect(sameSite('acme.wd5.myworkdayjobs.com', job)).toBe(true);
    expect(sameSite('login.myworkdayjobs.com', job)).toBe(true);
    expect(sameSite('myworkdayjobs.com.evil.example', job)).toBe(false);
    expect(sameSite('evil.example', job)).toBe(false);
    expect(sameSite('', job)).toBe(false);
  });

  it('treats a company sign-in on another name of the same site as the same site', () => {
    expect(sameSite('login.ibm.com', 'https://careers.ibm.com/en_US/careers/JobDetail?jobId=1')).toBe(true);
    expect(sameSite('www.linkedin.com', 'https://in.linkedin.com/jobs/view/1')).toBe(true);
  });

  it('does not treat two companies under a shared country suffix as one site', () => {
    expect(sameSite('login.acme.co.in', 'https://careers.acme.co.in/job/1')).toBe(true);
    expect(sameSite('evil.co.in', 'https://careers.acme.co.in/job/1')).toBe(false);
  });

  it('matches numeric addresses exactly', () => {
    expect(sameSite('127.0.0.1', 'http://127.0.0.1:8080/job')).toBe(true);
    expect(sameSite('10.0.0.1', 'http://127.0.0.1:8080/job')).toBe(false);
  });
});

describe('loginPageAllowed', () => {
  const job = 'https://careers.ibm.com/en_US/careers/JobDetail?jobId=1';

  it('allows a secure sign-in page on the job link\'s own site', () => {
    expect(loginPageAllowed('https:', 'login.ibm.com', job)).toBe(true);
  });

  it('refuses an insecure page and a page on another site', () => {
    expect(loginPageAllowed('http:', 'login.ibm.com', job)).toBe(false);
    expect(loginPageAllowed('https:', 'login.ibm.com.evil.example', job)).toBe(false);
    expect(loginPageAllowed('https:', 'accounts.example.org', job)).toBe(false);
  });

  it('allows plain HTTP only for pages on this machine, as the self-test uses', () => {
    expect(loginPageAllowed('http:', 'login.example.localhost', 'http://careers.example.localhost:8080/job')).toBe(true);
    expect(loginPageAllowed('http:', 'login.example.localhost', job)).toBe(false);
  });
});

describe('leftTheJob', () => {
  const job = 'https://careers.morningstar.com/us/en/job/REQ-054488/Data-Analyst';

  it('sees the employer sending the browser off the job', () => {
    expect(leftTheJob(job, 'https://www.morningstar.com/company/careers')).toBe(true);
    expect(leftTheJob('https://boards.greenhouse.io/acme/jobs/1234567', 'https://boards.greenhouse.io/acme?error=true')).toBe(true);
  });

  it('stays quiet while the job is still in the address', () => {
    expect(leftTheJob(job, `${job}?locale=en`)).toBe(false);
    expect(leftTheJob(job, 'https://careers.morningstar.com/apply/REQ-054488')).toBe(false);
    expect(leftTheJob('https://jobs.lever.co/meesho/1de2fc88-e203-4f1a-8046-55df700de4be/', 'https://jobs.lever.co/meesho/1de2fc88-e203-4f1a-8046-55df700de4be/apply')).toBe(false);
  });

  it('leaves a move to a hiring system on another site alone', () => {
    expect(leftTheJob('https://www.hitachienergy.com/careers/open-jobs/details/JID3-177265', 'https://hitachi.wd1.myworkdayjobs.com/en-US/careers/job/Bengaluru/Engineer_R0001')).toBe(false);
  });

  it('has nothing to say about a link with no job number in it, or after a tracking number', () => {
    expect(leftTheJob('https://careers.example.com/software-engineer', 'https://careers.example.com/')).toBe(false);
    expect(leftTheJob('https://careers.example.com/jobs/dev?utm_id=123456', 'https://careers.example.com/jobs/dev')).toBe(false);
    expect(leftTheJob('not a link', 'https://careers.example.com/')).toBe(false);
  });
});

describe('USER_ONLY', () => {
  it('keeps from the model what only the applicant can answer', () => {
    for (const label of [
      'Willing To Relocate', 'Are you open to relocation?', 'Are you willing to undergo a background check?',
      'Sexual orientation', 'Pronouns', 'Nationality', 'Have you ever been arrested?', 'Any felony record?',
      'Notice period', 'Are you serving notice?', 'How soon can you join?', 'Immediate joiner?',
      'Expected package (LPA)', 'Current stipend', 'Expected CTC', 'Do you have any active backlogs?',
      'Number of arrears', 'Any gap in education?', 'Category (General/OBC/SC/ST)', 'Reservation category',
      'PwD candidate?', 'Are you an ex-serviceman?', 'PAN number', 'Aadhaar number', 'Passport number',
      "Father's name", 'Are you willing to sign a 2 year bond?', 'Willing to work night shifts?',
      'Willing to work from office 5 days?', 'Do you own a laptop?', 'Do you have a two wheeler?',
      'Have you applied to this company in the last 6 months?', 'Do you have relatives working here?',
    ]) expect(label).toMatch(USER_ONLY);
  });

  it('still lets through what a resume says', () => {
    for (const label of [
      'Passing Degree', 'Name of the Engineering College', 'Total years of experience', 'Experience (Years)',
      'Current company', 'Graduation year', 'Undergraduate Degree', 'Skills', 'CGPA', 'Percentage', 'Branch', 'Current location',
    ]) expect(label).not.toMatch(USER_ONLY);
  });
});

describe('applyUrl', () => {
  it('points a Lever posting at its form, once', () => {
    expect(applyUrl('https://jobs.lever.co/acme/abc')).toBe('https://jobs.lever.co/acme/abc/apply');
    expect(applyUrl('https://jobs.lever.co/acme/abc/apply')).toBe('https://jobs.lever.co/acme/abc/apply');
    expect(applyUrl('https://job-boards.greenhouse.io/acme/jobs/1')).toBe('https://job-boards.greenhouse.io/acme/jobs/1');
  });
});

describe('employment answers from the resume', () => {
  it('reads the latest job, its dates, country and career stage', () => {
    const applicant = applicantFrom(
      { full_name: 'Asha Verma', phone: '+91 98765 43210' },
      {
        workExperience: [{ role: 'Full Stack Developer Intern', company: 'TechNova Solutions', year: 'Jan 2024 – Apr 2024' }],
        education: [{ degree: 'B.Tech', school: 'Ashoka', year: '2021 - 2025' }],
      },
    );
    const { fills, missing } = planFill([
      field(0, 'Company name'), field(1, 'Title'),
      field(2, 'Start date month', { type: 'combobox', options: ['January', 'February', 'March', 'April'] }),
      field(3, 'Start date year'),
      field(4, 'End date month', { type: 'combobox', options: ['January', 'February', 'March', 'April'] }),
      field(5, 'End date year'),
      field(6, 'Total Years of Experience'),
      field(7, 'Current Career Stage', { type: 'combobox', options: ['Experienced Professional', 'College Grads / Fresher', 'Student / College Intern'] }),
      field(8, 'Country', { type: 'combobox', options: ['United States +1', 'India +91'] }),
    ], applicant, {});
    expect(missing).toEqual([]);
    expect(fills.map((fill) => fill.value)).toEqual([
      'TechNova Solutions', 'Full Stack Developer Intern', 'January', '2024', 'April', '2024', '0', 'College Grads / Fresher', 'India +91',
    ]);
  });

  it('drops the dial code from the phone when a country picker carries it', () => {
    const applicant = applicantFrom({ full_name: 'Asha Verma', phone: '+918143601428' }, {});
    const { fills } = planFill([
      field(0, 'Country', { type: 'combobox', options: ['United States +1', 'British Indian Ocean Territory +246', 'India +91'] }), field(1, 'Phone'),
    ], applicant, {});
    expect(fills.map((fill) => fill.value)).toEqual(['India +91', '8143601428']);
  });

  it('drops +91 from the phone even when the country list had not loaded', () => {
    const applicant = applicantFrom({ full_name: 'Asha Verma', phone: '+918143601428' }, {});
    const { fills } = planFill([field(0, 'Country', { type: 'combobox' }), field(1, 'Phone')], applicant, {});
    expect(fills.map((fill) => fill.value)).toEqual(['India', '8143601428']);
  });

  it('answers scores and subject by level, and never a CGPA for a percentage', () => {
    const applicant = applicantFrom({ full_name: 'Asha Verma' }, {
      education: [
        { degree: 'Bachelor of Technology in Computer Science', school: 'Ashoka College', year: '2021 - 2025', cgpa: '8.13' },
        { degree: 'MPC', school: 'Sri Chaitanya junior College', year: '2019 - 2021', cgpa: '9.80' },
        { degree: 'Secondary School Certificate', school: 'Sri Vidyanikethan High School', year: '2018 - 2019', cgpa: '9.70' },
      ],
    });
    const { fills, missing } = planFill([
      field(0, '10th CGPA (out of 10)'), field(1, '12th CGPA (out of 10)'), field(2, 'B.Tech CGPA (out of 10)'),
      field(3, 'B.Tech Specialization'), field(4, 'University Name'), field(5, '12th Percentage'),
      field(6, 'M.Tech CGPA (out of 10) if applicable'),
    ], applicant, {});
    expect(fills.map((fill) => fill.value)).toEqual(['9.70', '9.80', '8.13', 'Computer Science', 'Ashoka College']);
    expect(missing.map((question) => question.label)).toEqual(['12th Percentage', 'M.Tech CGPA (out of 10) if applicable']);
  });

  it('still asks when a bare start date means joining', () => {
    const applicant = applicantFrom({ full_name: 'Asha Verma' }, { workExperience: [{ role: 'Intern', company: 'X', year: 'Jan 2024 - Apr 2024' }] });
    expect(planFill([field(0, 'Start date')], applicant, {}).missing).toHaveLength(1);
  });
});

describe('planFill', () => {
  it('fills contact fields from the profile', () => {
    const { fills, missing } = planFill(
      [field(0, 'First Name'), field(1, 'Last Name'), field(2, 'Email'), field(3, 'Phone'), field(4, 'LinkedIn Profile'), field(5, 'Current location')],
      profile, {},
    );
    expect(missing).toEqual([]);
    expect(fills.map((fill) => fill.value)).toEqual(['Asha', 'Verma', 'asha@example.com', '+91 98765 43210', 'https://linkedin.com/in/asha', 'Bengaluru']);
  });

  it('asks instead of guessing when a question only mentions a profile word', () => {
    const { fills, missing } = planFill(
      [field(0, 'Are you willing to relocate to our London location for this role?')], profile, {},
    );
    expect(fills).toEqual([]);
    expect(missing).toHaveLength(1);
  });

  it('never puts the applicant in a field about someone else, or a wish in place of a fact', () => {
    const { fills, missing } = planFill(
      [field(0, "Father's Name"), field(1, 'Reference Email'), field(2, 'Emergency Contact Number'), field(3, 'Preferred Location'), field(4, 'Home City and State')],
      profile, {},
    );
    expect(fills).toEqual([]);
    expect(missing).toHaveLength(5);
  });

  it('asks for required fields it cannot answer and skips optional ones', () => {
    const { fills, missing } = planFill(
      [field(0, 'GitHub URL'), field(1, 'Notice period'), field(2, 'Pronouns', { required: false })], profile, {},
    );
    expect(fills).toEqual([]);
    expect(missing.map((question) => question.label)).toEqual(['GitHub URL', 'Notice period']);
  });

  it('uses a saved answer only when it is one of the offered options', () => {
    const question = field(0, 'Do you need visa sponsorship?', { type: 'select', options: ['Yes', 'No'] });
    expect(planFill([question], profile, { 'do you need visa sponsorship': 'no' }).fills[0].value).toBe('No');
    expect(planFill([question], profile, { 'do you need visa sponsorship': 'Maybe' }).missing).toHaveLength(1);
  });

  it('keeps every chosen option of a checkbox group', () => {
    const question = field(0, 'Languages', { type: 'checks', options: ['English (ENG)', 'Hindi (HIN)', 'French (FRA)'] });
    const { fills } = planFill([question], profile, { languages: 'English (ENG) | Hindi (HIN) | Klingon' });
    expect(fills[0].value).toBe('English (ENG) | Hindi (HIN)');
  });

  it('pauses for a required acknowledgement the user has not authorised', () => {
    const consent = field(0, 'I agree to the privacy policy', { type: 'checkbox', required: true });
    expect(planFill([consent], profile, {}).fills).toHaveLength(0);
    expect(planFill([consent], profile, {}).missing).toHaveLength(1);
  });

  it('ticks an acknowledgement only once the user authorised that exact box', () => {
    const consent = field(0, 'I agree to the privacy policy', { type: 'checkbox', required: true });
    expect(planFill([consent], profile, { 'i agree to the privacy policy': 'yes' }).fills).toHaveLength(1);
    // Authorising one box says nothing about another.
    const other = field(0, 'I confirm I hold a valid work permit', { type: 'checkbox', required: true });
    expect(planFill([other], profile, { 'i agree to the privacy policy': 'yes' }).missing).toHaveLength(1);
  });

  it('leaves an optional marketing opt-in alone instead of pausing for it', () => {
    const alerts = field(0, 'Send me job alerts and marketing emails', { type: 'checkbox', required: false });
    expect(planFill([alerts], profile, {}).fills).toHaveLength(0);
    expect(planFill([alerts], profile, {}).missing).toHaveLength(0);
    expect(planFill([alerts], profile, { 'send me job alerts and marketing emails': 'yes' }).fills).toHaveLength(1);
  });

  it('uses the answers given at turn-on for differently worded forms', () => {
    const upfront = { '@notice_period': '30 days', '@expected_ctc': '6 LPA', '@relocate': 'Yes', '@gender': 'Female' };
    const { fills, missing } = planFill(
      [
        field(0, 'Notice Period (in days)'),
        field(1, 'Expected CTC'),
        field(2, 'Are you willing to relocate?', { type: 'select', options: ['Yes', 'No'] }),
        field(3, 'Gender *', { type: 'select', options: ['Male', 'Female', 'Other'] }),
      ],
      profile, upfront,
    );
    expect(missing).toEqual([]);
    expect(fills.map((fill) => fill.value)).toEqual(['30 days', '6 LPA', 'Yes', 'Female']);
  });

  it('still asks when a question goes beyond what was answered at turn-on', () => {
    const upfront = { '@relocate': 'Yes', '@cgpa': '8.2', '@current_ctc': '0', '@expected_ctc': '6 LPA' };
    const { fills, missing } = planFill(
      [
        field(0, 'Are you willing to relocate to Dubai?'),
        field(1, '12th percentage'),
        field(2, "Spouse's current salary"),
        // Two topics in one label: neither answer fits on its own.
        field(3, 'Current CTC and expected CTC'),
        field(4, 'Gender identity', { type: 'select', options: ['Woman', 'Man'] }),
      ],
      profile, upfront,
    );
    expect(fills).toEqual([]);
    expect(missing).toHaveLength(5);
  });

  it('asks when the turn-on answer is not one of the offered options', () => {
    const question = field(0, 'Gender', { type: 'select', options: ['Man', 'Woman', 'Decline to self-identify'] });
    expect(planFill([question], profile, { '@gender': 'Prefer not to say' }).missing).toHaveLength(1);
  });

  it('never fills file inputs or unlabelled fields', () => {
    expect(planFill([field(0, 'Resume', { type: 'file' }), field(1, '')], profile, {})).toEqual({ fills: [], missing: [] });
  });
});
