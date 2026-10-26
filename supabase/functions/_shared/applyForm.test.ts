import { describe, expect, it } from 'vitest';
import { applyUrl, detectPlatform, loginPageAllowed, planFill, sameSite, type FormField } from './applyForm.ts';

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

describe('applyUrl', () => {
  it('points a Lever posting at its form, once', () => {
    expect(applyUrl('https://jobs.lever.co/acme/abc')).toBe('https://jobs.lever.co/acme/abc/apply');
    expect(applyUrl('https://jobs.lever.co/acme/abc/apply')).toBe('https://jobs.lever.co/acme/abc/apply');
    expect(applyUrl('https://job-boards.greenhouse.io/acme/jobs/1')).toBe('https://job-boards.greenhouse.io/acme/jobs/1');
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

  it('accepts the employer terms with the application, without being asked', () => {
    const consent = field(0, 'I agree to the privacy policy', { type: 'checkbox' });
    expect(planFill([consent], profile, {}).fills).toHaveLength(1);
    expect(planFill([consent], profile, {}).missing).toHaveLength(0);
  });

  it('never ticks a marketing or job-alert box for the user', () => {
    const alerts = field(0, 'I agree to receive job alerts and marketing emails', { type: 'checkbox', required: true });
    expect(planFill([alerts], profile, {}).fills).toHaveLength(0);
    expect(planFill([alerts], profile, {}).missing).toHaveLength(1);
    expect(planFill([alerts], profile, { 'i agree to receive job alerts and marketing emails': 'yes' }).fills).toHaveLength(1);
  });

  it('never fills file inputs or unlabelled fields', () => {
    expect(planFill([field(0, 'Resume', { type: 'file' }), field(1, '')], profile, {})).toEqual({ fills: [], missing: [] });
  });
});
