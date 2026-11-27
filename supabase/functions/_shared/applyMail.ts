// Reads the mail employers send to an applicant's PrimoBoost address. Mail is
// written by strangers: it is sorted by its words and never obeyed.

export type MailKind = 'code' | 'confirmed' | 'interview' | 'rejected' | 'other';
export interface Mail { from_address: string; subject: string; body: string }

const CODE_WORDS = /(verification|security|one[- ]time|confirmation|authentication|login|sign[- ]in|access) (code|passcode|password|pin)|\botp\b|passcode/i;

/** The one-time code in a message, or '' when it holds none. */
export function findCode(subject: string, body: string): string {
  const text = `${subject}\n${body}`;
  const words = CODE_WORDS.exec(text);
  if (!words) return '';
  // Looked for after the words that announce it first: a phone number or a job
  // number may stand anywhere else.
  const after = text.slice(words.index + words[0].length, words.index + words[0].length + 400);
  const before = text.slice(Math.max(0, words.index - 80), words.index);
  const pattern = /(?<![\w-])((?!20[0-3]\d\b)\d{4,8}|\d{3}[ -]\d{3}|(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{6,8})(?![\w-])/;
  return (pattern.exec(after)?.[1] || pattern.exec(before)?.[1] || '').replace(/[ -]/g, '');
}

export function mailKind(subject: string, body: string): MailKind {
  const text = `${subject}. ${body}`.replace(/\s+/g, ' ');
  if (findCode(subject, body)) return 'code';
  if (/unfortunately|regret to|not (be )?(moving|move|proceed\w*|going) forward|not (been )?(selected|shortlisted)|decided to (move|proceed|go) (forward )?with other|position has been filled|will not be (moving|proceeding)/i.test(text)) return 'rejected';
  // "If you are shortlisted we will invite you" is a promise, not an invitation.
  const invitation = text.split(/(?<=[.!?])\s/).some((sentence) =>
    !/\b(if|should you|once|in case)\b/i.test(sentence)
    && /(invite|inviting|schedul\w*|book|select a (time|slot)|pick a (time|slot)|shortlisted)/i.test(sentence)
    && /(interview|assessment|coding test|online test|call with|phone screen)/i.test(sentence));
  if (invitation || /^(re: )?(interview|assessment) (invit|schedul)/i.test(subject)) return 'interview';
  if (/thank(s| you) for (applying|your application|your interest)|application (has been |was |is )?(received|submitted)|received your application|successfully applied/i.test(text)) return 'confirmed';
  return 'other';
}

const key = (value: string) => value.toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llp|llc|technologies|solutions|india)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** The one application a message is about, or null when that is not certain. */
export function applicationFor<T extends { company: string }>(mail: Mail, applications: T[]): T | null {
  const text = ` ${key(`${mail.from_address} ${mail.subject} ${mail.body}`)} `;
  const named = applications.filter(({ company }) => key(company).length > 2 && text.includes(` ${key(company)} `));
  return named.length === 1 ? named[0] : null;
}

/** Whether a message plausibly comes from the site that is asking for a code. */
export function mailIsFrom(host: string, mail: Mail): boolean {
  const label = (domain: string) => {
    const parts = domain.toLowerCase().split('.').filter(Boolean);
    const secondLevel = parts.length > 2 && /^(co|com|org|net|gov|ac)$/.test(parts[parts.length - 2]);
    return parts[parts.length - (secondLevel ? 3 : 2)] || '';
  };
  const site = label(host);
  const sender = label(mail.from_address.split('@').pop()?.replace(/[>\s].*$/, '') || '');
  // boards.greenhouse.io writes from greenhouse-mail.io, myworkdayjobs.com from myworkday.com.
  return sender.length > 3 && site.length > 3 && (site.startsWith(sender) || sender.startsWith(site));
}
