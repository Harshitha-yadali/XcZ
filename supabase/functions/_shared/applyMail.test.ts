import { describe, expect, it } from 'vitest';
import { applicationFor, findCode, mailIsFrom, mailKind } from './applyMail';

describe('job mail', () => {
  it.each([
    ['Your verification code', 'Use 482913 to continue. Call 9876543210 for help.', '482913'],
    ['Security code for your application', 'Copy this code: aB3dE9xQ and paste it.', 'aB3dE9xQ'],
    ['123 456 is your verification code', '', '123456'],
    ['Application received', 'Job number 482913. Thank you for applying.', ''],
    ['Your one-time password', 'Open the app to continue.', ''],
  ])('%s -> code "%s"', (subject, body, code) => expect(findCode(subject, body)).toBe(code));

  it.each([
    ['Your application', 'Thank you for applying. If you are shortlisted we will invite you to an interview.', 'confirmed'],
    ['Your application', 'Thank you for applying. Unfortunately we are not moving forward.', 'rejected'],
    ['Next steps', 'We would like to invite you to an interview. Please pick a time.', 'interview'],
    ['Interview invitation', 'Monday 10 am.', 'interview'],
    ['Weekly jobs', 'New openings near you.', 'other'],
    ['Verify', 'Your verification code is 1234.', 'code'],
  ])('%s: %s -> %s', (subject, body, kind) => expect(mailKind(subject, body)).toBe(kind));

  it('names an application only when one company fits', () => {
    const apps = [{ id: 1, company: 'Acme Technologies Pvt Ltd' }, { id: 2, company: 'Beta Labs' }];
    const mail = (subject: string) => ({ from_address: 'no-reply@ats.example', subject, body: '' });
    expect(applicationFor(mail('Your application to Acme'), apps)?.id).toBe(1);
    expect(applicationFor(mail('Acme and Beta Labs news'), apps)).toBeNull();
    expect(applicationFor(mail('Acmeworks is hiring'), apps)).toBeNull();
  });

  it('takes a code only from the site that asked', () => {
    const from = (address: string) => ({ from_address: address, subject: '', body: '' });
    expect(mailIsFrom('boards.greenhouse.io', from('no-reply@us.greenhouse-mail.io'))).toBe(true);
    expect(mailIsFrom('acme.wd1.myworkdayjobs.com', from('acme@myworkday.com'))).toBe(true);
    expect(mailIsFrom('careers.acme.co.in', from('jobs@acme.co.in'))).toBe(true);
    expect(mailIsFrom('careers.acme.com', from('someone@evil.com'))).toBe(false);
  });
});
