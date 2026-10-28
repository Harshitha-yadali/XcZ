/*
  The sign-in pages that are never ours to fill in, wherever they turn up.

  Kept apart from applyForm.ts so the website can ask the same question
  without pulling the whole apply engine into its bundle. One list, so the
  browser and the worker can never disagree about it.
*/

/**
 * True when a sign-in page belongs to an identity provider rather than to an
 * employer.
 *
 * A job hosted on a Google Form sends the applicant to accounts.google.com,
 * and because the job link is itself a google.com address, a chain of trust
 * built on the job link counts that as the job's own site. One password there
 * opens the user's mail, their files, and every other site they sign into with
 * it. No single job is worth that, so these hosts are refused whatever linked
 * to them.
 */
export function isProviderLoginHost(host: string): boolean {
  return /^(accounts\.google\.com|accounts\.youtube\.com|appleid\.apple\.com|login\.microsoftonline\.com|login\.live\.com|login\.yahoo\.com|github\.com|www\.facebook\.com|m\.facebook\.com|(www\.)?linkedin\.com)$/i
    .test(host.trim());
}

/** The provider a login host belongs to, in words, for telling the user why we stopped. */
export function providerName(host: string): string {
  const named = host.match(/google|youtube|apple|microsoft|live|yahoo|github|facebook|linkedin/i);
  const word = named ? named[0].toLowerCase() : 'that provider';
  return ({ live: 'Microsoft', microsoft: 'Microsoft', youtube: 'Google' } as Record<string, string>)[word]
    || word.charAt(0).toUpperCase() + word.slice(1);
}
