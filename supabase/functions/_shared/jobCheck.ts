/*
  What can be known about a job before any browser or AI is spent on it: whether
  two listings are one job, and whether it has closed.

  The rules follow career-ops (url-key.mjs, liveness-api.mjs), MIT licensed,
  Copyright (c) 2026 Santiago Fernandez de Valderrama:
  https://github.com/career-ops-hq/career-ops
*/

// Only what identifies a click. Generic names like "ref" or "source" stay: some
// boards use them to tell one posting from another.
const TRACKING = /^(utm_.*|gh_src|fbclid|gclid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|trk|trackingid)$/i;

/**
 * One key for one job, or '' when the link cannot be read, and '' never matches.
 *
 * The role is part of the key because one careers link can carry many roles:
 * L&T Technology Services has 36 on a single link. Only tracking is dropped from
 * the link itself. A pair this misses is a job offered twice; a pair it wrongly
 * joins is a real application the user cannot make.
 */
export function postingKey(link: string, role: string): string {
  let url: URL;
  try { url = new URL(String(link).trim()); } catch { return ''; }
  if (!/^https?:$/.test(url.protocol)) return '';
  const query = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING.test(name))
    .map(([name, value]) => `${name}=${value}`)
    .sort()
    .join('&');
  // Single-page sites keep the job in the fragment: "#/jobprofiles/1234".
  const fragment = /^#[!/]/.test(url.hash) ? url.hash : '';
  const place = url.hostname.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/+$/, '');
  return [place, query, fragment, String(role || '').toLowerCase().replace(/\s+/g, ' ').trim()].join('|');
}

/**
 * The user's live application for this same job under another listing, if any.
 *
 * ponytail: read and compared here, so two copies of a job pressed in the same
 * instant can both get through. Store the key in a column under the unique index
 * if that ever happens; each press takes a resume tailoring, so it should not.
 */
export async function findTwin(
  supabase: any,
  userId: string,
  job: { id: string; application_link: string; role_title?: string | null },
): Promise<{ id: string; status: string } | null> {
  const key = postingKey(job.application_link, job.role_title || '');
  if (!key) return null;
  const { data } = await supabase
    .from('auto_apply_applications')
    .select('id, status, application_url, job_listings(role_title)')
    .eq('user_id', userId)
    .neq('status', 'failed')
    .neq('job_listing_id', job.id);
  const twin = (data || []).find((row: any) => postingKey(row.application_url, row.job_listings?.role_title || '') === key);
  return twin ? { id: twin.id, status: twin.status } : null;
}

// Path parts reach a request only after this, and hosts below are fixed, so a
// link in a listing cannot point this server at an address of its choosing.
const safe = (...parts: string[]) => parts.every((part) => /^[A-Za-z0-9._-]+$/.test(part) && !part.includes('..'));
const gone = (response: Response) => response.status === 404 || response.status === 410;

/** How to ask the hiring system behind a job link, or null when it is not one we can ask. */
function askFor(link: string): { url: string; closed: (response: Response) => boolean | Promise<boolean> } | null {
  let parsed: URL;
  try { parsed = new URL(String(link).trim()); } catch { return null; }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const [, board, id] = path.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/) || [];
    return board && safe(board) ? { url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${id}`, closed: gone } : null;
  }
  // The page, not Lever's API: the API also answers 404 for live confidential postings.
  if (/^jobs\.(eu\.)?lever\.co$/.test(host)) {
    const [, slug, id] = path.match(/^\/([^/]+)\/([^/]+?)(?:\/apply)?\/?$/) || [];
    return slug && safe(slug, id) ? { url: `https://${host}/${slug}/${id}`, closed: gone } : null;
  }
  // Ashby answers for a whole board, so a posting is closed when a board that
  // loaded no longer lists it. A 404 only says the board API is switched off.
  if (host === 'jobs.ashbyhq.com') {
    const [, org, id] = path.match(/^\/([^/]+)\/([^/]+?)(?:\/application)?\/?$/) || [];
    if (!org || !safe(org, id)) return null;
    return {
      url: `https://api.ashbyhq.com/posting-api/job-board/${org}`,
      closed: async (response) => {
        if (response.status !== 200) return false;
        const { jobs } = await response.json();
        return Array.isArray(jobs) && !jobs.some((job: any) => String(job?.id).toLowerCase() === id.toLowerCase() && job.isListed !== false);
      },
    };
  }
  // A withdrawn Workday job answers 403 with its own code. Any other 403 is a
  // firewall, which says nothing about the job.
  const workday = `${host}${path}`.match(/^([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[a-z]{2}\/)?([^/]+)\/job\/(.+?)\/?$/i);
  if (workday) {
    const [, tenant, shard, site] = workday;
    const job = workday[4].replace(/\/apply(\/.*)?$/, '');
    if (!safe(tenant, shard, site, ...job.split('/'))) return null;
    return {
      url: `https://${tenant}.${shard}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/job/${job}`,
      closed: async (response) => {
        if (gone(response)) return true;
        if (response.status !== 403) return false;
        const body = await response.json();
        return body?.httpStatus === 403 && body?.errorCode === 'S22';
      },
    };
  }
  if (host === 'jobs.smartrecruiters.com') {
    const [, company, id] = path.match(/^\/([^/]+)\/([A-Za-z0-9]+)(?:-[^/]*)?\/?$/) || [];
    if (!company || !safe(company, id)) return null;
    return {
      url: `https://api.smartrecruiters.com/v1/companies/${company}/postings/${id}`,
      closed: async (response) => {
        if (!response.ok) return false;
        const posting = await response.json();
        return String(posting?.id) === id && posting.active === false;
      },
    };
  }
  return null;
}

/**
 * For the daily clean-up, on any site: true when the page is gone (404/410) or
 * plainly says the job is over. Only unmistakable phrases: a live posting may
 * say "until the position has been filled", and a wrong "closed" removes a real
 * job. Pages that draw their text with JavaScript simply read as open.
 */
export async function pageSaysClosed(link: string, request: typeof fetch = fetch): Promise<boolean> {
  // Job boards that hide postings behind a sign-in answer a visitor with 404 or
  // a login wall whether the job is open or not, so their page proves nothing.
  // LinkedIn did exactly that on its first clean-up and open jobs were removed.
  let host = '';
  try { host = new URL(link).hostname.toLowerCase(); } catch { return false; }
  if (/(^|\.)(linkedin\.com|naukri\.com|indeed\.(com|co\.in)|glassdoor\.(com|co\.in)|foundit\.in|instahyre\.com|wellfound\.com|internshala\.com)$/.test(host)) return false;
  try {
    const response = await request(link, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { Accept: 'text/html' } });
    if (response.status === 404 || response.status === 410) return true;
    if (!response.ok) return false;
    const html = (await response.text()).slice(0, 400_000);
    return /job (posting )?is no longer (available|open|active)|this (job|position|role|posting|vacancy) (is )?no longer (available|open|active)|no longer accepting applications|(job|posting|position) has (expired|been closed|been removed)|this (job|position|posting) (has been|is) closed\b(?!-)/i.test(html);
  } catch {
    return false;
  }
}

/**
 * True only when the hiring system itself says the job is gone. A false "closed"
 * costs the user a real job, so a redirect, a timeout, a firewall or a site we
 * cannot ask all mean "go on": the form is still looked at after this.
 */
export async function isJobClosed(link: string, request: typeof fetch = fetch): Promise<boolean> {
  const ask = askFor(link);
  if (!ask) return false;
  try {
    const response = await request(ask.url, {
      redirect: 'manual',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    return await ask.closed(response);
  } catch {
    return false;
  }
}
