/*
  Google Forms keeps every question of a form, on all its pages, in one script on
  the page, and fills a form from its own address (a "pre-filled link"). So a form
  can be filled by building an address, with nothing clicked or typed into it.

  The script is not a published format, but it has not changed in years. If it
  does, questionsOf finds nothing and the form is simply left to the user.
*/
import { planFill, type ApplicantProfile, type FormField } from './applyForm.ts';

export interface GoogleQuestion extends FormField {
  /** The number Google knows this answer by, in `entry.<number>`. */
  entry: string;
  /** An upload, which only Google's own file picker can take. */
  upload: boolean;
}

// By Google's own numbering. Anything else (a grid, a time) is kept as a question
// so it can be listed for the user, under the one type planFill leaves alone.
const TYPES: Record<number, FormField['type']> = { 0: 'text', 1: 'textarea', 2: 'radio', 3: 'select', 4: 'checks', 5: 'radio', 9: 'date' };
const UPLOAD = 13;

/** The form's data, out of the text of the page's scripts, or null. */
export function readLoadData(scripts: string[]): any {
  for (const text of scripts) {
    const found = text.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    if (!found) continue;
    try { return JSON.parse(found[1]); } catch { return null; }
  }
  return null;
}

export function questionsOf(data: any): GoogleQuestion[] {
  const items = data?.[1]?.[1];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item: any, id: number) => {
    const block = item?.[4]?.[0];
    if (!block) return []; // a heading, a picture or a video
    return [{
      id,
      label: String(item[1] || '').trim(),
      type: TYPES[item[3]] ?? 'file',
      required: Boolean(block[2]),
      entry: String(block[0]),
      upload: item[3] === UPLOAD,
      options: (Array.isArray(block[1]) ? block[1] : []).map((option: any) => String(option?.[0] ?? '')).filter(Boolean),
    }];
  });
}

/** Whether the form records the signed-in address only once a box is ticked. No address can tick it. */
export function needsEmailTick(data: any): boolean {
  return data?.[1]?.[10]?.[6] === 2;
}

/** This form's own address with the applicant's answers in it. */
export function prefillLink(
  pageUrl: string,
  questions: GoogleQuestion[],
  profile: ApplicantProfile,
  saved: Record<string, string>,
): string {
  const url = new URL(pageUrl);
  url.hash = '';
  url.searchParams.set('usp', 'pp_url');
  // Only used by a form that collects addresses itself; the rest ignore it.
  if (profile.email) url.searchParams.set('emailAddress', profile.email);
  for (const fill of planFill(questions, profile, saved).fills) {
    const { entry } = questions.find((question) => question.id === fill.id)!;
    if (fill.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(fill.value)) continue;
    for (const value of fill.type === 'checks' ? fill.value.split(' | ') : [fill.value]) {
      url.searchParams.append(`entry.${entry}`, value);
    }
  }
  return url.toString();
}

/** Whether this address already carries answers. Google drops `usp` once the page has loaded. */
export function isPrefilled(pageUrl: string): boolean {
  const search = new URL(pageUrl).searchParams;
  return search.get('usp') === 'pp_url' || search.has('emailAddress') || [...search.keys()].some((name) => name.startsWith('entry.'));
}

/** What the address holds answers for, and which required questions it does not. */
export function reportOn(pageUrl: string, questions: GoogleQuestion[]) {
  const search = new URL(pageUrl).searchParams;
  const answered = (question: GoogleQuestion) => search.has(`entry.${question.entry}`);
  return {
    filled: questions.filter(answered).length,
    left: questions.filter((question) => question.required && !question.upload && !answered(question)).map((question) => question.label),
    uploads: questions.filter((question) => question.upload).map((question) => question.label),
  };
}
