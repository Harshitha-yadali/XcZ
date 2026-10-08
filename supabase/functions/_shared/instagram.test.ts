import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildCaption, extractResponsibilities, jobLink, matchesKeyword, nextSlot, pickVariant, verifyMetaSignature } from './instagram.ts';

// Slots are 9:00, 13:00 and 18:00 IST = 03:30, 07:30 and 12:30 UTC.
describe('nextSlot', () => {
  it('picks the 9:00 IST slot early in the morning', () => {
    expect(nextSlot(new Date('2026-10-06T01:00:00Z'), []).toISOString()).toBe('2026-10-06T03:30:00.000Z');
  });

  it('skips a slot that is less than 45 minutes away', () => {
    expect(nextSlot(new Date('2026-10-06T03:00:00Z'), []).toISOString()).toBe('2026-10-06T07:30:00.000Z');
  });

  it('rolls over to the next day after the last slot', () => {
    expect(nextSlot(new Date('2026-10-06T13:00:00Z'), []).toISOString()).toBe('2026-10-07T03:30:00.000Z');
  });

  it('uses the IST date, not the UTC date, late in the UTC evening', () => {
    // 20:00 UTC on the 6th is already 01:30 IST on the 7th.
    expect(nextSlot(new Date('2026-10-06T20:00:00Z'), []).toISOString()).toBe('2026-10-07T03:30:00.000Z');
  });

  it('skips slots that are already taken', () => {
    const taken = ['2026-10-06T03:30:00+00:00', '2026-10-06T07:30:00+00:00'];
    expect(nextSlot(new Date('2026-10-06T01:00:00Z'), taken).toISOString()).toBe('2026-10-06T12:30:00.000Z');
  });
});

describe('matchesKeyword', () => {
  it('matches the keyword in any case, inside a sentence', () => {
    expect(matchesKeyword('LINK')).toBe(true);
    expect(matchesKeyword('link please 🙏')).toBe(true);
  });

  it('ignores other comments', () => {
    expect(matchesKeyword('nice post')).toBe(false);
    expect(matchesKeyword('linkedin?')).toBe(false);
    expect(matchesKeyword(undefined)).toBe(false);
  });
});

describe('verifyMetaSignature', () => {
  const secret = 'app-secret';
  const body = '{"object":"instagram"}';
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('accepts a correct signature', async () => {
    expect(await verifyMetaSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a tampered body, a wrong secret and a missing header', async () => {
    expect(await verifyMetaSignature(`${body} `, signature, secret)).toBe(false);
    expect(await verifyMetaSignature(body, signature, 'other-secret')).toBe(false);
    expect(await verifyMetaSignature(body, null, secret)).toBe(false);
  });
});

describe('extractResponsibilities', () => {
  it('takes the lines under the responsibilities heading and stops at the next heading', () => {
    const description = [
      'About Juspay', 'We build payment infrastructure for India.', '',
      '**Key Responsibilities:**',
      '- Design and build scalable backend services.',
      '* Write clean, tested code and take part in code reviews',
      '3. Debug production issues and improve reliability;',
      '- Mentor interns joining the team',
      'Requirements', '- B.Tech in Computer Science',
    ].join('\n');
    expect(extractResponsibilities(description)).toEqual([
      'Design and build scalable backend services',
      'Write clean, tested code and take part in code reviews',
      'Debug production issues and improve reliability',
    ]);
  });

  it('reads HTML and inline bullets, and stops before the requirements', () => {
    const html = "<h3>What you'll do</h3><ul><li>Own features from design to release</li><li>Work with product and design teams</li></ul><h3>Qualifications</h3><ul><li>Any graduate with good communication</li></ul>";
    expect(extractResponsibilities(html)).toEqual(['Own features from design to release', 'Work with product and design teams']);
  });

  it('returns nothing when there is no responsibilities heading', () => {
    expect(extractResponsibilities('A great company. We are hiring freshers for a support role in Pune.')).toEqual([]);
    expect(extractResponsibilities(null)).toEqual([]);
  });
});

describe('caption hook test', () => {
  const card = { company: 'Acme', role: 'SDE 1', salary: '6 LPA', experience: 'Fresher', location: 'Pune (Hybrid)', eligible: '2025, 2026' };

  it('leads with the company or the package depending on the variant', () => {
    expect(buildCaption(card, 'role').split('\n')[0]).toBe('Acme is hiring: SDE 1');
    expect(buildCaption(card, 'salary').split('\n')[0]).toBe('6 LPA · SDE 1 at Acme');
    expect(buildCaption(card, null)).toContain('Comment "LINK"');
  });

  it('alternates variants and keeps jobs with no package out of the test', () => {
    expect(pickVariant(card, null)).toBe('role');
    expect(pickVariant(card, 'role')).toBe('salary');
    expect(pickVariant(card, 'salary')).toBe('role');
    expect(pickVariant({ ...card, salary: 'Not disclosed' }, 'role')).toBeNull();
    expect(buildCaption({ ...card, salary: 'Not disclosed' }, null).split('\n')[0]).toBe('Acme is hiring: SDE 1');
  });

  it('tags the DM link with the source and the variant', () => {
    expect(jobLink('https://primoboostai.in', 'abc', 'salary'))
      .toBe('https://primoboostai.in/jobs/abc?utm_source=instagram&utm_medium=social&utm_campaign=job_reel&utm_content=hook_salary');
  });
});
