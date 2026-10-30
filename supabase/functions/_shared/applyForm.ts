// Reads an employer's application form in a real browser, fills it from the
// user's profile, and reports what actually happened. Shared by the
// auto-apply-submit edge function and scripts/auto-apply-dryrun.mjs.
import type { Page } from './cdp.ts';
// Re-exported so the engine's own callers and tests keep one import, while the
// website can take the list on its own without the whole apply engine.
export { isProviderLoginHost, providerName } from './providerHosts.ts';
import { isProviderLoginHost, providerName } from './providerHosts.ts';

export type Platform = 'greenhouse' | 'lever' | 'linkedin' | 'naukri' | 'indeed' | 'workday' | 'other';

export interface ApplicantProfile {
  fullName: string;
  email: string;
  phone: string;
  linkedin: string;
  github: string;
  location: string;
  // Read from the tailored resume; empty when the resume does not say.
  college?: string;
  degree?: string;
  graduationYear?: string;
  skills?: string;
}

export interface FormField {
  id: number;
  label: string;
  // 'checks' is a group of checkboxes under one question; its answer is the
  // chosen options joined with ' | '.
  type: 'text' | 'date' | 'textarea' | 'select' | 'radio' | 'checks' | 'checkbox' | 'combobox' | 'file';
  required: boolean;
  options: string[];
  /** Set when the form shows the country code beside the box, e.g. "+91": the box wants the number without it. */
  dialCode?: string;
  /** Set when the form arrives with a choice already made (a preselected country, say); it is left as it is. */
  filled?: boolean;
  /**
   * Whether the field currently holds anything. Some forms mark nothing as
   * required and only name what is missing once Submit has been pressed, so
   * after a refusal the blank fields are the ones worth asking the user about.
   */
  answered?: boolean;
}

export interface Fill { id: number; type: FormField['type']; label: string; value: string }
export interface Question { key: string; label: string; type: FormField['type']; options: string[] }

export interface ApplyResult {
  // 'needs_login': the site wants a signed-in account and we have no working login for it.
  status: 'submitted' | 'needs_input' | 'needs_login' | 'unconfirmed' | 'failed' | 'dry_run';
  message?: string;
  questions?: Question[];
  filled?: Record<string, string>;
  fields?: FormField[];
  resumeAttached?: boolean;
  /** dry_run only: what was put in each field, by answer key, for the user to review and approve. */
  answers?: Record<string, string>;
  /** dry_run only: boxes on the form left unticked. Ticking one is the user's choice, made at review. */
  consents?: Question[];
  /** needs_login only: the address of the sign-in page. A login is saved for, and typed on, exactly this address. */
  site?: string;
}

const DOMAINS: [Platform, string[]][] = [
  ['greenhouse', ['greenhouse.io']],
  ['lever', ['lever.co']],
  ['linkedin', ['linkedin.com']],
  ['naukri', ['naukri.com']],
  ['indeed', ['indeed.com']],
  ['workday', ['workday.com', 'myworkdayjobs.com']],
];

// Matches on the hostname, not the whole URL: the URL comes from a user-writable
// row and decides whether our browser visits it.
export function detectPlatform(url: string): Platform {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return 'other'; }
  const found = DOMAINS.find(([, domains]) => domains.some((domain) => host === domain || host.endsWith(`.${domain}`)));
  return found ? found[0] : 'other';
}

/** A label reduced to a stable key, so a saved answer is found again on the next form. */
export const answerKey = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);

function profileAnswer(label: string, profile: ApplicantProfile): string {
  const key = answerKey(label);
  // Contact fields have short labels. A long one is a question that merely
  // mentions "location" or "name", and must be asked rather than guessed.
  if (key.split(' ').length > 6) return '';
  const [first, ...rest] = profile.fullName.trim().split(/\s+/);
  if (/first name|given name/.test(key)) return first;
  if (/last name|surname|family name/.test(key)) return rest.join(' ');
  if (/\bname\b/.test(key) && !/company|employer|school|university|college|refer/.test(key)) return profile.fullName.trim();
  if (/e ?mail/.test(key)) return profile.email;
  if (/phone|mobile|contact (number|no)\b/.test(key)) return profile.phone;
  if (/linkedin/.test(key)) return profile.linkedin;
  if (/github/.test(key)) return profile.github;
  if (/\b(city|location)\b/.test(key)) return profile.location;
  if (/(graduat\w*|passing|pass ?out) year|year of (graduation|passing)/.test(key)) return profile.graduationYear || '';
  if (/college|university|institute/.test(key)) return profile.college || '';
  if (/degree|qualification/.test(key)) return profile.degree || '';
  if (/\bskills\b/.test(key)) return profile.skills || '';
  return '';
}

function pickOption(options: string[], answer: string): string {
  const wanted = answerKey(answer);
  if (!wanted) return '';
  return options.find((option) => answerKey(option) === wanted)
    ?? options.find((option) => answerKey(option).includes(wanted))
    ?? '';
}

/**
 * Decides what goes into each field. A required field we have no answer for
 * becomes a question for the user; nothing is ever guessed.
 */
export function planFill(fields: FormField[], profile: ApplicantProfile, saved: Record<string, string>) {
  const fills: Fill[] = [];
  const missing: Question[] = [];
  for (const field of fields) {
    const key = answerKey(field.label);
    if (field.type === 'file' || !key || field.filled) continue;
    let value = saved[key] || profileAnswer(field.label, profile) || '';
    if (field.type === 'checks') value = value.split('|').map((part) => pickOption(field.options, part)).filter(Boolean).join(' | ');
    else if (value && field.options.length) value = pickOption(field.options, value);
    // A box is ticked only where the user authorised that exact acknowledgement.
    // A required one they have not authorised becomes a question and the run
    // pauses for it; an optional opt-in is simply left alone.
    if (field.type === 'checkbox' && !/^(yes|true|on)$/i.test(value)) value = '';
    if (value && field.dialCode) {
      const digits = value.replace(/\D/g, '');
      const code = field.dialCode.replace(/\D/g, '');
      value = digits.startsWith(code) && digits.length > 10 ? digits.slice(code.length) : digits;
    }
    if (value) fills.push({ id: field.id, type: field.type, label: field.label, value });
    else if (field.required && !missing.some((question) => question.key === key)) {
      missing.push({ key, label: field.label, type: field.type, options: field.options });
    }
  }
  return { fills, missing };
}

/** The URL of the form itself: Lever keeps it one step past the posting. */
export function applyUrl(url: string): string {
  if (detectPlatform(url) !== 'lever') return url;
  const parsed = new URL(url);
  if (!/\/apply\/?$/.test(parsed.pathname)) parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/apply`;
  return parsed.toString();
}

// ---- The functions below run inside the page. They are sent as source text,
// ---- so they cannot use anything from this module.

/**
 * A cheap stand-in for scanForm, for polling. It counts the fillable fields and
 * names them from attributes only, skipping the label hunt and the DOM tagging
 * that make a full scan expensive. Waiting for a page with scanForm costs one
 * whole-document walk every half second; this is what the waiting uses instead.
 */
export function fieldShape(): any {
  const skip = ['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password'];
  const parts: string[] = [];
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const kind = (el as any).type || el.tagName.toLowerCase();
    if (skip.includes(kind) || (el as any).disabled || el.getAttribute('aria-hidden') === 'true') continue;
    // The same filter scanForm uses: a form that shows one page at a time keeps
    // the other pages in the document, and they are not fields until shown.
    // File inputs are usually hidden behind a styled button, so keep those.
    if (kind !== 'file' && !el.getClientRects().length) continue;
    parts.push(`${kind}:${(el as any).id || (el as any).name || (el as any).placeholder || ''}`);
  }
  return { count: parts.length, shape: parts.join('|').slice(0, 4000) };
}

/** Lists the form's fields and tags each element with data-pb-field so fillForm can find it. */
export function scanForm(): any {
  // Prefer the biggest real <form>, but only when it holds fields worth having.
  // Cisco and others lay the application out in plain divs and leave the page's
  // only <form> around the site search, so scanning that form finds nothing.
  const worthScanning = (element: any) =>
    [...element.querySelectorAll('input, select, textarea')]
      .filter((el: any) => !['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password'].includes(el.type)).length;
  const biggest: any = [...document.forms].sort((a, b) => worthScanning(b) - worthScanning(a))[0];
  const root: any = biggest && worthScanning(biggest) >= 2 ? biggest : document.body;
  const clean = (text: any) => String(text || '')
    .replace(/[*✱]/g, '').replace(/\s+/g, ' ')
    // Microsoft Forms ends every question's accessible name with the kind of
    // answer it takes, which belongs to a screen reader and not to a question
    // put to the user: "15. Name of the Engineering College Single line text."
    // Only the whole phrase, and only with its full stop: "Number" and "Date"
    // on their own end plenty of real questions, such as "Mobile Number".
    .replace(/\s*(single line text|long answer text|single choice|multiple choice|multi.?choice|file upload|net promoter score|date input)\.\s*$/i, '')
    .trim();
  const starred = (text: any) => /[*✱]/.test(String(text || ''));
  const firstLine = (el: any) => String(el?.innerText || '').trim().split('\n')[0];
  const namedBy = (el: any) => String(el?.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
    .map((id) => (document.getElementById(id) as any)?.innerText).filter(Boolean).join(' ');
  const labelOf = (el: any) => {
    const named = namedBy(el);
    const wrapper = el.closest('[role="combobox"]');
    let label = named || el.labels?.[0]?.innerText || el.getAttribute('aria-label') || wrapper?.getAttribute('aria-label') || '';
    // No label element: the question is usually the text just above the field.
    // A line without two letters is decoration, such as a "+91" country code.
    const own = el.tagName === 'SELECT' ? [...el.options].map((option: any) => clean(option.text)) : [];
    // First choice is the nearest text that sits before the field, at its own
    // level or a wrapper's. A neighbour holding another field ends the search
    // at that level: its text belongs to that field.
    for (let node = el, depth = 0; !label && node && depth < 4; node = node.parentElement, depth++) {
      for (let prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
        if (prev.matches('input, select, textarea') || prev.querySelector('input, select, textarea')) break;
        const line = clean((prev as any).innerText);
        if (/[a-z].*[a-z]/i.test(line) && line.length < 200 && !own.includes(line)) { label = (prev as any).innerText; break; }
      }
    }
    for (let box = el.parentElement, depth = 0; !label && box && depth < 4; box = box.parentElement, depth++) {
      const line = clean(firstLine(box));
      if (/[a-z].*[a-z]/i.test(line) && !own.includes(line)) label = firstLine(box);
    }
    return label || el.placeholder || el.name || '';
  };

  const fields: any[] = [];
  const groups = new Map();
  for (const el of root.querySelectorAll('input, textarea, select, button[aria-haspopup="listbox"]')) {
    // The combobox role sits on the input itself or on a wrapper around it; a
    // button that opens a list is the same kind of field.
    const kind = el.tagName === 'BUTTON' ? 'combobox'
      : el.tagName !== 'INPUT' ? el.tagName.toLowerCase() : el.closest('[role="combobox"]') ? 'combobox' : el.type;
    if (['hidden', 'submit', 'button', 'reset', 'image', 'search', 'password'].includes(kind) || el.disabled) continue;
    // Custom dropdowns keep a hidden mirror input for validation; it is not a field.
    if (el.getAttribute('aria-hidden') === 'true') continue;
    // File inputs are usually hidden behind a styled button, so keep those.
    if (kind !== 'file' && !el.getClientRects().length) continue;

    // Radios, and checkboxes that share a name, are one question with options.
    const grouped = kind === 'radio'
      || (kind === 'checkbox' && el.name && root.querySelectorAll(`input[type=checkbox][name="${CSS.escape(el.name)}"]`).length > 1);
    if (grouped) {
      let group = groups.get(`${kind} ${el.name}`);
      if (!group) {
        group = { id: fields.length, label: '', type: kind === 'radio' ? 'radio' : 'checks', required: false, answered: false, options: [], first: el };
        groups.set(`${kind} ${el.name}`, group);
        fields.push(group);
      }
      group.options.push(clean(el.labels?.[0]?.innerText || el.value));
      group.answered = group.answered || el.checked === true;
      group.required = group.required || el.required || el.getAttribute('aria-required') === 'true';
      el.setAttribute('data-pb-field', String(group.id));
      continue;
    }

    const label = labelOf(el);
    el.setAttribute('data-pb-field', String(fields.length));
    fields.push({
      id: fields.length,
      label: clean(label),
      type: ['date', 'textarea', 'select', 'checkbox', 'combobox', 'file'].includes(kind) ? kind : 'text',
      dialCode: (String(el.parentElement?.innerText || '').trim().match(/^\+\d{1,4}$/) || [])[0],
      // A list button shows its current choice as its text; a placeholder means none yet.
      filled: el.tagName === 'BUTTON' && !/^(select( one)?|choose( one)?|please select|-+)?$/i.test(clean(el.innerText)),
      required: el.required || el.getAttribute('aria-required') === 'true' || starred(label),
      // Whether this field already holds something. Some forms mark nothing
      // required and only say what is missing once Submit has been pressed, so
      // after a refusal the blank fields are the ones worth asking about.
      answered: kind === 'checkbox' ? el.checked === true : Boolean(clean(el.value)),
      options: kind === 'select' ? [...el.options].filter((option: any) => option.value).map((option: any) => clean(option.text)) : [],
    });
  }

  // A group's question sits above its options: climb until the first line of
  // text is no longer one of the options.
  for (const group of groups.values()) {
    let box = group.first.parentElement;
    // An empty wrapper around the radio itself is not the question either.
    while (box && box !== document.body && (!clean(firstLine(box)) || group.options.includes(clean(firstLine(box))))) box = box.parentElement;
    // A group that names its question is believed first. Microsoft Forms puts
    // the number and the words on separate lines, so a first line reads "10.".
    const heading = namedBy(group.first.closest('[role="radiogroup"], [role="group"]')) || firstLine(box);
    group.label = clean(heading);
    group.required = group.required || starred(heading);
    delete group.first;
  }
  return fields;
}

/** Fills everything except comboboxes (those need real key presses) and attaches the resume. */
export function fillForm({ fills, resume }: any): any {
  const key = (text: any) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const fire = (el: any, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

  for (const fill of fills) {
    const matches: any[] = [...document.querySelectorAll(`[data-pb-field="${fill.id}"]`)];
    const el = matches[0];
    if (!el) continue;
    if (fill.type === 'radio') {
      matches.find((radio) => key(radio.labels?.[0]?.innerText || radio.value) === key(fill.value))?.click();
    } else if (fill.type === 'checks') {
      const wanted = fill.value.split('|').map(key);
      for (const box of matches) {
        if (!box.checked && wanted.includes(key(box.labels?.[0]?.innerText || box.value))) box.click();
      }
    } else if (fill.type === 'checkbox') {
      if (!el.checked) el.click();
    } else if (fill.type === 'select') {
      const option: any = [...el.options].find((candidate: any) => key(candidate.text) === key(fill.value));
      if (option) { el.value = option.value; fire(el, 'change'); }
    } else if (fill.type !== 'combobox') {
      // React keeps its own copy of the value, so go through the native setter.
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, fill.value);
      fire(el, 'input');
      fire(el, 'change');
    }
  }

  if (!resume) return { resumeAttached: true };
  const inputs: any[] = [...document.querySelectorAll('input[type=file]')];
  const input = inputs.find((candidate) => /resume|cv/i.test(`${candidate.id} ${candidate.name} ${candidate.labels?.[0]?.innerText || ''}`)) || inputs[0];
  if (!input) return { resumeAttached: false };
  const bytes = Uint8Array.from(atob(resume.base64), (char) => char.charCodeAt(0));
  const transfer = new DataTransfer();
  transfer.items.add(new File([bytes], resume.name, { type: 'application/pdf' }));
  input.files = transfer.files;
  fire(input, 'input');
  fire(input, 'change');
  return { resumeAttached: input.files.length === 1 };
}

export function focusField(id: number): any {
  const el: any = document.querySelector(`[data-pb-field="${id}"]`);
  el?.scrollIntoView({ block: 'center' });
  el?.focus();
  return Boolean(el);
}

/** The choices of a custom dropdown that is currently open. */
export function openOptions(id: number): any {
  const el: any = document.querySelector(`[data-pb-field="${id}"]`);
  const list = document.getElementById(el?.getAttribute('aria-controls') || el?.closest('[role="combobox"]')?.getAttribute('aria-controls') || '')
    // Not linked to its field: take the list that is open on the page right now.
    || [...document.querySelectorAll('[role="listbox"]')].filter((box: any) => box.getClientRects().length > 0).pop();
  return list ? [...list.querySelectorAll('[role="option"]')].map((option: any) => String(option.innerText || '').replace(/\s+/g, ' ').trim()) : [];
}

/** Clicks the choice with this text in an open custom dropdown. */
export function pickOpenOption({ id, value }: any): any {
  const key = (text: any) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const el: any = document.querySelector(`[data-pb-field="${id}"]`);
  const list = document.getElementById(el?.getAttribute('aria-controls') || el?.closest('[role="combobox"]')?.getAttribute('aria-controls') || '')
    // Not linked to its field: take the list that is open on the page right now.
    || [...document.querySelectorAll('[role="listbox"]')].filter((box: any) => box.getClientRects().length > 0).pop();
  const option: any = list && [...list.querySelectorAll('[role="option"]')].find((candidate: any) => key(candidate.innerText) === key(value));
  // Some menus choose on mouse-down and never see a plain click.
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    option?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  option?.click();
  return Boolean(option);
}

export function clickField(id: number): any {
  (document.querySelector(`[data-pb-field="${id}"]`) as any)?.click();
  return true;
}

/**
 * Finds the button that moves the form on and marks it for pressAction.
 * kind is 'next' on a middle page of a multi-page form, 'submit' on the last
 * (or only) page, '' when there is no such button.
 */
export function findAction(): any {
  const text = (el: any) => String(el.innerText || el.value || '').replace(/\s+/g, ' ').trim();
  const within = (root: any) => {
    const buttons: any[] = [...root.querySelectorAll('button, input[type=submit], [role="button"]')].filter((el: any) => el.getClientRects().length > 0);
    const submit = buttons.find((el) => /^(submit|submit application|submit my application|send application|apply|apply now)$/i.test(text(el)));
    const next = buttons.find((el) => /^(next|next step|continue|save and continue|save & continue)$/i.test(text(el)));
    // Wording decides first; an unlabelled submit-type button is the fallback.
    const fallback = buttons.find((el) => el.type === 'submit') || buttons.find((el) => /submit|apply/i.test(text(el)));
    return submit ? { el: submit, kind: 'submit' } : next ? { el: next, kind: 'next' } : fallback ? { el: fallback, kind: 'submit' } : null;
  };
  const form: any = document.querySelector('[data-pb-field]')?.closest('form');
  const found = (form && within(form)) || within(document);
  document.querySelectorAll('[data-pb-action]').forEach((el) => el.removeAttribute('data-pb-action'));
  if (!found) return { kind: '', disabled: false };
  found.el.setAttribute('data-pb-action', '1');
  return { kind: found.kind, disabled: Boolean(found.el.disabled) || found.el.getAttribute('aria-disabled') === 'true' };
}

/** Presses the button findAction marked. */
export function pressAction(): any {
  const button: any = document.querySelector('[data-pb-action]');
  button?.click();
  return Boolean(button);
}

/**
 * What kind of sign-in page this is, or '' when it is not one.
 * - 'password': it shows one password box.
 * - 'signup': it shows several, so it is a registration form.
 * - 'identifier': it asks only who you are (an IBMid, an email) and shows the
 *   password box on the next page.
 */
export function loginStage(): any {
  const visible = (el: any) => el.getClientRects().length > 0;
  const passwords = [...document.querySelectorAll('input[type=password]')].filter(visible);
  if (passwords.length) return passwords.length === 1 ? 'password' : 'signup';

  const boxes: any[] = [...document.querySelectorAll('input')]
    .filter((el: any) => visible(el) && ['text', 'email', 'tel'].includes(el.type));
  if (boxes.length !== 1 || document.querySelector('input[type=file]')) return '';
  // A search bar or a newsletter signup is also one lone box, so both the box
  // and the page have to say that this is a sign-in.
  const box = boxes[0];
  const label = String(box.labels?.[0]?.innerText || box.getAttribute('aria-label') || '').trim();
  const namesAccount = /user|login|e-?mail|ident|account/i.test(`${box.name} ${box.id} ${box.autocomplete} ${label}`)
    || /id$/i.test(label);
  const aboutSignIn = /log ?in|sign ?in|sso|authenticat/i.test(`${document.title} ${location.hostname}${location.pathname}`);
  return namesAccount && aboutSignIn ? 'identifier' : '';
}

/** On an 'identifier' page: types the account name and presses the button that moves on to the password. */
export function enterIdentifier(username: string): any {
  const visible = (el: any) => el.getClientRects().length > 0;
  const box: any = [...document.querySelectorAll('input')]
    .find((el: any) => visible(el) && ['text', 'email', 'tel'].includes(el.type));
  const scope: any = box?.closest('form') || document;
  const button: any = scope.querySelector('button[type=submit], input[type=submit]')
    || [...scope.querySelectorAll('button, [role="button"]')].find((el: any) =>
      visible(el) && /^(continue|next|sign in|log in|login)$/i.test(String(el.innerText || '').trim()));
  if (!box || !button) return false;
  box.focus();
  // React keeps its own copy of the value, so go through the native setter.
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!.call(box, username);
  // Some pages only enable their button once they have seen typing.
  for (const type of ['input', 'change', 'keyup']) box.dispatchEvent(new Event(type, { bubbles: true }));
  button.click();
  return true;
}

/**
 * On a 'password' page: types the user's own login and presses the sign-in
 * button. The account name is typed too when the page has a box for it; the
 * second page of a two-step sign-in has none, or shows the name read-only.
 */
export function signIn({ username, password }: any): any {
  const visible = (el: any) => el.getClientRects().length > 0;
  const boxes: any[] = [...document.querySelectorAll('input[type=password]')].filter(visible);
  if (boxes.length !== 1) return false;
  const scope: any = boxes[0].closest('form') || document;
  const inputs: any[] = [...scope.querySelectorAll('input')].filter(visible);
  // The name box is the last editable text-like box before the password box.
  const name = inputs.slice(0, inputs.indexOf(boxes[0]))
    .filter((el) => ['email', 'text', 'tel'].includes(el.type) && !el.readOnly && !el.disabled).pop();
  const button: any = scope.querySelector('button[type=submit], input[type=submit]')
    || [...scope.querySelectorAll('button, [role="button"]')].find((el: any) => /^(sign in|log in|login|continue|next)$/i.test(String(el.innerText || '').trim()));
  if (!button) return false;
  for (const [el, value] of [[name, username], [boxes[0], password]] as any[]) {
    if (!el) continue;
    // React keeps its own copy of the value, so go through the native setter.
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, value);
    for (const type of ['input', 'change', 'keyup']) el.dispatchEvent(new Event(type, { bubbles: true }));
  }
  button.click();
  return true;
}

/** True when the page asks for a one-time code or another second step that only the user can do. */
export function asksForCode(): any {
  return /(verification|security|one[- ]time|authentication) (code|passcode|password)|two[- ]step|2[- ]step|two[- ]factor|authenticator app/i
    .test(document.body?.innerText || '');
}

/**
 * A sign-in page that offers a choice of providers before any password box:
 * Workday opens with "Sign in with Apple / Google / LinkedIn / email". Only
 * the site's own email sign-in is ours to open, because the others hand the
 * user to someone else's login, where their password is not ours to type.
 */
export function openEmailSignIn(): any {
  if (document.querySelector('input[type=password]')) return false;
  // Never ours to press. These hand the user to someone else's login, where
  // the password opens their whole life rather than one job application.
  const provider = /google|apple|linked ?in|facebook|microsoft|outlook|github|okta|azure|saml|single sign|\bsso\b/i;
  // The site's own way in names what it wants typed.
  const ownWay = /e-?mail|user ?name|password/i;
  const el: any = [...document.querySelectorAll('button, a, [role="button"]')].find((candidate: any) => {
    const text = String(candidate.innerText || '').trim();
    return candidate.getClientRects().length > 0
      // Long text is a paragraph that happens to say "email", not a control.
      && text.length > 0 && text.length <= 40
      && ownWay.test(text) && !provider.test(text)
      // Anchored so "Forgot your password?" and "No account? Sign up" are left alone.
      && /^(sign|log|continue|proceed|use|e-?mail|user ?name)/i.test(text);
  });
  el?.click();
  return Boolean(el);
}

/**
 * The name of the provider a sign-in page insists on, or '' when it does not.
 *
 * Some employers put their careers site behind "Continue with Google" and
 * offer nothing else. We do not sign in as the user anywhere but the
 * employer's own site, so there is no way through: say which provider it wants
 * instead of reporting that the job has no application form.
 */
export function providerOnlyWall(): any {
  if (document.querySelector('input[type=password]')) return '';
  const visible = (el: any) => el.getClientRects().length > 0;
  const provider = /google|apple|linked ?in|facebook|microsoft|github/i;
  const offers: string[] = [...document.querySelectorAll('button, a, [role="button"]')]
    .filter(visible)
    .map((el: any) => String(el.innerText || '').trim())
    .filter((text) => text.length <= 40 && /^(sign|log|continue|use)/i.test(text) && provider.test(text));
  if (!offers.length) return '';
  // A box to type an account name into means a way in that is ours still exists.
  const boxes = [...document.querySelectorAll('input')]
    .filter((el: any) => visible(el) && ['text', 'email', 'tel'].includes(el.type));
  if (boxes.length) return '';
  const named = offers[0].match(provider);
  return named ? named[0] : '';
}

/** Switches a sign-up page to its sign-in view. */
export function openSignIn(): any {
  const matches: any[] = [...document.querySelectorAll('a, button, [role="button"]')].filter((candidate: any) =>
    candidate.getClientRects().length > 0 && /^(sign in|log in|login)$/i.test(String(candidate.innerText || '').trim()));
  // Prefer the switch belonging to the sign-up card itself. A page header
  // carries its own "Sign In", and pressing that one opens a second box over
  // the first, leaving both their password fields on the page at once, which
  // reads as a sign-up all over again.
  const besideAPassword = (el: any) => {
    for (let box = el.parentElement, depth = 0; box && depth < 6; box = box.parentElement, depth++) {
      if (box.querySelector('input[type=password]')) return true;
    }
    return false;
  };
  const el: any = matches.find(besideAPassword) || matches[0];
  el?.click();
  return Boolean(el);
}

/**
 * On a registration page: fills the account name, every password box and any
 * name the page asks for, ticks only what it marks required, and submits.
 *
 * Deliberately apart from the form-filling path. That one remembers answers on
 * the profile so the next employer need not ask again, and a password must
 * never travel that way.
 */
export function signUp({ username, password, fullName }: any): any {
  const visible = (el: any) => el.getClientRects().length > 0;
  const boxes: any[] = [...document.querySelectorAll('input[type=password]')].filter(visible);
  if (!boxes.length) return false;
  const scope: any = boxes[0].closest('form') || document;
  const inputs: any[] = [...scope.querySelectorAll('input')].filter(visible);
  const setValue = (el: any, value: string) => {
    // React keeps its own copy of the value, so go through the native setter.
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!.call(el, value);
    for (const type of ['input', 'change', 'keyup']) el.dispatchEvent(new Event(type, { bubbles: true }));
  };
  const describe = (el: any) =>
    `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder} ${el.labels?.[0]?.innerText || ''}`;

  // Every password box takes the same value: the later ones are confirmations.
  for (const box of boxes) setValue(box, password);

  const first = String(fullName || '').split(' ')[0] || '';
  const rest = String(fullName || '').split(' ').slice(1).join(' ') || first;
  let wholeNameDone = false;
  for (const el of inputs) {
    if (!['text', 'email', 'tel'].includes(el.type) || el.readOnly || el.disabled) continue;
    const about = describe(el);
    if (/e-?mail|user ?name|login/i.test(about)) setValue(el, username);
    else if (!fullName) continue;
    else if (/first ?name|given ?name/i.test(about)) setValue(el, first);
    else if (/last ?name|surname|family ?name/i.test(about)) setValue(el, rest);
    else if (/full ?name|^\s*name\s*$/i.test(about) && !wholeNameDone) {
      setValue(el, fullName);
      wholeNameDone = true;
    }
  }

  // Tick what the page marks required and nothing else. An optional box here
  // is a mailing list the user never asked to join.
  for (const el of inputs) {
    if (el.type !== 'checkbox') continue;
    if (!(el.required || el.getAttribute('aria-required') === 'true')) continue;
    if (!el.checked) el.click();
  }

  const button: any = scope.querySelector('button[type=submit], input[type=submit]')
    || [...scope.querySelectorAll('button, [role="button"]')].find((el: any) =>
      visible(el) && /^(create( an| my)? account|sign ?up|register|continue|submit)$/i.test(String(el.innerText || '').trim()));
  if (!button) return false;
  button.click();
  return true;
}

/** True when the page is a bot check standing in front of the form. */
export function hasCaptchaWall(): any {
  return [...document.querySelectorAll('iframe')].some((frame: any) =>
    /captcha|challenges\.cloudflare|recaptcha|hcaptcha/i.test(frame.src) && frame.getBoundingClientRect().height > 100);
}

/**
 * True when the site refused the visit outright instead of serving the page.
 * Naukri answers an automated browser with an Akamai "Access Denied" page, and
 * calling that "no application form" reads as though the job were closed.
 * A page that still offers fields is a real page, whatever its wording.
 */
export function blockedWall(): any {
  const text = (document.body?.innerText || '').slice(0, 800);
  return /access denied|you don'?t have permission to access|request (was )?blocked|unusual traffic|automated (access|traffic)|bot detected|forbidden/i.test(text)
    && !document.querySelector('input:not([type=hidden]), textarea, select');
}

/**
 * On a job posting without a form: returns the address its Apply link goes
 * to, or clicks an Apply button and returns 'clicked'. Null when there is none.
 * With `peek` it only reports whether such a link is there.
 */
export function followApplyLink(peek?: boolean): any {
  // The same elements the sign-in switch looks at: a site that draws its Apply
  // control as a div with a button role is still offering an Apply.
  const el: any = [...document.querySelectorAll('a, button, [role="button"]')].find((candidate: any) =>
    candidate.getClientRects().length > 0
    && /^(apply|apply now|apply here|apply manually|easy apply|apply for this (job|role|position)|i.?m interested)$/i.test(String(candidate.innerText || '').trim()));
  if (!el) return null;
  if (peek) return 'present';
  if (el.tagName === 'A' && /^https?:/.test(el.href)) return el.href;
  el.click();
  return 'clicked';
}

/**
 * The address of the page's own sign-in link, or null. Used on job boards
 * where the Apply button does nothing for a visitor who is not signed in.
 */
export function signInLink(): any {
  const el: any = [...document.querySelectorAll('a')].find((candidate: any) =>
    candidate.getClientRects().length > 0 && /^https?:/.test(candidate.href)
    && /^(sign in|log in|login|sign in to apply|log in to apply)$/i.test(String(candidate.innerText || '').trim()));
  return el ? el.href : null;
}

/** What the page shows after the submit click. */
export function readOutcome(): any {
  const text = document.body?.innerText || '';
  const visible = (el: any) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const challenge = 'iframe[src*="recaptcha"][src*="bframe"], iframe[src*="hcaptcha"][src*="challenge"], iframe[src*="challenges.cloudflare"]';
  return {
    formGone: !document.querySelector('[data-pb-field]'),
    // The last alternative is how Google Forms and Microsoft Forms word it;
    // employers post whole applications to both.
    confirmed: /thank you for applying|thanks for applying|application (has been |was )?(received|submitted)|received your application|successfully (applied|submitted)|your response (has been recorded|was (submitted|received))/i.test(text)
      || /thank|confirm|success/i.test(location.pathname),
    captcha: [...document.querySelectorAll(challenge)].some((frame: any) => visible(frame) && frame.getBoundingClientRect().height > 100),
    needsCode: /(security|verification) code/i.test(text),
    errors: [...new Set([...document.querySelectorAll('[role="alert"], [class*="error" i]')]
      .filter(visible).map((el: any) => String(el.innerText || '').trim().slice(0, 200)).filter(Boolean))].slice(0, 5),
  };
}

// ---- End of in-page functions.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when `host` is the job link's host or another name on the same site
 * (careers.ibm.com and login.ibm.com). Numeric addresses only match exactly.
 */
export function sameSite(host: string, jobUrl: string): boolean {
  let jobHost = '';
  try { jobHost = new URL(jobUrl).hostname.toLowerCase(); } catch { return false; }
  host = host.toLowerCase();
  if (!host || !jobHost) return false;
  if (host === jobHost) return true;
  if (/^[\d.]+$|:/.test(host) || /^[\d.]+$|:/.test(jobHost)) return false;
  const site = (name: string) => {
    const labels = name.split('.');
    // "example.co.in": under a two-letter country code, a generic second
    // level is shared by everyone, so the site is one label deeper.
    const deep = labels.length >= 3 && labels[labels.length - 1].length === 2
      && /^(co|com|org|net|gov|edu|ac)$/.test(labels[labels.length - 2]);
    return labels.slice(deep ? -3 : -2).join('.');
  };
  return site(host) === site(jobHost);
}

/**
 * Whether a saved login may be typed on a sign-in page: only over a secure
 * connection, and only on the job link's own site. Where a page sends the
 * browser is its choice; where a password goes is not.
 */
export function loginPageAllowed(protocol: string, host: string, jobUrl: string): boolean {
  const local = host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
  return (protocol === 'https:' || local) && sameSite(host, jobUrl);
}
const failed = (message: string): ApplyResult => ({ status: 'failed', message });

/** Opens a custom dropdown and returns its choices: by arrow key first, by click if that shows nothing. */
async function openDropdown(page: Page, id: number): Promise<string[]> {
  if (!(await page.evaluate(focusField, id))) return [];
  await press(page, 'ArrowDown', 40);
  await sleep(350);
  let options: string[] = await page.evaluate(openOptions, id);
  if (!options.length) {
    await page.evaluate(clickField, id);
    await sleep(350);
    options = await page.evaluate(openOptions, id);
  }
  return options;
}

async function press(page: Page, key: string, keyCode: number) {
  for (const type of ['keyDown', 'keyUp']) {
    await page.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: keyCode });
  }
}

/**
 * Opens the form, fills it and (when `submit` is set) submits it. Returns
 * 'submitted' only when the site itself shows a confirmation.
 */
export async function runApplication(page: Page, options: {
  url: string;
  profile: ApplicantProfile;
  saved: Record<string, string>;
  resume: { name: string; base64: string };
  submit: boolean;
  /**
   * Looks up the login the user saved for one sign-in address. Called only
   * when the browser is on a sign-in page at that address, so a login is never
   * fetched for, or typed on, any other.
   */
  loginFor?: (host: string) => Promise<{ username: string; password: string } | null>;
  /**
   * Opens an account on a sign-in address the user has none for, when the page
   * in front of us is a registration form. Returns the login to register with,
   * or null to stop and ask the user instead.
   *
   * The caller must store the password before returning it. The account exists
   * from the moment the form is submitted, so a password kept only in memory
   * is one a crash turns into an account nobody can get back into.
   */
  registerAs?: (host: string) => Promise<{ username: string; password: string } | null>;
  /**
   * Called just before the Submit button is pressed. From this point the
   * application may reach the employer even if nothing after it is observed,
   * so the caller should record that a submission was attempted.
   */
  onSubmitting?: () => Promise<void>;
  /**
   * Optional: answers questions the profile cannot, from the resume. Returns
   * answers by question key; anything it leaves out is asked of the user.
   */
  infer?: (questions: Question[]) => Promise<Record<string, string>>;
}): Promise<ApplyResult> {
  // A hosted worker is cut off without warning when it runs too long, which
  // leaves an application in no state at all. Stopping ourselves first turns
  // that into an answer the user can act on.
  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > 110_000;

  await page.send('Page.navigate', { url: applyUrl(options.url) });

  // The form is drawn by script: wait until its field count stops changing.
  const settle = async () => {
    let seen = { count: 0, shape: '' };
    for (let attempt = 0, stable = 0; attempt < 40 && stable < 3; attempt++) {
      await sleep(500);
      const next = await page.evaluate(fieldShape).catch(() => ({ count: 0, shape: '' }));
      stable = next.count > 1 && next.shape === seen.shape ? stable + 1 : 0;
      seen = next;
      // A page with no form but an Apply link or a sign-in box has shown what
      // it is; waiting the full time for fields that will not come costs 20s.
      if (seen.count < 2 && attempt >= 3 && attempt % 2 === 1) {
        const landed = (await page.evaluate(followApplyLink, true).catch(() => null))
          || (await page.evaluate(loginStage).catch(() => ''));
        if (landed) break;
      }
    }
    // One full scan once the page has stopped changing, rather than one per poll.
    return await page.evaluate(scanForm).catch(() => []) as FormField[];
  };
  // How many filled-in questions make a page an application rather than a
  // newsletter box, when it offers no resume upload to go by.
  const QUESTIONNAIRE_FIELDS = 5;
  const takesResume = (found: FormField[]) => found.some((field) => field.type === 'file');
  let fields = await settle();
  // A page is an application form if it takes a resume, or if it is an early
  // page of a longer form (a few fields and a Next button). In the second
  // case nothing is submitted unless a later page did take the resume.
  const isForm = async () => {
    if (takesResume(fields)) return true;
    // A registration page asks for an email, a name and a couple of consents,
    // which counts up like a questionnaire. No employer asks for a password on
    // an application form, so a password box settles it: this is a way in, not
    // the application, and it must not be filled in as one.
    if (await page.evaluate(() => Boolean([...document.querySelectorAll('input[type=password]')]
      .find((el: any) => el.getClientRects().length > 0))).catch(() => false)) return false;
    if (fields.length < 3) return false;
    const { kind } = await page.evaluate(findAction).catch(() => ({ kind: '' }));
    if (kind === 'next') return true;
    // Google and Microsoft Forms carry a whole application with no resume box
    // and a button that says Submit; employers post straight to them. A search
    // bar or a newsletter signup never runs to this many fields.
    return kind === 'submit' && fields.length >= QUESTIONNAIRE_FIELDS;
  };
  // Every site goes through the same engine. Greenhouse and Lever open
  // straight on their form; anywhere else there may be an Apply button or a
  // sign-in first, and the largest form on a page could be a search box or a
  // newsletter signup, so an application form is the one that takes a resume.
  const strict = !['greenhouse', 'lever'].includes(detectPlatform(options.url));

  if (strict) {
    const stageOf = (): Promise<string> => page.evaluate(loginStage).catch(() => '');
    const whereNow = (): Promise<{ host: string; protocol: string }> =>
      page.evaluate(() => ({ host: location.hostname, protocol: location.protocol })).catch(() => ({ host: '', protocol: '' }));
    const noSignInForm = failed('We could not find the sign-in form on this site.');
    // Employers post the job on their careers site and hand the application to
    // a hiring system on another domain: hitachienergy.com sends applicants to
    // hitachi.wd1.myworkdayjobs.com. A sign-in there counts as part of this
    // job, but only because a page the job link vouches for linked to it, and
    // only for the address that was linked. Where a sign-in turns up on an
    // address nothing linked to, reached by a redirect of its own, the password
    // is still withheld.
    const sentOnTo: string[] = [];
    const ownSite = (protocol: string, host: string) =>
      loginPageAllowed(protocol, host, options.url)
      || sentOnTo.some((vouched) => loginPageAllowed(protocol, host, `https://${vouched}/`));
    const askForLogin = (site: string, rejected: boolean): ApplyResult => {
      // Every path that would ask the user for a login comes through here, so
      // the refusal belongs here rather than beside one of them. Guarding only
      // the sign-in inside the walk left the one after it open, and that is
      // the one a job on a Google Form reached.
      if (isProviderLoginHost(site)) {
        const named = providerName(site);
        return failed(`This job is behind a ${named} sign-in. We never use your ${named} account on your behalf, so please apply from the job link yourself. Your tailored resume is ready.`);
      }
      return {
        status: 'needs_login',
        site,
        message: rejected
          ? `${site} did not accept the sign-in we have for you, or asked for a step we cannot do. Check the details and try again.`
          : `${site} only takes applications from a signed-in account.`,
      };
    };

    // Between the job link and the form there may be an Apply button, a
    // sign-in page, or both. Take up to six such steps.
    let signedIn = false;
    let lastApply = ''; // what the previous Apply step did: an address it went to, or 'clicked'
    let followedSignIn = false;
    for (let step = 0; step < 6 && !(await isForm()); step++) {
      let stage = await stageOf();
      // A sign-in page may show only a row of providers to choose from, with
      // no box to type in yet. Opening its own email sign-in brings up the one
      // form we can fill; the other providers are left alone.
      if (!stage && await page.evaluate(openEmailSignIn).catch(() => false)) {
        await sleep(2000);
        stage = await stageOf();
      }
      if (stage) {
        const page1 = await whereNow();
        if (!ownSite(page1.protocol, page1.host)) {
          return failed("The sign-in page is not on the job link's own secure site, so your login was not entered there.");
        }
        // askForLogin refuses these too, but this has to stand here as well:
        // without it a login already saved for one of these hosts would be
        // fetched from the vault and typed before anyone was asked anything.
        // Checked after the chain of trust, because this is the case the chain
        // of trust gets wrong - a job on a Google Form makes
        // accounts.google.com the job's own site.
        if (isProviderLoginHost(page1.host)) {
          const named = providerName(page1.host);
          return failed(`This job is behind a ${named} sign-in. We never use your ${named} account on your behalf, so please apply from the job link yourself. Your tailored resume is ready.`);
        }
        // One attempt per run: a sign-in page that comes back means it was refused.
        const login = signedIn ? null : await options.loginFor?.(page1.host);
        if (!login) {
          // Nothing saved for this address. Where what stands in front of us is
          // itself a registration form, and the user has allowed it, open an
          // account instead of stopping. A sign-in page that merely offers a
          // "Create account" link is not this case, and still goes to the user.
          const made = !signedIn && stage === 'signup' ? await options.registerAs?.(page1.host) : null;
          if (!made) return askForLogin(page1.host, signedIn);
          if (!(await page.evaluate(signUp, { ...made, fullName: options.profile.fullName }))) return noSignInForm;
          signedIn = true;
          lastApply = '';
          await sleep(4000);
          fields = await settle();
          continue;
        }

        if (stage === 'signup') {
          await page.evaluate(openSignIn);
          await sleep(1500);
          stage = await stageOf();
        }
        if (stage === 'identifier') {
          if (!(await page.evaluate(enterIdentifier, login.username))) return noSignInForm;
          // The password box arrives on the next page, or never if the name is not recognised.
          for (let attempt = 0; attempt < 24 && stage !== 'password'; attempt++) {
            await sleep(500);
            stage = await stageOf();
          }
          if (stage !== 'password') return askForLogin(page1.host, true);
          // The login was saved for one address, so the password goes nowhere else.
          if ((await whereNow()).host !== page1.host) {
            return failed('This site moves its sign-in to another address partway through, so your password was not entered.');
          }
        }
        // Still on a registration page: two password boxes, one of them a
        // confirmation. Opening an account commits the user to that employer's
        // terms under their own name, so it is theirs to do, not ours.
        if (stage === 'signup') {
          return failed(`${page1.host} asks for an account to be created before you can apply, and only you can do that. Create one there, save that login here, and we will carry on.`);
        }
        if (stage !== 'password' || !(await page.evaluate(signIn, login))) return noSignInForm;
        signedIn = true;
        lastApply = '';
        await sleep(4000);
      } else if (lastApply === 'clicked') {
        // The Apply button was pressed and brought up neither a form nor a
        // sign-in page. On a job board that means "sign in first": follow the
        // page's own sign-in link, once.
        const signIn = followedSignIn ? null : await page.evaluate(signInLink).catch(() => null);
        if (!signIn) break;
        followedSignIn = true;
        lastApply = '';
        await page.send('Page.navigate', { url: signIn });
      } else {
        // Probably the job posting: follow its Apply link and look again.
        const next = await page.evaluate(followApplyLink).catch(() => null);
        if (!next) break;
        lastApply = next;
        if (next !== 'clicked') {
          // The employer's own page sending the applicant on to its hiring
          // system vouches for that one address, and for nothing it redirects
          // to afterwards.
          try { sentOnTo.push(new URL(next).hostname); } catch { /* not an address */ }
          await page.send('Page.navigate', { url: next });
        }
      }
      fields = await settle();
    }
    if (!(await isForm()) && await stageOf()) return askForLogin((await whereNow()).host, signedIn);
    if (!(await isForm()) && signedIn && await page.evaluate(asksForCode).catch(() => false)) {
      return failed('The site asked for a verification code after sign-in. Only you can enter that, so please finish this application on the site.');
    }
    if (!(await isForm()) && await page.evaluate(hasCaptchaWall).catch(() => false)) {
      return failed('This site puts a captcha in front of its application form, so we cannot fill it for you.');
    }
    if (!(await isForm()) && await page.evaluate(blockedWall).catch(() => false)) {
      return failed(`${(await whereNow()).host || 'This site'} refuses visits it thinks are automated, so this application has to be made by you. Your tailored resume is ready.`);
    }
    if (!(await isForm())) {
      // Said last, because a page that offers a provider usually offers its own
      // email sign-in too, and that one has already been tried by here.
      const provider = await page.evaluate(providerOnlyWall).catch(() => '');
      if (provider) {
        return failed(`${(await whereNow()).host || 'This site'} only lets you sign in with ${provider}, and we never use your ${provider} account on your behalf. Please apply from the job link yourself. Your tailored resume is ready.`);
      }
      return failed('No application form was found at the job link.');
    }
  }
  if (fields.length < 2) return failed('No application form was found at the job link. The job may be closed.');

  // Fills the given fields, or returns the questions that block it. Nothing is
  // typed into the form while any required answer is missing.
  const fillIn = async (targets: FormField[], resume: unknown) => {
    // A custom dropdown only lists its choices while it is open.
    for (const field of targets.filter((candidate) => candidate.type === 'combobox')) {
      field.options = await openDropdown(page, field.id);
      await press(page, 'Escape', 27);
      // A menu that ignores Escape closes when its field is clicked again.
      if ((await page.evaluate(openOptions, field.id)).length) await page.evaluate(clickField, field.id);
    }

    let plan = planFill(targets, options.profile, options.saved);
    if (plan.missing.length && options.infer) {
      const inferred = await options.infer(plan.missing).catch(() => ({}));
      // The user's own saved answers always win over inferred ones.
      plan = planFill(targets, options.profile, { ...inferred, ...options.saved });
    }
    if (plan.missing.length) return { ...plan, resumeAttached: false };

    const { resumeAttached } = await page.evaluate(fillForm, { fills: plan.fills, resume });
    for (const fill of plan.fills.filter((candidate) => candidate.type === 'combobox')) {
      await openDropdown(page, fill.id);
      if (await page.evaluate(pickOpenOption, { id: fill.id, value: fill.value })) continue;
      // ponytail: an autocomplete (city search) lists nothing until typed into,
      // so type and take its first suggestion. Match the suggestion text if
      // wrong cities show up.
      await page.send('Input.insertText', { text: fill.value });
      await sleep(1500);
      await press(page, 'Enter', 13);
      await sleep(300);
    }
    return { ...plan, resumeAttached };
  };

  const allFills: Fill[] = [];
  let resumeAttached = false;
  let scan = fields;
  let action = { kind: '', disabled: false };
  const signature = (found: FormField[]) => found.map((field) => field.type + ' ' + field.label).join('|');
  const filledSoFar = () => Object.fromEntries(allFills.map((fill) => [fill.label, fill.value]));
  // A form may keep its button off until a consent box is ticked. Consent is
  // the user's to give, so the unticked boxes are asked, never ticked for them.
  const unticked = (): Question[] => {
    const answered = new Set(allFills.map((fill) => answerKey(fill.label)));
    return scan
      .filter((field) => field.type === 'checkbox' && field.label && !answered.has(answerKey(field.label)))
      .map((field) => ({ key: answerKey(field.label), label: field.label, type: field.type, options: [] }));
  };
  const blockedButton = (): ApplyResult => {
    const boxes = unticked();
    if (!boxes.length) return failed('The form would not let the application go on: its button stayed switched off.');
    return { status: 'needs_input', questions: boxes, fields: scan };
  };

  // A form may run over several pages: fill each, press Next, and stop at the
  // page that has Submit.
  for (let pageNumber = 1; ; pageNumber++) {
    const first = await fillIn(fields, resumeAttached ? null : options.resume);
    if (first.missing.length) return { status: 'needs_input', questions: first.missing, fields };

    // Some forms add fields once earlier ones are answered (pick a degree, get
    // a college list): look once more and handle only what is new.
    await sleep(600);
    // A text box that turned into a dropdown counts as new, so the kind is part of the key.
    const seen = new Set(fields.map((field) => field.type + ' ' + answerKey(field.label)));
    scan = await page.evaluate(scanForm).catch(() => fields);
    const added = scan.filter((field) => field.type !== 'file' && !seen.has(field.type + ' ' + answerKey(field.label)));
    const second = await fillIn(added, null);
    if (second.missing.length) return { status: 'needs_input', questions: second.missing, fields: scan };
    allFills.push(...first.fills, ...second.fills);

    if (!resumeAttached && takesResume(fields)) {
      if (first.resumeAttached) resumeAttached = true;
      else if (fields.some((field) => field.type === 'file' && field.required)) return failed('The resume could not be attached to the form.');
    }

    // A page that took nothing from us is not an application form. A closed
    // posting often redirects to the employer's job board, whose own search box
    // and filter dropdowns scan as fields and would otherwise reach review with
    // an empty application.
    if (!allFills.length && !resumeAttached) {
      return failed('No application form was found at the job link. The job may be closed.');
    }

    action = await page.evaluate(findAction).catch(() => ({ kind: '', disabled: false }));
    if (!options.submit) {
      return {
        status: 'dry_run',
        filled: filledSoFar(),
        answers: Object.fromEntries(allFills.map((fill) => [answerKey(fill.label), fill.value])),
        consents: unticked(),
        fields: scan,
        resumeAttached,
        message: action.kind === 'next' ? 'Stopped at the Next button; later pages were not opened.' : undefined,
      };
    }
    if (action.kind !== 'next') break;
    if (pageNumber >= 8) return failed('This form has more pages than we can walk through.');
    if (outOfTime()) {
      return failed(`This form was still on page ${pageNumber} when we ran out of time. Nothing was sent. Your tailored resume is ready: finish it on the employer's page.`);
    }
    if (action.disabled) return blockedButton();

    // Messages already on the page are not about this click.
    const before: string[] = (await page.evaluate(readOutcome).catch(() => null))?.errors || [];
    const here = (await page.evaluate(fieldShape).catch(() => ({ shape: '' }))).shape;
    await page.evaluate(pressAction);
    let moved = false;
    for (let attempt = 0; attempt < 30 && !moved; attempt++) {
      await sleep(700);
      // Polling with the cheap shape, not a full scan: a page that will not move
      // otherwise costs thirty whole-document walks before we give up on it.
      const now = await page.evaluate(fieldShape).catch(() => null);
      if (!now) continue; // the page is loading
      if (now.shape !== here) { moved = true; break; }
      // The page is unchanged, so look for a rejection message, but not on every
      // pass: reading the outcome means reading the whole page text.
      if (attempt > 4 && attempt % 3 === 0) {
        const fresh = ((await page.evaluate(readOutcome).catch(() => null))?.errors || []).filter((message: string) => !before.includes(message));
        if (fresh.length) return failed(`Page ${pageNumber} of the form was not accepted: ${fresh.join('; ')}`);
      }
    }
    if (!moved) return failed(`The form did not move on from page ${pageNumber}.`);
    fields = await settle();
  }

  const filled = filledSoFar();
  // On a site we do not know, a form that never took a resume is not sent: it
  // may not be an application form at all. The exception is a questionnaire
  // with no file box anywhere, which is the whole application on Google and
  // Microsoft Forms; the user still approves every answer before it goes.
  const questionnaire = !takesResume(fields) && fields.length >= QUESTIONNAIRE_FIELDS;
  if (strict && !resumeAttached && !questionnaire) {
    return failed('This form never asked for a resume, so it was not sent.');
  }
  if (!action.kind) return failed('No submit button was found on the form.');
  if (action.disabled) return blockedButton();

  await sleep(2500); // let the site finish uploading the resume
  // Some forms carry "error" styling before anything is sent; only messages
  // that appear after the click are about this application.
  const before: string[] = (await page.evaluate(readOutcome).catch(() => null))?.errors || [];
  await options.onSubmitting?.();
  await page.evaluate(pressAction);

  // A refusal is answered from the resume once before the user is troubled.
  let workedItOut = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(750);
    // Evaluation fails while the page is navigating to its confirmation.
    const outcome = await page.evaluate(readOutcome).catch(() => null);
    if (!outcome) continue;
    if (outcome.formGone && outcome.confirmed) return { status: 'submitted', filled, resumeAttached };
    if (outcome.captcha) return failed('The site asked for a captcha, so the application was not sent. Please apply from the job link.');
    if (!outcome.formGone && outcome.needsCode) return failed('The site emailed you a verification code, so the application was not sent. Please finish it from the job link.');
    const fresh = outcome.errors.filter((message: string) => !before.includes(message));
    if (!outcome.formGone && fresh.length && attempt > 5) {
      // Microsoft Forms marks nothing required in its markup - no asterisk, no
      // aria-required, on the question or on the choice group - and only names
      // what is missing once Submit has been pressed. Handing the whole
      // application back at that point wastes everything already filled in, so
      // ask about what is still blank and come back to it.
      const scan: FormField[] = await page.evaluate(scanForm).catch(() => []);
      const blanks = scan.filter((field) =>
        field.type !== 'file' && field.label && !field.answered && !field.filled);
      if (blanks.length) {
        const questions = blanks.map((field) => ({
          key: answerKey(field.label),
          label: field.label,
          type: field.type,
          options: field.options,
        }));
        // Work them out from the resume first. Most of what these forms hold
        // out for - the degree, the branch, the year of passing - the resume
        // already says, and asking the user for what we have been told is the
        // difference between an agent and a form the user fills in twice.
        if (!workedItOut && options.infer) {
          workedItOut = true;
          const inferred = await options.infer(questions).catch(() => ({}));
          const fills: Fill[] = blanks
            .map((field) => ({
              id: field.id,
              type: field.type,
              label: field.label,
              value: String(inferred[answerKey(field.label)] ?? '').trim(),
            }))
            // A guess that is not one of the choices on offer is not an answer.
            .filter((fill, index) => fill.value
              && (!blanks[index].options.length || blanks[index].options.includes(fill.value)));
          if (fills.length) {
            await page.evaluate(fillForm, { fills, resume: null });
            await sleep(1000);
            await page.evaluate(pressAction);
            continue;
          }
        }
        return {
          status: 'needs_input',
          fields: scan,
          questions,
          message: `The form would not take the application until more was filled in: ${fresh.join('; ')}`,
        };
      }
      return failed(`The form did not accept the application: ${fresh.join('; ')}`);
    }
  }
  return {
    status: 'unconfirmed',
    filled,
    message: 'Submit was pressed, but the site did not show a confirmation. The employer may already have your application: check your email for a confirmation before applying again.',
  };
}
