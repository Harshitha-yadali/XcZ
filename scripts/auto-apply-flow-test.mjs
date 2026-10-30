// Runs the background path of Auto Apply with the real code: the worker as its
// own process and, when Deno is available, the real edge functions. Supabase is
// replaced by a stand-in on this machine, so nothing here can reach production
// or a real employer. scripts/auto-apply-selftest.mjs covers the form engine;
// this covers everything around it, which is where the two halves disagree.
//
//   node --experimental-strip-types scripts/auto-apply-flow-test.mjs
//   node --experimental-strip-types scripts/auto-apply-flow-test.mjs --serve
//
// --serve seeds a few jobs and keeps everything running on port 54399, so the
// real app can be pointed at it:
//
//   VITE_SUPABASE_URL=http://127.0.0.1:54399 VITE_SUPABASE_DIRECT_URL=http://127.0.0.1:54399 \
//   VITE_ENABLE_AUTO_APPLY=true npx vite --port 5199
//
// VITE_SUPABASE_DIRECT_URL is not optional: without it a dev build retries a
// failed request against the production project.
//
// Set DENO to the deno binary to include the edge functions, and CHROME to the
// browser binary if it is not in one of the usual places.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptSecret } from '../supabase/functions/_shared/vault.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = path.join(root, 'scripts', 'auto-apply-fixtures');
const serving = process.argv.includes('--serve');

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

const deno = process.env.DENO || (spawnSync('deno', ['--version']).status === 0 ? 'deno' : '');

const SERVICE_KEY = 'stand-in-service-key';
// 32 bytes of zeroes in base64: the format vault.ts expects, and worth nothing.
const CREDENTIALS_KEY = Buffer.alloc(32).toString('base64');
const USER = { id: '11111111-1111-4111-8111-111111111111', email: 'asha.verma@example.com', aud: 'authenticated', role: 'authenticated' };
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const RESUME = '33333333-3333-4333-8333-333333333333';
const STRANGERS_RESUME = '44444444-4444-4444-8444-444444444444';

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${base64url({ alg: 'none' })}.${base64url({ sub: USER.id, role: 'authenticated', exp: 4102444800 })}.stand-in`;

// ------------------------------------------------------------ the stand-in

const db = {
  user_profiles: [{
    id: USER.id, full_name: 'Asha Verma', email_address: USER.email, phone: '+91 98765 43210', role: 'user',
    linkedin_profile_url: '', github_profile_url: '', current_location: 'Hyderabad', apply_answers: {},
  }],
  user_job_preferences: [{ user_id: USER.id, onboarding_completed: true, resume_text: 'Asha Verma. BTech CSE, 2024. React, TypeScript, Node.js.' }],
  optimized_resumes: [
    {
      id: RESUME, user_id: USER.id, pdf_url: `${USER.id}/resume.pdf`, optimization_score: 82,
      resume_content: { education: [{ school: 'Example University', degree: 'BTech', year: '2024' }], skills: [{ list: ['React', 'TypeScript'] }] },
    },
    { id: STRANGERS_RESUME, user_id: OTHER_USER, pdf_url: `${OTHER_USER}/resume.pdf`, resume_content: {} },
  ],
  job_listings: [],
  user_credentials_vault: [],
  auto_apply_applications: [],
  auto_apply_analytics: [],
};

// Read from the migration, so the stand-in refuses exactly what Postgres refuses.
const migration = readFileSync(path.join(root, 'supabase/migrations/20261027120000_auto_apply_background_worker.sql'), 'utf8');
const STATUSES = [...migration.match(/CHECK \(status IN \(([\s\S]*?)\)\)/)[1].matchAll(/'(\w+)'/g)].map((match) => match[1]);

const history = []; // [application id, status] for every status a row passes through
const received = []; // what employers' forms actually took in
const typed = []; // what the sign-in pages were sent

const violation = (table, row) => {
  if (table !== 'auto_apply_applications') return null;
  if (!STATUSES.includes(row.status)) return { code: '23514', message: `status ${row.status} violates auto_apply_applications_status_check` };
  const taken = row.status !== 'failed' && db[table].some((other) => other.id !== row.id && other.status !== 'failed'
    && other.user_id === row.user_id && other.job_listing_id === row.job_listing_id);
  return taken ? { code: '23505', message: 'duplicate key value violates unique constraint "auto_apply_one_live_application"' } : null;
};

const matches = (row, column, expression) => {
  const [operator, ...rest] = expression.split('.');
  const value = rest.join('.');
  const cell = row[column];
  if (operator === 'eq') return String(cell) === value;
  if (operator === 'neq') return String(cell) !== value;
  if (operator === 'is') return value === 'null' ? cell == null : String(cell) === value;
  if (operator === 'in') return value.slice(1, -1).split(',').map((item) => item.replace(/"/g, '')).includes(String(cell));
  if (operator === 'gte') return String(cell) >= value;
  if (operator === 'lte') return String(cell) <= value;
  return true; // a filter nothing in this flow depends on
};

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const select = (table, query) => {
  let rows = db[table] || [];
  for (const [column, expression] of query) {
    if (NOT_FILTERS.has(column)) continue;
    rows = column === 'or'
      ? rows.filter((row) => expression.slice(1, -1).split(',').some((part) => {
          const [name, ...rest] = part.split('.');
          return matches(row, name, rest.join('.'));
        }))
      : rows.filter((row) => matches(row, column, expression));
  }
  const order = query.get('order');
  if (order) {
    const [column, direction] = order.split('.');
    rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (direction === 'desc' ? -1 : 1));
  }
  return rows;
};

const embed = (table, row, wanted) => {
  if (table !== 'auto_apply_applications' || !wanted?.includes('job_listings')) return row;
  const resume = db.optimized_resumes.find((item) => item.id === row.resume_version_id);
  return {
    ...row,
    job_listings: db.job_listings.find((item) => item.id === row.job_listing_id) ?? null,
    optimized_resumes: resume ? { match_score: resume.optimization_score ?? null, pdf_url: resume.pdf_url } : null,
  };
};

const respond = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  response.end(body === undefined ? undefined : JSON.stringify(body));
};

function rest(request, response, table, query, body) {
  const prefer = request.headers.prefer || '';
  const wantsObject = (request.headers.accept || '').includes('vnd.pgrst.object');

  if (table === 'rpc') return rpc(response, query.path, body);

  if (request.method === 'GET' || request.method === 'HEAD') {
    const rows = select(table, query);
    const offset = Number(query.get('offset') || 0);
    const limit = Number(query.get('limit') || rows.length);
    const page = rows.slice(offset, offset + limit).map((row) => embed(table, row, query.get('select')));
    const range = { 'Content-Range': `${offset}-${offset + page.length - 1}/${rows.length}`, 'Access-Control-Expose-Headers': 'Content-Range' };
    if (!wantsObject) return respond(response, 200, page, range);
    return page.length === 1 ? respond(response, 200, page[0], range) : respond(response, 406, { code: 'PGRST116', message: 'no rows' });
  }

  if (request.method === 'POST') {
    const conflict = query.get('on_conflict')?.split(',');
    const created = [];
    for (const incoming of [body].flat()) {
      const existing = conflict && prefer.includes('merge-duplicates')
        ? db[table].find((row) => conflict.every((column) => row[column] === incoming[column]))
        : null;
      const row = existing
        ? Object.assign(existing, incoming)
        : { id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...incoming };
      const problem = violation(table, row);
      if (problem) return respond(response, problem.code === '23505' ? 409 : 400, problem);
      if (!existing) (db[table] ||= []).push(row);
      if (table === 'auto_apply_applications') history.push([row.id, row.status]);
      created.push(row);
    }
    // PostgREST sends an empty 201 unless the caller asks for the row back.
    if (!prefer.includes('return=representation')) return respond(response, 201);
    return respond(response, 201, wantsObject ? created[0] : created);
  }

  if (request.method === 'PATCH') {
    const rows = select(table, query);
    for (const row of rows) {
      const problem = violation(table, { ...row, ...body });
      if (problem) return respond(response, 400, problem);
    }
    for (const row of rows) {
      const moved = body.status && body.status !== row.status;
      Object.assign(row, body, { updated_at: new Date().toISOString() });
      if (table === 'auto_apply_applications' && moved) history.push([row.id, row.status]);
    }
    if (!prefer.includes('return=representation')) return respond(response, 204);
    return respond(response, 200, wantsObject ? rows[0] : rows);
  }

  if (request.method === 'DELETE') {
    db[table] = (db[table] || []).filter((row) => !select(table, query).includes(row));
    return respond(response, 204);
  }
  return respond(response, 405, { message: 'not supported here' });
}

// The same work as the SQL functions in the worker migration. The SQL itself
// is not exercised here; a stand-in cannot prove anything about Postgres.
function rpc(response, name, body) {
  if (name === 'claim_auto_apply_work') {
    const taken = db.auto_apply_applications
      .filter((row) => row.status === 'queued')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, Math.max(body.batch, 1));
    for (const row of taken) {
      Object.assign(row, { status: 'optimizing_resume', claimed_by: body.worker_id, claimed_at: new Date().toISOString(), attempts: (row.attempts || 0) + 1 });
      history.push([row.id, row.status]);
    }
    return respond(response, 200, taken);
  }
  if (name === 'requeue_stalled_auto_apply') return respond(response, 200, 0);
  return respond(response, 200, null); // the app's own bookkeeping, which this flow does not read
}

const PDF = Buffer.from('%PDF-1.4\n%stand-in\n');
function storage(request, response, pathname, body) {
  // Signing hands back a link; everything else is the one small file.
  if (pathname.endsWith('/object/sign/user-resumes') && request.method === 'POST') {
    return respond(response, 200, body.paths.map((item) => ({
      path: item, error: null, signedURL: `/object/sign/user-resumes/${item}?token=stand-in`,
    })));
  }
  if (pathname.includes('/object/sign/') && request.method === 'POST') {
    return respond(response, 200, { signedURL: `${pathname.replace('/storage/v1', '')}?token=stand-in` });
  }
  if (request.method === 'POST') return respond(response, 200, { Key: pathname, Id: randomUUID(), path: pathname.split('/user-resumes/')[1] });
  response.writeHead(200, { 'Content-Type': 'application/pdf' });
  return response.end(PDF);
}

// The real model is not called: one canned tailored resume answers everything.
const TAILORED = {
  name: 'Asha Verma', phone: '+91 98765 43210', email: USER.email, linkedin: '', github: '', location: 'Hyderabad',
  targetRole: 'Software Engineer', summary: 'Engineer who builds web products with React and Node.js.',
  education: [{ degree: 'BTech CSE', school: 'Example University', year: '2024' }],
  workExperience: [], projects: [{ title: 'Job Tracker', bullets: ['Built a tracker in React.'] }],
  skills: [{ category: 'Languages', count: 2, list: ['TypeScript', 'JavaScript'] }],
  certifications: [],
};

const ports = {}; // edge function name -> local port

async function functions(request, response, name, body) {
  if (name === 'ai-proxy') {
    const content = JSON.stringify(TAILORED);
    return respond(response, 200, { content, text: content, choices: [{ message: { content } }] });
  }
  if (!ports[name]) return respond(response, 404, { error: `${name} is not running here` });
  const answer = await fetch(`http://127.0.0.1:${ports[name]}/`, {
    method: request.method,
    headers: { 'Content-Type': 'application/json', Authorization: request.headers.authorization || '' },
    body: request.method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  response.writeHead(answer.status, { 'Content-Type': 'application/json' });
  return response.end(await answer.text());
}

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') return respond(response, 204);

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  const url = new URL(request.url, 'http://stand-in');
  const [, area, , first, ...others] = url.pathname.split('/');
  let body;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { body = raw; }

  try {
    if (area === 'rest') {
      const query = url.searchParams;
      query.path = others.join('/');
      return rest(request, response, first, query, body);
    }
    if (area === 'auth') {
      if (url.pathname.endsWith('/user')) {
        const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
        return token === TOKEN ? respond(response, 200, USER) : respond(response, 401, { message: 'bad token' });
      }
      return respond(response, 200, { access_token: TOKEN, refresh_token: 'stand-in', expires_in: 3600, token_type: 'bearer', user: USER });
    }
    if (area === 'storage') return storage(request, response, url.pathname, body);
    if (area === 'functions') return await functions(request, response, first, body);
    if (url.pathname === '/record') { typed.push(body); return respond(response, 200, 'ok'); }
    if (url.pathname === '/received') { received.push(raw); return respond(response, 200, 'ok'); }

    // Anything else is a fixture. The added line reports a form that really
    // took an application in, which is what a duplicate has to be counted by.
    const page = readFileSync(path.join(fixtures, path.basename(url.pathname)), 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return response.end(`${page}<script>window.addEventListener('submit', () => {
      if (window.__sent) navigator.sendBeacon('/received', location.pathname + location.search);
    });</script>`);
  } catch (error) {
    return respond(response, 404, { message: String(error.message) });
  }
});

await new Promise((resolve) => server.listen(serving ? 54399 : 0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

// ------------------------------------------------------------- the processes

// Asked of the system, because Windows hands out ports in sequence and Chrome
// would otherwise be sitting on whatever number comes next.
const freePort = () => new Promise((resolve) => {
  const probe = createServer().listen(0, '127.0.0.1', () => {
    const { port: free } = probe.address();
    probe.close(() => resolve(free));
  });
});

const children = [];
const stop = (child) => {
  // Windows has no SIGTERM to catch, so the worker's browser would outlive it.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else child.kill('SIGTERM');
};

const log = (name) => (chunk) => {
  if (process.env.FLOW_VERBOSE) process.stderr.write(`[${name}] ${chunk}`);
};

function startWorker() {
  const worker = spawn(process.execPath, ['--experimental-strip-types', 'worker/index.mjs'], {
    cwd: root,
    env: {
      PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TEMP: process.env.TEMP, TMP: process.env.TMP,
      SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, CREDENTIALS_KEY, AUTO_REGISTER: '1',
      POLL_MS: '100', ...(process.env.CHROME ? { CHROME: process.env.CHROME } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.stdout.on('data', log('worker'));
  worker.stderr.on('data', log('worker'));
  children.push(worker);
  return worker;
}

async function startFunction(name, functionPort, browserEndpoint) {
  const child = spawn(deno, ['run', '--allow-all', '--no-check', `supabase/functions/${name}/index.ts`], {
    cwd: root,
    env: {
      ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY, CREDENTIALS_KEY,
      BROWSER_WS: browserEndpoint, DENO_SERVE_ADDRESS: `tcp:127.0.0.1:${functionPort}`,
      // The project's package.json would otherwise make Deno look in node_modules.
      DENO_NO_PACKAGE_JSON: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', log(name));
  child.stderr.on('data', log(name));
  children.push(child);
  for (let tries = 0; tries < 240; tries++) {
    const up = await fetch(`http://127.0.0.1:${functionPort}/`, { method: 'OPTIONS' }).then(() => true, () => false);
    if (up) { ports[name] = functionPort; return; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} did not start`);
}

async function startBrowser() {
  const userData = mkdtempSync(path.join(tmpdir(), 'apply-flow-'));
  const browser = spawn(chrome, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${userData}`, '--no-first-run',
    '--disable-gpu', '--window-size=1280,1600', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  children.push(browser);
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome did not start within 30 seconds.')), 30000);
    let output = '';
    browser.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  return { endpoint, userData };
}

// ------------------------------------------------------------------ helpers

const IN_FLIGHT = ['queued', 'optimizing_resume', 'logging_in', 'filling_form', 'submitting'];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function addJob(link, title = 'Software Engineer', company = 'Example Corp') {
  const job = {
    id: randomUUID(), company_name: company, role_title: title, application_link: link, is_active: true,
    domain: 'Software', location_type: 'Remote', experience_required: 'Fresher', posted_date: new Date().toISOString(),
    short_description: 'Build web products.', full_description: 'Build web products with React and Node.js.',
    qualification: 'BTech', skills: ['React'], created_at: new Date().toISOString(), company_logo_url: null,
  };
  db.job_listings.push(job);
  return job;
}

function queue(link, extra = {}) {
  const job = addJob(link);
  const row = {
    id: randomUUID(), user_id: USER.id, job_listing_id: job.id, resume_version_id: RESUME, platform: 'other', application_url: link,
    status: 'queued', attempts: 0, given_answers: {}, pending_questions: [], created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(), ...extra,
  };
  db.auto_apply_applications.push(row);
  return row;
}

async function settled(row, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (IN_FLIGHT.includes(row.status)) {
    if (Date.now() > deadline) throw new Error(`still ${row.status} after ${timeout}ms`);
    await sleep(100);
  }
  return row;
}

/** What the page does when the user answers: the same fields, by the same route. */
function answer(row, answers) {
  const profile = db.user_profiles[0];
  const ticks = new Set(row.pending_questions.filter((question) => question.type === 'checkbox').map((question) => question.key));
  const remembered = Object.fromEntries(Object.entries(answers).filter(([key]) => !ticks.has(key)));
  Object.assign(profile, { apply_answers: { ...profile.apply_answers, ...remembered } });
  Object.assign(row, { status: 'queued', pending_questions: [], login_site: null, error_message: null, given_answers: answers });
}

const edge = (name, body) => fetch(`${base}/functions/v1/${name}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  body: JSON.stringify(body),
}).then(async (response) => ({ status: response.status, ...(await response.json()) }));

const receivedFor = (row) => received.filter((entry) => row.application_url.endsWith(entry)).length;

let failures = 0;
let skipped = 0;
const check = async (name, run) => {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (error) {
    failures++;
    console.log(`FAIL  ${name}\n      ${String(error.message).split('\n').slice(0, 6).join('\n      ')}`);
  }
};

const consent = 'allow example corp to use this data for managing your application';
const careers = `careers.example.localhost:${port}`;
const signIn = `login.example.localhost:${port}`;
const gated = (extra = '') =>
  `http://${careers}/sso.html?view=job&idp=${encodeURIComponent(signIn)}&home=${encodeURIComponent(careers)}${extra}`;
const form = (name) => `${base}/${name}`;

// ------------------------------------------------------------------ the runs

let browser;
try {
  browser = await startBrowser();
  if (deno) {
    await startFunction('auto-apply-queue', await freePort(), browser.endpoint);
    await startFunction('auto-apply-submit', await freePort(), browser.endpoint);
    await startFunction('save-site-credentials', await freePort(), browser.endpoint);
  }
  const worker = startWorker();

  if (serving) {
    const profile = db.user_profiles[0];
    Object.assign(profile, { apply_answers: {} });
    addJob(form('single.html'), 'Form Asks Two Things', 'Single Page Co');
    addJob(form('single.html?silent=1'), 'Form Never Confirms', 'Silent Co');
    addJob(gated(), 'Behind A Sign-in', 'Signed In Co');
    addJob(`${form('questionnaire.html')}?strict=1`, 'Form Refuses The Submit', 'Refusing Co');
    console.log(`stand-in on ${base}; functions ${deno ? 'running' : 'NOT running (set DENO)'}`);
    console.log(`session key sb-127-auth-token, access token ${TOKEN}`);
    await new Promise(() => {}); // until killed
  }

  await check('worker: sends a complete application, and marks it before pressing Submit', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: { gender: 'Female' } });
    const row = queue(form('single.html'), { given_answers: { [consent]: 'yes' } });
    await settled(row);
    assert.equal(row.status, 'submitted', row.error_message);
    assert.equal(receivedFor(row), 1);
    const seen = history.filter(([id]) => id === row.id).map(([, status]) => status);
    assert.deepEqual(seen.slice(-3), ['filling_form', 'submitting', 'submitted']);
    assert.ok(row.submission_time);
  });

  await check('worker: pauses twice for what only the user can answer, then sends it once', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: {} });
    const row = queue(form('single.html'));
    const before = received.length;
    await settled(row);
    assert.equal(row.status, 'needs_input');
    assert.deepEqual(row.pending_questions.map((question) => question.key), ['gender']);
    answer(row, { gender: 'Female' });
    await settled(row);
    assert.equal(row.status, 'needs_input');
    assert.equal(row.pending_questions[0].type, 'checkbox');
    answer(row, { [row.pending_questions[0].key]: 'yes' });
    await settled(row);
    assert.equal(row.status, 'submitted', row.error_message);
    assert.equal(received.length - before, 1);
    // The tick authorised this application alone.
    assert.deepEqual(db.user_profiles[0].apply_answers, { gender: 'Female' });
  });

  await check('worker: asks about what is blank when the form refuses the submit', async () => {
    const before = received.length;
    const row = queue(`${form('questionnaire.html')}?strict=1`);
    await settled(row);
    assert.equal(row.status, 'needs_input', row.error_message);
    assert.ok(row.pending_questions.some((question) => /shift/i.test(question.label)));
    assert.equal(received.length, before);
  });

  await check('worker: reads a Microsoft Forms choice, answers what the resume says, asks the rest in words', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: {} });
    const row = queue(form('ms-forms.html'));
    await settled(row);
    assert.equal(row.status, 'needs_input', row.error_message);
    // "10. Passing Degree" is on the resume, so only the other one is asked.
    assert.deepEqual(row.pending_questions.map((question) => question.label), ['11. Willing To Relocate']);
    assert.deepEqual(row.pending_questions[0].options, ['Yes', 'No']);
    answer(row, { [row.pending_questions[0].key]: 'Yes' });
    await settled(row);
    assert.equal(row.status, 'submitted', row.error_message);
    assert.equal(receivedFor(row), 1);
  });

  await check('worker: waits out a form that pauses part way through drawing itself', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: {} });
    const row = queue(`${form('ms-forms.html')}?late=1`);
    await settled(row);
    assert.equal(row.status, 'needs_input', row.error_message);
    assert.deepEqual(row.pending_questions.map((question) => question.label), ['11. Willing To Relocate']);
  });

  await check('worker: stops for a login, carries on with the saved one, and notes that it worked', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: { gender: 'Female' } });
    const row = queue(gated(), { given_answers: { [consent]: 'yes' } });
    await settled(row);
    assert.equal(row.status, 'needs_login', row.error_message);
    assert.equal(row.login_site, 'login.example.localhost');
    db.user_credentials_vault.push({
      id: randomUUID(), user_id: USER.id, platform: row.login_site, username: 'asha@example.com',
      password_encrypted: await encryptSecret('correct horse', CREDENTIALS_KEY), is_verified: false,
    });
    Object.assign(row, { status: 'queued', login_site: null, error_message: null });
    await settled(row);
    assert.equal(row.status, 'submitted', row.error_message);
    assert.equal(db.user_credentials_vault[0].is_verified, true);
  });

  await check('worker: flags a saved login the site refuses, after one try', async () => {
    db.user_credentials_vault.length = 0;
    db.user_credentials_vault.push({
      id: randomUUID(), user_id: USER.id, platform: 'login.example.localhost', username: 'asha@example.com',
      password_encrypted: await encryptSecret('out of date', CREDENTIALS_KEY), is_verified: true,
    });
    const row = queue(gated());
    await settled(row);
    assert.equal(row.status, 'needs_login');
    assert.equal(db.user_credentials_vault[0].is_verified, false);
    assert.equal(typed.filter((entry) => entry.step === 'password' && entry.value === 'out of date').length, 1);
    db.user_credentials_vault.length = 0;
  });

  await check('worker: opens an account where the site has none, and keeps the password', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: { gender: 'Female' } });
    const row = queue(gated('&next=signup'), { given_answers: { [consent]: 'yes' } });
    await settled(row);
    assert.equal(row.status, 'submitted', row.error_message);
    assert.equal(db.user_credentials_vault.length, 1);
    assert.equal(typed.filter((entry) => entry.step === 'signup').length, 1);
    db.user_credentials_vault.length = 0;
  });

  await check('worker: calls a silent form uncertain, and never takes it back', async () => {
    Object.assign(db.user_profiles[0], { apply_answers: { gender: 'Female' } });
    const row = queue(form('single.html?silent=1'), { given_answers: { [consent]: 'yes' } });
    await settled(row);
    assert.equal(row.status, 'submission_uncertain', row.error_message);
    assert.equal(receivedFor(row), 1);
    await sleep(1000);
    assert.equal(row.status, 'submission_uncertain');
    assert.equal(receivedFor(row), 1);
  });

  await check('worker: hands the user what no agent may do', async () => {
    const blocked = queue(form('blocked.html'));
    const providers = queue(gated('&next=providers-only'));
    await settled(blocked);
    await settled(providers);
    assert.equal(blocked.status, 'needs_manual_action', blocked.error_message);
    assert.equal(providers.status, 'needs_manual_action', providers.error_message);
    assert.match(providers.error_message, /only lets you sign in with Google/i);
  });

  await check('worker: a page with no form fails, and lets the job be tried again', async () => {
    const row = queue(form('board.html'));
    await settled(row);
    assert.equal(row.status, 'failed');
    assert.match(row.error_message, /No application form/);
  });

  await check('worker: refuses a resume outside the user\'s own folder', async () => {
    const before = received.length;
    const row = queue(form('single.html'), { resume_version_id: STRANGERS_RESUME });
    await settled(row);
    assert.equal(row.status, 'failed');
    assert.match(row.error_message, /tailored resume/);
    assert.equal(received.length, before);
  });

  await check('worker: fails a row with no tailored resume rather than sending nothing', async () => {
    const row = queue(form('single.html'), { resume_version_id: null });
    await settled(row);
    assert.equal(row.status, 'failed');
    assert.match(row.error_message, /No tailored resume/);
  });

  if (!deno) {
    skipped = 8;
    console.log('\nskipped the edge function checks: set DENO to run them');
  } else {
    await check('queue: a second press returns the same application', async () => {
      const job = addJob(form('board.html'));
      const first = await edge('auto-apply-queue', { jobId: job.id, resumeVersionId: RESUME });
      assert.equal(first.queued, true, JSON.stringify(first));
      const again = await edge('auto-apply-queue', { jobId: job.id, resumeVersionId: RESUME });
      assert.equal(again.applicationId, first.applicationId);
      await settled(db.auto_apply_applications.find((row) => row.id === first.applicationId));
    });

    await check('queue: refuses someone else\'s resume, and anyone not signed in', async () => {
      const job = addJob(form('board.html'));
      const theirs = await edge('auto-apply-queue', { jobId: job.id, resumeVersionId: STRANGERS_RESUME });
      assert.equal(theirs.success, false);
      assert.equal(db.auto_apply_applications.some((row) => row.job_listing_id === job.id), false);
      const stranger = await fetch(`${base}/functions/v1/auto-apply-queue`, { method: 'POST', body: JSON.stringify({ jobId: job.id }) });
      assert.equal(stranger.status, 401);
    });

    // Reached by pressing Auto Apply again on a job already in hand. Each of
    // these must leave the row alone: the application may already be with the
    // employer, or a worker may be filling it in right now.
    const submitAgain = async (status) => {
      Object.assign(db.user_profiles[0], { apply_answers: { gender: 'Female' } });
      const row = queue(`${form('single.html')}?again=${status}`, { status, given_answers: { [consent]: 'yes' } });
      const before = received.length;
      const result = await edge('auto-apply-submit', { applicationId: row.id, mode: 'submit', reviewed: { [consent]: 'yes' } });
      await sleep(500);
      assert.equal(received.length, before, 'the employer received a second application');
      assert.equal(row.status, status, 'the row was changed');
      return result;
    };

    await check('submit: never sends again once the outcome is uncertain', async () => {
      const result = await submitAgain('submission_uncertain');
      assert.equal(result.status, 'uncertain');
    });

    await check('submit: never sends while the row is mid-submit', async () => {
      await submitAgain('submitting');
    });

    await check('submit: never runs alongside a worker that holds the row', async () => {
      await submitAgain('filling_form');
    });

    await check('submit: writes a status the database accepts when a question is left', async () => {
      Object.assign(db.user_profiles[0], { apply_answers: {} });
      const row = queue(form('single.html'), { status: 'needs_input' });
      const result = await edge('auto-apply-submit', { applicationId: row.id, mode: 'submit' });
      assert.equal(result.status, 'needs_input', JSON.stringify(result));
      assert.equal(row.status, 'needs_input');
      assert.equal(row.paused_at_field, 'Gender', 'the update was refused, so the row kept its old fields');
    });

    await check('save-site-credentials: stores the login encrypted', async () => {
      const result = await edge('save-site-credentials', { site: 'login.example.localhost', username: 'asha@example.com', password: 'correct horse' });
      assert.equal(result.success, true, JSON.stringify(result));
      assert.equal(db.user_credentials_vault[0].username, 'asha@example.com');
      assert.ok(!JSON.stringify(db.user_credentials_vault[0]).includes('correct horse'));
    });

    await check('save-site-credentials: refuses the password to an identity provider', async () => {
      const before = db.user_credentials_vault.length;
      const result = await edge('save-site-credentials', { site: 'accounts.google.com', username: 'asha@example.com', password: 'never kept' });
      assert.equal(result.success, false);
      assert.match(result.error, /never use your Google account/);
      assert.equal(db.user_credentials_vault.length, before);
    });
  }
  stop(worker);
} finally {
  for (const child of children) stop(child);
  server.close();
  await sleep(500);
  if (browser) rmSync(browser.userData, { recursive: true, force: true, maxRetries: 5 });
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`\nall checks passed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(0);
