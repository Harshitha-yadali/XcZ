// Fills a live application form in a local Chrome and prints what it did.
// It never clicks submit, so it is safe to point at real job postings.
//
//   node --experimental-strip-types scripts/auto-apply-dryrun.mjs <job url>
//
// Set CHROME to the browser binary if it is not in one of the usual places.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openPage } from '../supabase/functions/_shared/cdp.ts';
import { detectPlatform, runApplication, unsupportedReason } from '../supabase/functions/_shared/applyForm.ts';

const CHROME_PATHS = [
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const url = process.argv[2];
if (!url) throw new Error('Usage: node --experimental-strip-types scripts/auto-apply-dryrun.mjs <job url>');
console.log('platform:', detectPlatform(url), '| blocked:', unsupportedReason(detectPlatform(url)) ?? 'no');

const chrome = CHROME_PATHS.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error('Chrome not found; set the CHROME environment variable.');
const userData = mkdtempSync(path.join(tmpdir(), 'apply-dryrun-'));
const browser = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userData}`, '--no-first-run',
  '--disable-gpu', '--window-size=1280,1600', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

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

  const run = {
    url,
    profile: {
      fullName: 'Asha Verma', email: 'asha.verma@example.com', phone: '+91 98765 43210',
      linkedin: 'https://www.linkedin.com/in/asha-verma', github: 'https://github.com/asha-verma', location: 'Bengaluru',
    },
    saved: {},
    resume: { name: 'Asha_Verma_Resume.pdf', base64: Buffer.from('%PDF-1.4\n%dry run\n').toString('base64') },
    submit: false,
  };

  let page = await openPage(endpoint);
  let result = await runApplication(page, run);
  if (result.status === 'needs_input') {
    console.log('questions the user would be asked:');
    console.dir(result.questions, { depth: 4 });
    // Answer them with placeholders to exercise the fill step as well.
    run.saved = Object.fromEntries(result.questions.map((question) => [
      question.key, question.type === 'checkbox' ? 'yes' : question.type === 'checks' ? question.options.slice(0, 2).join(' | ') : question.options[0] || 'Yes',
    ]));
    page.close();
    page = await openPage(endpoint);
    result = await runApplication(page, run);
  }
  const { fields, ...summary } = result;
  console.log(`fields found: ${fields?.length ?? 0}`);
  console.dir(summary, { depth: 4 });

  // Read the values back from the page: what a recruiter would actually receive.
  console.dir(await page.evaluate(() => [...document.querySelectorAll('[data-pb-field]')].map((el) => ({
    field: el.getAttribute('data-pb-field'),
    value: el.type === 'file' ? [...el.files].map((file) => file.name).join() : el.type === 'radio' || el.type === 'checkbox' ? el.checked : el.value,
    shown: el.getAttribute('role') === 'combobox' ? el.closest('[class*="control"]')?.innerText : undefined,
  }))), { depth: 3, maxArrayLength: 80 });
  page.close();
} finally {
  browser.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(userData, { recursive: true, force: true, maxRetries: 5 });
}
