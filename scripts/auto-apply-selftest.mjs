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
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
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

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'auto-apply-fixtures');
const fixture = (name) => pathToFileURL(path.join(fixtures, name)).href;
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
let server; // the local web server behind the sign-in cases
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

  await check('pauses for a required acknowledgement the user has not authorised', { url: fixture('single.html'), saved: { gender: 'Female' } }, (result, sent) => {
    assert.equal(result.status, 'needs_input');
    assert.equal(result.questions[0].type, 'checkbox');
    assert.match(result.questions[0].label, /Allow Example Corp/);
    assert.equal(sent, null);
  });

  await check('submits a single-page form and reads its confirmation', { url: fixture('single.html'), saved: { gender: 'Female', [consent]: 'yes' } }, (result, sent) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.deepEqual(sent, {
      name: 'Asha Verma', email: 'asha.verma@example.com', phone: '9876543210',
      gender: 'Female', resume: 'Asha_Verma_Resume.pdf', consent: true, alerts: false,
    });
  });

  await check('prepares a review without sending: answers, and only the marketing box left open', { url: fixture('single.html'), saved: { gender: 'Male' }, submit: false }, (result, sent) => {
    assert.equal(result.status, 'dry_run');
    assert.equal(result.answers.gender, 'Male');
    assert.equal(result.answers['full name'], 'Asha Verma');
    assert.deepEqual(result.consents.map((box) => box.key), [consent, 'send me job alerts and marketing emails about other roles']);
    assert.equal(sent, null);
  });

  await check('ticks only the box the user authorised, never the marketing one', { url: fixture('single.html'), saved: { gender: 'Male', [consent]: 'yes' } }, (result, sent) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.equal(sent.consent, true, 'the acknowledgement the user authorised is ticked');
    assert.equal(sent.alerts, false, 'marketing and job alerts are never opted into');
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

  await check('finds application fields that sit outside the page\'s only form', { url: fixture('outside-form.html'), submit: false }, (result, sent) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.equal(result.filled['First name'], 'Asha');
    assert.equal(result.filled['Email address'], 'asha.verma@example.com');
    assert.match(result.message, /Stopped at the Next button/);
    assert.equal(sent, null);
  });

  await check('names a site that refuses automated visits, rather than calling the job closed', { url: fixture('blocked.html'), submit: false }, (result, sent) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /refuses visits it thinks are automated/);
    assert.equal(sent, null);
  });

  await check('calls a job board no application form, instead of offering an empty one', { url: fixture('board.html'), submit: false }, (result, sent) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /No application form was found/);
    assert.equal(sent, null);
  });

  await check('submits a hosted questionnaire that has no resume box', { url: fixture('questionnaire.html') }, (result, sent) => {
    assert.equal(result.status, 'submitted', result.message);
    assert.deepEqual(sent, {
      name: 'Asha Verma', email: 'asha.verma@example.com', phone: '+91 98765 43210',
      location: 'Hyderabad', linkedin: '', college: '',
    });
  });

  await check('reviews a hosted questionnaire without sending it', { url: fixture('questionnaire.html'), submit: false }, (result, sent) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.equal(result.answers['1 full name'], 'Asha Verma');
    assert.equal(result.resumeAttached, false);
    assert.equal(sent, null);
  });

  // ---- Sign-in. These pages are served over HTTP so that each has a real
  // address: the careers site, its sign-in on another name of the same site,
  // and a sign-in on an unrelated site. Chrome resolves every *.localhost
  // name to this machine.
  const typed = []; // everything any sign-in page received, in order
  server = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/record') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => { typed.push(JSON.parse(body)); response.end('ok'); });
      return;
    }
    try {
      const name = path.basename(new URL(request.url, 'http://localhost').pathname);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(readFileSync(path.join(fixtures, name)));
    } catch {
      response.statusCode = 404;
      response.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const careers = `careers.example.localhost:${port}`;
  const signInHost = 'login.example.localhost';
  const gated = (idp = `${signInHost}:${port}`, extra = '') =>
    `http://${careers}/sso.html?view=job&idp=${encodeURIComponent(idp)}&home=${encodeURIComponent(careers)}${extra}`;
  const goodLogin = { username: 'asha@example.com', password: 'correct horse' };
  // Stands in for the vault: logins by sign-in address, and a note of every address asked about.
  const vault = (saved) => {
    const asked = [];
    return { asked, loginFor: async (host) => { asked.push(host); return saved[host] || null; } };
  };
  const signInCheck = async (name, run, verify) => {
    typed.length = 0;
    await check(name, { submit: false, ...run }, verify);
  };

  await signInCheck('stops at a sign-in page it has no login for, and types nothing', { url: gated() }, (result) => {
    assert.equal(result.status, 'needs_login');
    assert.equal(result.site, signInHost);
    assert.deepEqual(typed, []);
  });

  let store = vault({ [signInHost]: goodLogin });
  await signInCheck('signs in over two pages with the saved login and reaches the form', {
    url: gated(), saved: { gender: 'Male' }, loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.equal(result.answers['full name'], 'Asha Verma');
    assert.deepEqual(store.asked, [signInHost]);
    assert.deepEqual(typed, [
      { host: signInHost, step: 'identifier', value: 'asha@example.com' },
      { host: signInHost, step: 'password', value: 'correct horse' },
    ]);
  });

  store = vault({ [signInHost]: goodLogin });
  await signInCheck('opens the site\'s own email sign-in when the page only offers providers', {
    url: gated(undefined, '&next=providers'), saved: { gender: 'Male' }, loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.equal(result.answers['full name'], 'Asha Verma');
    // Apple and Google were left alone; only the password page was ever typed into.
    assert.deepEqual(typed, [{ host: signInHost, step: 'password', value: 'correct horse' }]);
  });

  // A security boundary, not a nicety: signing in with Google would hand over
  // the account holding the user's mail, their files and everything else they
  // have ever signed into with it, to reach one job application.
  store = vault({ [signInHost]: goodLogin });
  await signInCheck('names the provider a site insists on, and presses none of them', {
    url: gated(undefined, '&next=providers-only'), saved: { gender: 'Male' }, loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /only lets you sign in with Google/i);
    assert.deepEqual(typed, []);
    // No login was even looked up: there was nowhere ours to put it.
    assert.deepEqual(store.asked, []);
  });

  // Some sites take applications only from an account, and offer no way in
  // but to open one. The password is the worker's to make and to keep; the
  // user's own password is never part of it.
  store = vault({});
  let opened = null;
  await signInCheck('opens an account where the site has none, and leaves the mailing list alone', {
    url: gated(undefined, '&next=signup'), saved: { gender: 'Male' }, loginFor: store.loginFor,
    registerAs: async (host) => {
      opened = host;
      return { username: 'asha@example.com', password: 'Aa1!a-long-generated-secret' };
    },
  }, (result) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.equal(opened, signInHost);
    assert.equal(typed.length, 1);
    const [entry] = typed;
    assert.equal(entry.step, 'signup');
    assert.equal(entry.value, 'asha@example.com');
    // Both password boxes got the same value, and it was not a short one.
    assert.equal(entry.matched, true);
    assert.equal(entry.name, 'Asha Verma');
    // The term the form requires is accepted; the mailing list beside it is not.
    assert.equal(entry.terms, true);
    assert.equal(entry.news, false);
  });

  // With registration switched off the run stops and asks, rather than
  // signing the user up to anything on their behalf.
  store = vault({});
  await signInCheck('stops at a registration form when opening accounts is off', {
    url: gated(undefined, '&next=signup'), loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'needs_login');
    assert.deepEqual(typed, []);
  });

  store = vault({ [signInHost]: { ...goodLogin, password: 'wrong' } });
  await signInCheck('asks the user to update a login the site refuses, after one try', { url: gated(), loginFor: store.loginFor }, (result) => {
    assert.equal(result.status, 'needs_login');
    assert.equal(result.site, signInHost);
    assert.match(result.message, /did not accept/);
    assert.equal(typed.filter((entry) => entry.step === 'password').length, 1);
  });

  store = vault({ [signInHost]: { username: 'nobody@example.com', password: 'correct horse' } });
  await signInCheck('never types the password when the account name is not recognised', { url: gated(), loginFor: store.loginFor }, (result) => {
    assert.equal(result.status, 'needs_login');
    assert.match(result.message, /did not accept/);
    assert.deepEqual(typed.map((entry) => entry.step), ['identifier']);
  });

  store = vault({ [`careers.example.localhost`]: goodLogin });
  await signInCheck('does not use a login saved for a different address', { url: gated(), loginFor: store.loginFor }, (result) => {
    assert.equal(result.status, 'needs_login');
    assert.deepEqual(store.asked, [signInHost]);
    assert.deepEqual(typed, []);
  });

  // An employer hands the application to a hiring system on another domain,
  // the way hitachienergy.com sends applicants to its Workday. The job page
  // linked there, so the sign-in belongs to this job.
  store = vault({ 'login.other.localhost': goodLogin });
  await signInCheck('signs in on the hiring system the job page sent it to', {
    url: gated(`login.other.localhost:${port}`), saved: { gender: 'Male' }, loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'dry_run', result.message);
    assert.deepEqual(store.asked, ['login.other.localhost']);
    assert.equal(typed.filter((entry) => entry.step === 'password').length, 1);
  });

  // Nothing linked to the third address: the one that was linked forwarded to
  // it on its own, so the password is withheld there.
  store = vault({ 'login.elsewhere.localhost': goodLogin });
  await signInCheck('refuses a sign-in the job page never linked to', {
    url: gated(`login.other.localhost:${port}`, `&next=bounce&to=${encodeURIComponent(`login.elsewhere.localhost:${port}`)}`),
    loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /not on the job link's own secure site/);
    assert.deepEqual(store.asked, []);
    assert.deepEqual(typed, []);
  });

  store = vault({ [signInHost]: goodLogin });
  await signInCheck('hands over to the user when the site asks for a verification code', {
    url: gated(undefined, '&mfa=1'), loginFor: store.loginFor,
  }, (result) => {
    assert.equal(result.status, 'failed');
    assert.match(result.message, /verification code/);
  });
} finally {
  server?.close();
  browser.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(userData, { recursive: true, force: true, maxRetries: 5 });
}
if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
