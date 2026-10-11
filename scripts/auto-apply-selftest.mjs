// Runs the apply engine end to end, submit click included, against the local
// forms in scripts/auto-apply-fixtures. Nothing leaves this machine, so this
// is the place to check the submit path that must never be tried on a real
// employer's form.
//
//   node --experimental-strip-types scripts/auto-apply-selftest.mjs
//
// Set CHROME to the browser binary if it is not in one of the usual places.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openPage } from '../supabase/functions/_shared/cdp.ts';
import { runApplication } from '../supabase/functions/_shared/applyForm.ts';

const CHROME_PATHS = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const chrome = CHROME_PATHS.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error('Chrome not found; set the CHROME environment variable.');

const fixture = (name) => pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'auto-apply-fixtures', name)).href;
const profile = {
  fullName: 'Asha Verma', email: 'asha.verma@example.com', phone: '+91 98765 43210',
  linkedin: '', github: '', location: 'Hyderabad',
};
const resume = { name: 'Asha_Verma_Resume.pdf', base64: Buffer.from('%PDF-1.4\n%self test\n').toString('base64') };
const consent = 'allow example corp to use this data for managing your application';

const userData = mkdtempSync(path.join(tmpdir(), 'apply-selftest-'));
const browser = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userData}`, '--no-first-run',
  '--disable-gpu', '--window-size=1280,1600', '--allow-file-access-from-files', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let failures = 0;
try {
  // Chrome prints the DevTools address on stderr once it is listening.
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome did not start within 30 seconds.')), 30000);
    let output = '';
    browser.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });

  // Each case runs in a fresh tab and may read back what the form received.
  const check = async (name, run, verify) => {
    const page = await openPage(endpoint);
    try {
      const result = await runApplication(page, { profile, resume, saved: {}, submit: true, ...run });
      const sent = await page.evaluate(() => window.__sent || null);
      verify(result, sent);
      console.log(`ok    ${name}`);
    } catch (error) {
      failures++;
      console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').join('\n      ')}`);
    } finally {
      page.close();
    }
  };

  await check('asks for an answer the profile lacks, and sends nothing', { url: fixture('single.html') }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.deepEqual(result.questions.map((question) => question.label), ['Gender']);
    assert.deepEqual(result.questions[0].options, ['Male', 'Female', 'Prefer Not To Say']);
    assert.equal(sent, null);
  });

  await check('asks for consent when the submit button is switched off', { url: fixture('single.html'), saved: { gender: 'Female' } }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.equal(result.questions[0].type, 'checkbox');
    assert.match(result.questions[0].label, /Allow Example Corp/);
    assert.equal(sent, null);
  });

  await check('submits a single-page form and reads its confirmation', { url: fixture('single.html'), saved: { gender: 'Female', [consent]: 'yes' } }, (result, sent) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.deepEqual(sent, {
      name: 'Asha Verma', email: 'asha.verma@example.com', phone: '9876543210',
      gender: 'Female', resume: 'Asha_Verma_Resume.pdf', consent: true,
    });
  });

  await check('prepares a review without sending: answers, and the consent box left for the user', { url: fixture('single.html'), saved: { gender: 'Male' }, submit: false }, (result, sent) => {
    assert.equal(result.status, 'dry_run');
    assert.equal(result.answers.gender, 'Male');
    assert.equal(result.answers['full name'], 'Asha Verma');
    assert.deepEqual(result.consents.map((box) => box.key), [consent]);
    assert.equal(sent, null);
  });

  await check('never ticks a consent box the user did not choose', { url: fixture('single.html'), saved: { gender: 'Male', 'always accept employer terms': 'yes' } }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.equal(sent, null);
  });

  let pressedAt = 0;
  await check('reports the attempt before pressing Submit', {
    url: fixture('single.html'),
    saved: { gender: 'Female', [consent]: 'yes' },
    onSubmitting: async () => { pressedAt += 1; },
  }, (result) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.equal(pressedAt, 1);
  });

  let attempted = false;
  await check('calls a submit with no confirmation uncertain, not failed', {
    url: `${fixture('single.html')}?silent=1`,
    saved: { gender: 'Female', [consent]: 'yes' },
    onSubmitting: async () => { attempted = true; },
  }, (result, sent) => {
    assert.equal(result.status, 'unconfirmed');
    assert.equal(attempted, true);
    assert.match(result.message, /may already have your application/);
    // The employer did receive it: this is why it must not be sent again.
    assert.equal(sent.name, 'Asha Verma');
  });

  let attemptedWithoutAnswers = false;
  await check('does not report an attempt when nothing was pressed', {
    url: fixture('single.html'),
    onSubmitting: async () => { attemptedWithoutAnswers = true; },
  }, (result) => {
    assert.equal(result.status, 'needs_input');
    assert.equal(attemptedWithoutAnswers, false);
  });

  await check('uses an inferred answer only when it is one of the options', {
    url: fixture('single.html'),
    saved: { [consent]: 'yes' },
    infer: async () => ({ gender: 'Robot' }),
  }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.equal(sent, null);
  });

  await check('stops at the Next button in a dry run', { url: fixture('multi.html'), saved: { state: 'Telangana' }, submit: false }, (result, sent) => {
    assert.equal(result.status, 'dry_run');
    assert.match(result.message, /Next button/);
    assert.equal(sent, null);
  });

  await check('walks a multi-page form and submits it', { url: fixture('multi.html'), saved: { state: 'Telangana', 'are you over 18': 'Yes' } }, (result, sent) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.deepEqual(sent, {
      given: 'Asha', family: 'Verma', email: 'asha.verma@example.com',
      country: 'India', state: 'Telangana', adult: 'Yes', resume: 'Asha_Verma_Resume.pdf',
    });
  });

  await check('asks on page 2 before submitting, when its answer is missing', { url: fixture('multi.html'), saved: { state: 'Telangana' } }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.deepEqual(result.questions.map((question) => question.label), ['Are you over 18?']);
    assert.equal(sent, null);
  });

  await check('does not submit an unknown form that never took a resume', { url: `${fixture('multi.html')}?noresume=1`, saved: { state: 'Telangana', 'are you over 18': 'Yes' } }, (result, sent) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /never asked for a resume/);
    assert.equal(sent, null);
  });
} finally {
  browser.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(userData, { recursive: true, force: true, maxRetries: 5 });
}
if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
