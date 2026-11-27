// Loads the real browser extension into a real browser and uses it. Nothing here
// presses Next or Submit, so it is safe to point at a live form:
//
//   node --experimental-strip-types scripts/auto-apply-extension-test.mjs
//   node --experimental-strip-types scripts/auto-apply-extension-test.mjs live <google form url>
//
// Set CHROME to a Chromium binary. Branded Chrome ignores --load-extension since
// version 137, so a Playwright Chromium is the easy choice.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from '../supabase/functions/_shared/cdp.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME;
if (!chrome) throw new Error('Set CHROME to a Chromium binary: branded Chrome no longer loads an extension this way.');
const live = process.argv[2] === 'live' ? process.argv[3] : '';

const built = spawnSync(process.execPath, ['node_modules/esbuild/bin/esbuild', 'extension/src/form.ts', '--bundle', '--format=iife', '--target=chrome120', '--outfile=extension/form.js', '--log-level=warning'], { cwd: root, encoding: 'utf8' });
if (built.status !== 0) throw new Error(built.stderr);

const fixture = readFileSync(path.join(root, 'scripts/auto-apply-fixtures/google-form.html'));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  const { pathname } = new URL(request.url, 'http://localhost');
  response.end(pathname.endsWith('/viewform') ? fixture : '<!doctype html><title>PrimoBoost</title>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// A copy, so the fixture can stand in for docs.google.com without the real
// extension ever running on another site.
const extension = mkdtempSync(path.join(tmpdir(), 'extension-'));
cpSync(path.join(root, 'extension'), extension, { recursive: true });
if (!live) {
  const manifest = JSON.parse(readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
  manifest.content_scripts[1].matches = ['http://127.0.0.1/*'];
  writeFileSync(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
}

const userData = mkdtempSync(path.join(tmpdir(), 'extension-test-'));
const browser = spawn(chrome, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userData}`, '--no-first-run', '--disable-gpu',
  `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
const endpoint = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('The browser did not start within 30 seconds.')), 30000);
  let output = '';
  browser.stderr.on('data', (chunk) => {
    output += chunk;
    const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) { clearTimeout(timer); resolve(match[1]); }
  });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const panelText = () => document.querySelector('primoboost-helper')?.shadowRoot.querySelector('.box').innerText ?? null;
const waitFor = async (page, test, ms = 15000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = await page.evaluate(test).catch(() => null);
    if (value) return value;
    await sleep(250);
  }
  throw new Error(`waited ${ms}ms for ${test}`);
};
const opened = async (url) => {
  const page = await openPage(endpoint);
  await page.send('Page.navigate', { url });
  await sleep(1500);
  return page;
};

const prepared = {
  role: 'Software Engineer', company: 'Example Corp', resumeUrl: `${base}/resume.pdf`,
  profile: { fullName: 'Asha Verma', email: 'asha.verma@example.com', phone: '+91 98765 43210', linkedin: '', github: '', location: 'Hyderabad', college: 'Example University' },
  saved: JSON.parse(process.env.SAVED || '{"graduation year":"2028"}'),
};
const prepare = async () => {
  const site = await opened(`${base}/site.html`);
  await site.evaluate((message) => window.postMessage(message, window.location.origin), { source: 'primoboost-site', type: 'prepare', prepared });
  await sleep(400);
  return site;
};
const fill = async (page) => {
  await waitFor(page, () => document.querySelector('primoboost-helper')?.shadowRoot.querySelector('button'));
  await page.evaluate(() => document.querySelector('primoboost-helper').shadowRoot.querySelector('button').click());
  await sleep(1500);
  await waitFor(page, () => /Filled \d+/.test(document.querySelector('primoboost-helper')?.shadowRoot.querySelector('.box').innerText || ''));
};

let failures = 0;
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 6).join('\n      ')}`);
  }
};

try {
  if (live) {
    const site = await prepare();
    const page = await opened(live);
    await fill(page).catch((error) => console.log(error.message.slice(0, 40)));
    console.log(await page.evaluate(panelText));
    console.dir(await page.evaluate(() => ({
      address: location.pathname + location.search.slice(0, 160),
      boxes: [...document.querySelectorAll('input:not([type=hidden]), textarea')].map((el) => el.value).filter(Boolean),
      chosen: [...document.querySelectorAll('[role="radio"][aria-checked="true"], [role="checkbox"][aria-checked="true"]')].map((el) => el.getAttribute('data-value') || el.getAttribute('data-answer-value')),
      dropdowns: [...document.querySelectorAll('[role="listbox"]')].map((el) => el.querySelector('[role="option"][aria-selected="true"]')?.getAttribute('data-value')),
    })), { depth: 3 });
    page.close();
    site.close();
  } else {
    await check('tells the site it is installed', async () => {
      const site = await opened(`${base}/site.html`);
      assert.equal(await waitFor(site, () => document.documentElement.dataset.primoboostExtension), '1');
      site.close();
    });

    await check('stays out of the way when no application was prepared', async () => {
      const page = await opened(`${base}/forms/d/e/1/viewform`);
      await sleep(3500);
      assert.equal(await page.evaluate(panelText), null);
      page.close();
    });

    await check('offers to fill the form, naming the job', async () => {
      const site = await prepare();
      const page = await opened(`${base}/forms/d/e/1/viewform`);
      const text = await waitFor(page, panelText);
      assert.match(text, /Software Engineer at Example Corp/);
      page.close();
      site.close();
    });

    await check('fills from the profile, lists the rest, and leaves Submit to the user', async () => {
      const page = await opened(`${base}/forms/d/e/1/viewform`);
      await fill(page);
      assert.equal(await page.evaluate(() => location.search), '', 'the fixture no longer wipes its address as Google does');
      const search = new URL(await page.evaluate(() => performance.getEntriesByType('navigation')[0].name)).searchParams;
      assert.equal(search.get('entry.101'), 'Asha Verma');
      assert.equal(search.get('entry.102'), 'Example University');
      assert.equal(search.get('entry.103'), '2028');
      assert.equal(search.has('entry.104'), false, 'a question nobody answered was guessed');
      const text = await page.evaluate(panelText);
      assert.match(text, /Filled 3 answers/);
      assert.match(text, /Attach your resume to: Resume/);
      assert.match(text, /Tick the box beside your email/);
      assert.match(text, /press Submit yourself/);
      assert.equal(await page.evaluate(() => window.__sent ?? null), null);
      page.close();
    });

    await check('shows a form\'s words as text, never as markup', async () => {
      const page = await opened(`${base}/forms/d/e/1/viewform?usp=pp_url&entry.101=x`);
      await waitFor(page, panelText);
      assert.equal(await page.evaluate(() => document.querySelector('primoboost-helper').shadowRoot.querySelector('img')), null);
      assert.equal(await page.evaluate(() => window.__hacked ?? null), null);
      assert.match(await page.evaluate(panelText), /<img src=x/);
      page.close();
    });
  }
} finally {
  browser.kill();
  server.close();
  await sleep(500);
  rmSync(userData, { recursive: true, force: true, maxRetries: 5 });
  rmSync(extension, { recursive: true, force: true, maxRetries: 5 });
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
if (!live) console.log('\nall checks passed');
process.exit(0);
