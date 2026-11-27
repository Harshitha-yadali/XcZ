import { describe, expect, it } from 'vitest';
import { findTwin, isJobClosed, postingKey } from './jobCheck.ts';

/** Answers every request the same way and notes where it went. */
const answering = (status: number, body: unknown = {}) => {
  const asked: string[] = [];
  const request = (async (url: string) => {
    asked.push(url);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { asked, request };
};

describe('postingKey', () => {
  it('sees one job through tracking, case, slashes and http', () => {
    const plain = postingKey('https://jobs.lever.co/meesho/1de2', 'Trainee');
    expect(postingKey('https://jobs.lever.co/meesho/1de2/', 'Trainee')).toBe(plain);
    expect(postingKey('https://jobs.lever.co/meesho/1de2?utm_source=x&gh_src=y', 'Trainee')).toBe(plain);
    expect(postingKey('http://www.JOBS.lever.co/meesho/1de2', '  trainee ')).toBe(plain);
  });

  it('keeps apart what only looks alike', () => {
    expect(postingKey('https://a.com/jobs?id=1', 'Dev')).not.toBe(postingKey('https://a.com/jobs?id=2', 'Dev'));
    expect(postingKey('https://a.com/#/jobprofiles/1', 'Dev')).not.toBe(postingKey('https://a.com/#/jobprofiles/2', 'Dev'));
    // One careers link shared by different roles is not one job.
    expect(postingKey('https://careers.swiggy.com', 'SDE')).not.toBe(postingKey('https://careers.swiggy.com', 'Analyst'));
  });

  it('has no key for what is not a link', () => {
    expect(postingKey('N/A', 'Dev')).toBe('');
    expect(postingKey('mailto:jobs@a.com', 'Dev')).toBe('');
  });
});

describe('findTwin', () => {
  const rows = (data: unknown[]) => {
    const chain: any = { select: () => chain, eq: () => chain, neq: () => chain, then: (done: any) => done({ data }) };
    return { from: () => chain };
  };
  const job = { id: 'b', application_link: 'https://jobs.lever.co/meesho/1de2?utm_source=x', role_title: 'Trainee' };

  it('finds the same job under another listing', async () => {
    const live = { id: 'a1', status: 'submitted', application_url: 'https://jobs.lever.co/meesho/1de2', job_listings: { role_title: 'Trainee' } };
    expect(await findTwin(rows([live]), 'user', job)).toEqual({ id: 'a1', status: 'submitted' });
  });

  it('leaves a different role on the same link alone', async () => {
    const other = { id: 'a1', status: 'queued', application_url: 'https://jobs.lever.co/meesho/1de2', job_listings: { role_title: 'Analyst' } };
    expect(await findTwin(rows([other]), 'user', job)).toBeNull();
  });

  it('never matches on a link it cannot read', async () => {
    const other = { id: 'a1', status: 'queued', application_url: 'N/A', job_listings: { role_title: 'Trainee' } };
    expect(await findTwin(rows([other]), 'user', { ...job, application_link: 'N/A' })).toBeNull();
  });
});

describe('isJobClosed', () => {
  it('asks each hiring system at its own fixed address', async () => {
    const cases: [string, string][] = [
      ['https://job-boards.greenhouse.io/crashplan/jobs/123', 'https://boards-api.greenhouse.io/v1/boards/crashplan/jobs/123'],
      ['https://jobs.lever.co/meesho/1de2/apply', 'https://jobs.lever.co/meesho/1de2'],
      ['https://cnx.wd1.myworkdayjobs.com/en-US/external/job/IND/Dev_R1/apply', 'https://cnx.wd1.myworkdayjobs.com/wday/cxs/cnx/external/job/IND/Dev_R1'],
      ['https://jobs.ashbyhq.com/acme/abc-1/application', 'https://api.ashbyhq.com/posting-api/job-board/acme'],
      ['https://jobs.smartrecruiters.com/Acme/7433-dev', 'https://api.smartrecruiters.com/v1/companies/Acme/postings/7433'],
    ];
    for (const [link, address] of cases) {
      const { asked, request } = answering(500);
      await isJobClosed(link, request);
      expect(asked).toEqual([address]);
    }
  });

  it('believes a 404 from Greenhouse and Lever, and a live answer', async () => {
    expect(await isJobClosed('https://boards.greenhouse.io/a/jobs/1', answering(404).request)).toBe(true);
    expect(await isJobClosed('https://jobs.lever.co/a/b', answering(404).request)).toBe(true);
    expect(await isJobClosed('https://boards.greenhouse.io/a/jobs/1', answering(200).request)).toBe(false);
  });

  it('tells a withdrawn Workday job from a firewall', async () => {
    const link = 'https://cnx.wd1.myworkdayjobs.com/external/job/IND/Dev_R1';
    expect(await isJobClosed(link, answering(403, { httpStatus: 403, errorCode: 'S22' }).request)).toBe(true);
    expect(await isJobClosed(link, answering(403, { httpStatus: 403, errorCode: 'S99' }).request)).toBe(false);
    const firewall = (async () => new Response('<html>blocked</html>', { status: 403 })) as unknown as typeof fetch;
    expect(await isJobClosed(link, firewall)).toBe(false);
  });

  it('reads an Ashby board for the job, and takes its 404 to say nothing', async () => {
    const link = 'https://jobs.ashbyhq.com/acme/abc-1';
    expect(await isJobClosed(link, answering(200, { jobs: [{ id: 'other' }] }).request)).toBe(true);
    expect(await isJobClosed(link, answering(200, { jobs: [{ id: 'ABC-1', isListed: false }] }).request)).toBe(true);
    expect(await isJobClosed(link, answering(200, { jobs: [{ id: 'abc-1' }] }).request)).toBe(false);
    expect(await isJobClosed(link, answering(200, { unexpected: true }).request)).toBe(false);
    expect(await isJobClosed(link, answering(404).request)).toBe(false);
  });

  it('reads SmartRecruiters for this posting and no other', async () => {
    const link = 'https://jobs.smartrecruiters.com/Acme/7433-dev';
    expect(await isJobClosed(link, answering(200, { id: '7433', active: false }).request)).toBe(true);
    expect(await isJobClosed(link, answering(200, { id: '7433', active: true }).request)).toBe(false);
    expect(await isJobClosed(link, answering(200, { id: '999', active: false }).request)).toBe(false);
    expect(await isJobClosed(link, answering(400).request)).toBe(false);
  });

  it('goes on when it cannot tell', async () => {
    const down = (async () => { throw new Error('timed out'); }) as unknown as typeof fetch;
    expect(await isJobClosed('https://boards.greenhouse.io/a/jobs/1', down)).toBe(false);
    expect(await isJobClosed('https://boards.greenhouse.io/a/jobs/1', answering(500).request)).toBe(false);
    expect(await isJobClosed('https://boards.greenhouse.io/a/jobs/1', answering(302).request)).toBe(false);
  });

  it('asks nothing about a site it does not know, or a link that tries to steer it', async () => {
    const cases = [
      'https://careers.example.com/job/1',
      'http://boards.greenhouse.io/a/jobs/1',
      'https://jobs.lever.co/a/..%2f..%2fadmin',
      'https://evil.wd1.myworkdayjobs.com.example.com/x/job/y',
    ];
    for (const link of cases) {
      const { asked, request } = answering(404);
      expect(await isJobClosed(link, request)).toBe(false);
      expect(asked).toEqual([]);
    }
  });
});
