// Reads an employer's application form in a real browser, fills it from the
// user's profile, and reports what actually happened. Shared by the
// auto-apply-submit edge function and scripts/auto-apply-dryrun.mjs.
import type { Page } from './cdp.ts';

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
}

export interface Fill { id: number; type: FormField['type']; label: string; value: string }
export interface Question { key: string; label: string; type: FormField['type']; options: string[] }

export interface ApplyResult {
  status: 'submitted' | 'needs_input' | 'unconfirmed' | 'failed' | 'dry_run';
  message?: string;
  questions?: Question[];
  filled?: Record<string, string>;
  fields?: FormField[];
  resumeAttached?: boolean;
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

/** Why we cannot apply on this platform, or null when we can. */
export function unsupportedReason(platform: Platform): string | null {
  // Greenhouse and Lever are dry-run tested against live forms. Any other
  // site is attempted with the same engine, under the extra checks in
  // runApplication (no sign-in wall, and the form must take a resume).
  if (platform === 'greenhouse' || platform === 'lever' || platform === 'other') return null;
  if (platform === 'workday') return 'Workday needs a new account for every company. We cannot create that for you yet, so please apply from the job link.';
  const name = platform[0].toUpperCase() + platform.slice(1);
  return `This job needs you to be signed in to ${name}. We do not sign in to ${name} for you, so please apply from the job link.`;
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
    if (field.type === 'file' || !key) continue;
    let value = saved[key] || profileAnswer(field.label, profile) || '';
    if (field.type === 'checks') value = value.split('|').map((part) => pickOption(field.options, part)).filter(Boolean).join(' | ');
    else if (value && field.options.length) value = pickOption(field.options, value);
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

/** Lists the form's fields and tags each element with data-pb-field so fillForm can find it. */
export function scanForm(): any {
  const root: any = [...document.forms].sort((a, b) => b.elements.length - a.elements.length)[0] || document.body;
  const clean = (text: any) => String(text || '').replace(/[*✱]/g, '').replace(/\s+/g, ' ').trim();
  const starred = (text: any) => /[*✱]/.test(String(text || ''));
  const firstLine = (el: any) => String(el?.innerText || '').trim().split('\n')[0];
  const labelOf = (el: any) => {
    const named = String(el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map((id) => (document.getElementById(id) as any)?.innerText).filter(Boolean).join(' ');
    const wrapper = el.closest('[role="combobox"]');
    let label = named || el.labels?.[0]?.innerText || el.getAttribute('aria-label') || wrapper?.getAttribute('aria-label') || '';
    // No label element: the question is usually the text just above the field.
    // A line without two letters is decoration, such as a "+91" country code.
    const own = el.tagName === 'SELECT' ? [...el.options].map((option: any) => clean(option.text)) : [];
    for (let box = el.parentElement, depth = 0; !label && box && depth < 4; box = box.parentElement, depth++) {
      const line = clean(firstLine(box));
      if (/[a-z].*[a-z]/i.test(line) && !own.includes(line)) label = firstLine(box);
    }
    return label || el.placeholder || el.name || '';
  };

  const fields: any[] = [];
  const groups = new Map();
  for (const el of root.querySelectorAll('input, textarea, select')) {
    // The combobox role sits on the input itself or on a wrapper around it.
    const kind = el.tagName !== 'INPUT' ? el.tagName.toLowerCase() : el.closest('[role="combobox"]') ? 'combobox' : el.type;
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
        group = { id: fields.length, label: '', type: kind === 'radio' ? 'radio' : 'checks', required: false, options: [], first: el };
        groups.set(`${kind} ${el.name}`, group);
        fields.push(group);
      }
      group.options.push(clean(el.labels?.[0]?.innerText || el.value));
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
      required: el.required || el.getAttribute('aria-required') === 'true' || starred(label),
      options: kind === 'select' ? [...el.options].filter((option: any) => option.value).map((option: any) => clean(option.text)) : [],
    });
  }

  // A group's question sits above its options: climb until the first line of
  // text is no longer one of the options.
  for (const group of groups.values()) {
    let box = group.first.parentElement;
    while (box && box !== document.body && group.options.includes(clean(firstLine(box)))) box = box.parentElement;
    group.label = clean(firstLine(box));
    group.required = group.required || starred(firstLine(box));
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
  const list = document.getElementById(el?.getAttribute('aria-controls') || el?.closest('[role="combobox"]')?.getAttribute('aria-controls') || '');
  return list ? [...list.querySelectorAll('[role="option"]')].map((option: any) => String(option.innerText || '').replace(/\s+/g, ' ').trim()) : [];
}

/** Clicks the choice with this text in an open custom dropdown. */
export function pickOpenOption({ id, value }: any): any {
  const key = (text: any) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const el: any = document.querySelector(`[data-pb-field="${id}"]`);
  const list = document.getElementById(el?.getAttribute('aria-controls') || el?.closest('[role="combobox"]')?.getAttribute('aria-controls') || '');
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

/** Presses the form's submit button. Returns 'disabled' when the form keeps it switched off, '' when there is none. */
export function clickSubmit(): any {
  const root: any = document.querySelector('[data-pb-field]')?.closest('form') || document;
  const button = root.querySelector('button[type=submit], input[type=submit]')
    || [...root.querySelectorAll('button')].find((candidate: any) => /submit|apply/i.test(candidate.innerText));
  if (!button) return '';
  if (button.disabled || button.getAttribute('aria-disabled') === 'true') return 'disabled';
  button.click();
  return 'clicked';
}

/** True when the page shows a password box, i.e. it wants a sign-in. */
export function hasPasswordField(): any {
  return [...document.querySelectorAll('input[type=password]')].some((el: any) => el.getClientRects().length > 0);
}

/**
 * On a job posting without a form: returns the address its Apply link goes
 * to, or clicks an Apply button and returns 'clicked'. Null when there is none.
 */
export function followApplyLink(): any {
  const el: any = [...document.querySelectorAll('a, button')].find((candidate: any) =>
    candidate.getClientRects().length > 0
    && /^(apply|apply now|apply here|apply for this (job|role|position)|i.?m interested)$/i.test(String(candidate.innerText || '').trim()));
  if (!el) return null;
  if (el.tagName === 'A' && /^https?:/.test(el.href)) return el.href;
  el.click();
  return 'clicked';
}

/** What the page shows after the submit click. */
export function readOutcome(): any {
  const text = document.body?.innerText || '';
  const visible = (el: any) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const challenge = 'iframe[src*="recaptcha"][src*="bframe"], iframe[src*="hcaptcha"][src*="challenge"], iframe[src*="challenges.cloudflare"]';
  return {
    formGone: !document.querySelector('[data-pb-field]'),
    confirmed: /thank you for applying|thanks for applying|application (has been |was )?(received|submitted)|received your application|successfully (applied|submitted)/i.test(text)
      || /thank|confirm|success/i.test(location.pathname),
    captcha: [...document.querySelectorAll(challenge)].some((frame: any) => visible(frame) && frame.getBoundingClientRect().height > 100),
    needsCode: /(security|verification) code/i.test(text),
    errors: [...new Set([...document.querySelectorAll('[role="alert"], [class*="error" i]')]
      .filter(visible).map((el: any) => String(el.innerText || '').trim().slice(0, 200)).filter(Boolean))].slice(0, 5),
  };
}

// ---- End of in-page functions.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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
   * Optional: answers questions the profile cannot, from the resume. Returns
   * answers by question key; anything it leaves out is asked of the user.
   */
  infer?: (questions: Question[]) => Promise<Record<string, string>>;
}): Promise<ApplyResult> {
  await page.send('Page.navigate', { url: applyUrl(options.url) });

  // The form is drawn by script: wait until its field count stops changing.
  const settle = async () => {
    let found: FormField[] = [];
    for (let attempt = 0, stable = 0; attempt < 40 && stable < 3; attempt++) {
      await sleep(500);
      const next: FormField[] = await page.evaluate(scanForm).catch(() => []);
      stable = next.length > 1 && next.length === found.length ? stable + 1 : 0;
      found = next;
    }
    return found;
  };
  const takesResume = (found: FormField[]) => found.some((field) => field.type === 'file');
  let fields = await settle();

  // An unknown site gets stricter checks, because the largest form on a page
  // could be a search box or a newsletter signup: an application form is the
  // one that takes a resume.
  if (detectPlatform(options.url) === 'other') {
    if (!takesResume(fields)) {
      // Probably the job posting: follow its Apply link once and look again.
      const next = await page.evaluate(followApplyLink).catch(() => null);
      if (next && next !== 'clicked') await page.send('Page.navigate', { url: next });
      if (next) fields = await settle();
    }
    if (await page.evaluate(hasPasswordField).catch(() => false)) {
      return failed('This site asks you to sign in before applying, so the application was not sent.');
    }
    if (!takesResume(fields)) return failed('No application form was found at the job link.');
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

  const first = await fillIn(fields, options.resume);
  if (first.missing.length) return { status: 'needs_input', questions: first.missing, fields };

  // Some forms add fields once earlier ones are answered (pick a degree, get
  // a college list): look once more and handle only what is new.
  await sleep(600);
  // A text box that turned into a dropdown counts as new, so the kind is part of the key.
  const seen = new Set(fields.map((field) => field.type + ' ' + answerKey(field.label)));
  const rescanned: FormField[] = await page.evaluate(scanForm).catch(() => []);
  const added = rescanned.filter((field) => field.type !== 'file' && !seen.has(field.type + ' ' + answerKey(field.label)));
  const second = await fillIn(added, null);
  if (second.missing.length) return { status: 'needs_input', questions: second.missing, fields: rescanned };

  const fills = [...first.fills, ...second.fills];
  const resumeAttached = first.resumeAttached;
  const filled = Object.fromEntries(fills.map((fill) => [fill.label, fill.value]));
  if (!resumeAttached && fields.some((field) => field.type === 'file' && field.required)) {
    return failed('The resume could not be attached to the form.');
  }
  if (!options.submit) return { status: 'dry_run', filled, fields, resumeAttached };

  await sleep(2500); // let the site finish uploading the resume
  // Some forms carry "error" styling before anything is sent; only messages
  // that appear after the click are about this application.
  const before: string[] = (await page.evaluate(readOutcome).catch(() => null))?.errors || [];
  const pressed = await page.evaluate(clickSubmit);
  if (!pressed) return failed('No submit button was found on the form.');
  if (pressed === 'disabled') {
    // The form keeps its button off until something else is done, usually a
    // consent box. Consent is the user's to give, so ask instead of ticking it.
    const answered = new Set(fills.map((fill) => answerKey(fill.label)));
    const boxes = rescanned.filter((field) => field.type === 'checkbox' && field.label && !answered.has(answerKey(field.label)));
    if (boxes.length) {
      return {
        status: 'needs_input',
        questions: boxes.map((field) => ({ key: answerKey(field.label), label: field.label, type: field.type, options: [] })),
        fields: rescanned,
      };
    }
    return failed('The form would not let the application be sent: its submit button stayed switched off.');
  }

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
      return failed(`The form did not accept the application: ${fresh.join('; ')}`);
    }
  }
  return {
    status: 'unconfirmed',
    filled,
    message: 'The form was sent, but the site did not show a confirmation. Check your email for one before applying again.',
  };
}
