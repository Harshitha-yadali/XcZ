/**
 * The questions nearly every application form asks, answered once when the user
 * turns their agent on, so a form does not stop to ask them job after job.
 *
 * Saved in user_profiles.apply_answers under keys starting with "@", beside the
 * answers remembered by exact label. Kept apart from applyForm.ts so the website
 * can import the same list it saves against.
 *
 * Matching is narrow on purpose: an answer is used only when the label asks
 * exactly this and nothing else. Anything wider ("willing to relocate to Dubai?",
 * "10th percentage") is still asked. A question asked needlessly costs a click;
 * a wrong answer goes to an employer under the user's name.
 */
export interface ApplyTopic {
  key: string;
  label: string;
  hint?: string;
  options?: string[];
  /** Tested against the label as answerKey() reduces it: lower case, words only. */
  match: RegExp;
}

export const TOPICS: ApplyTopic[] = [
  { key: '@current_ctc', label: 'Current salary (CTC per year)', hint: 'Write 0 if this is your first job', match: /\bcurrent (annual )?(ctc|salary|compensation|package)\b|\bcctc\b/ },
  { key: '@expected_ctc', label: 'Expected salary (CTC per year)', hint: 'For example: 6 LPA', match: /\bexpected (annual )?(ctc|salary|compensation|package|stipend)\b|\bectc\b|\bsalary expectations?\b/ },
  { key: '@notice_period', label: 'Notice period', options: ['Immediate', '15 days', '30 days', '60 days', '90 days'], match: /\bnotice period\b/ },
  // Only the bare question. "Willing to relocate to Pune?" names a place the user did not.
  { key: '@relocate', label: 'Willing to relocate?', options: ['Yes', 'No'], match: /\brelocat\w*( if required| if needed| anywhere in india)?$/ },
  { key: '@india_work', label: 'Allowed to work in India?', options: ['Yes', 'No'], match: /\b(authori[sz]ed|eligible|legally allowed|permitted) to work in india$/ },
  { key: '@sponsorship', label: 'Need visa sponsorship to work in India?', options: ['No', 'Yes'], match: /\bsponsorship\b.*\bindia\b|\bindia\b.*\bsponsorship\b/ },
  { key: '@cgpa', label: 'Degree CGPA', hint: 'For example: 8.2', match: /^(b ?tech |b ?e |degree |ug |graduation |undergraduate )?c?gpa( out of 10)?$/ },
  { key: '@backlogs', label: 'Active backlogs', hint: 'Write 0 if none', match: /^(number of )?(active |current )?(backlogs?|arrears?)$/ },
  { key: '@gender', label: 'Gender', options: ['Male', 'Female', 'Prefer not to say'], match: /^(gender|sex)$/ },
  { key: '@disability', label: 'Do you have a disability?', options: ['No', 'Yes', 'Prefer not to say'], match: /^(disability|disability status|pwd)$/ },
  { key: '@hear_about', label: 'How did you hear about the job?', hint: 'For example: PrimoBoost AI', match: /^how did you (hear|learn) about (us|this (job|role|position|opening))$/ },
];

const SOMEONE_ELSE = /father|mother|parent|guardian|spouse|husband|wife|refer|emergency/;

/** The saved answer for a label that asks exactly one of the topics, or ''. */
export function topicAnswer(key: string, saved: Record<string, string>): string {
  if (key.split(' ').length > 12 || SOMEONE_ELSE.test(key)) return '';
  const hits = TOPICS.filter((topic) => topic.match.test(key));
  return hits.length === 1 ? (saved[hits[0].key] || '').trim() : '';
}
