import { describe, expect, it } from 'vitest';
import { marketingHtml, marketingSubject, unsubscribeToken, type MarketingJob } from './marketingEmail';

const jobs: MarketingJob[] = [
  { id: 'a1', company_name: 'Razorpay', role_title: 'Frontend Engineer', location_city: 'Bengaluru', package_amount: 1200000, apply_check: 'works' },
  { id: 'b2', company_name: 'TCS', role_title: 'Graduate Trainee <script>', experience_required: '0-1 years' },
  { id: 'c3', company_name: 'Infosys', role_title: 'Systems Engineer' },
];

describe('marketing email', () => {
  it('rotates the subject every day and uses the first name', () => {
    const week = Array.from({ length: 7 }, (_, d) => marketingSubject(jobs, 'Ravi Kumar', d));
    expect(new Set(week).size).toBe(7);
    expect(marketingSubject(jobs, 'Ravi Kumar', 1)).toBe('Ravi, Razorpay is hiring. Apply in 1 click ⚡');
    expect(marketingSubject(jobs, '', 1)).toMatch(/^there, /);
  });

  it('escapes job text, links each job and carries the unsubscribe link', () => {
    const html = marketingHtml({ jobs, name: 'Ravi', unsubscribeUrl: 'https://primoboostai.in/unsubscribe?u=x&t=y', dayIndex: 0 });
    expect(html).not.toContain('<script>');
    expect(html).toContain('Graduate Trainee &lt;script&gt;');
    expect(html).toContain('https://primoboostai.in/jobs/a1?utm_source=email');
    expect(html).toContain('₹12 LPA');
    const small = marketingHtml({ jobs: [{ ...jobs[0], package_amount: 80000 }, { ...jobs[1], package_amount: 6 }], name: '', unsubscribeUrl: '', dayIndex: 0 });
    expect(small).toContain('₹80,000');
    expect(small).not.toContain('80000 LPA');
    expect(small).toContain('₹6 LPA');
    expect(html).toContain('AUTO APPLY READY');
    expect(html).toContain('unsubscribe?u=x&amp;t=y');
  });

  it('makes a stable token per user that differs by user and key', async () => {
    const t = await unsubscribeToken('11111111-1111-1111-1111-111111111111', 'k1');
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(await unsubscribeToken('11111111-1111-1111-1111-111111111111', 'k1')).toBe(t);
    expect(await unsubscribeToken('22222222-2222-2222-2222-222222222222', 'k1')).not.toBe(t);
    expect(await unsubscribeToken('11111111-1111-1111-1111-111111111111', 'k2')).not.toBe(t);
  });
});
