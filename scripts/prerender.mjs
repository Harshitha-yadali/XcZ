// Runs after `vite build`. Loads src/entry-server.tsx through Vite's own SSR module
// loader (same mechanism the official Vite SSR guide uses for a dev server, reused
// here as a one-off Node script — no extra ts-node/tsx dependency, no second bundle),
// renders every programmatic/content SEO route to static markup, and writes each one
// as dist/<route>/index.html with page-specific <title>/meta/OG/canonical/JSON-LD
// spliced in. Static hosts serve `<route>/index.html` for `/<route>` automatically
// before falling back to the SPA rewrite in public/_redirects, so real users still get
// the full interactive app — crawlers and social-share unfurlers now see real per-page
// content and tags instead of the one generic index.html shell for these routes.
import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

async function collectRoutes(server) {
  const [{ RESUME_ROLES }, { RESUME_COMPANIES }, { RESUME_COMPARISONS }, { SEO_LANDING_PAGES }] = await Promise.all([
    server.ssrLoadModule('/src/data/seo/roles.ts'),
    server.ssrLoadModule('/src/data/seo/companies.ts'),
    server.ssrLoadModule('/src/data/seo/comparisons.ts'),
    server.ssrLoadModule('/src/data/seo/landingPages.ts'),
  ]);

  return [
    '/resume-for',
    ...RESUME_ROLES.map((r) => `/resume-for/${r.slug}`),
    '/resume-for-company',
    ...RESUME_COMPANIES.map((c) => `/resume-for-company/${c.slug}`),
    '/compare',
    ...RESUME_COMPARISONS.map((c) => `/compare/${c.slug}`),
    ...SEO_LANDING_PAGES.map((p) => p.path),
  ];
}

/** Strips the generic per-site tags baked into the built index.html template so
 * per-route Helmet output can replace them without duplicating title/meta/canonical. */
function stripDefaultHeadTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta name="description"[^>]*>\s*/, '')
    .replace(/<meta name="keywords"[^>]*>\s*/, '')
    .replace(/<meta name="robots"[^>]*>\s*/, '')
    .replace(/<link rel="canonical"[^>]*>\s*/, '')
    .replace(/<meta property="og:[^>]*>\s*/g, '')
    .replace(/<meta name="twitter:[^>]*>\s*/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '');
}

function helmetToHtml(helmet) {
  return ['title', 'meta', 'link', 'script'].map((key) => helmet[key].toString()).join('\n    ');
}

async function main() {
  const template = await readFile(path.join(DIST, 'index.html'), 'utf-8');
  const bareTemplate = stripDefaultHeadTags(template);

  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });

  try {
    const routes = await collectRoutes(server);
    const { render } = await server.ssrLoadModule('/src/entry-server.tsx');

    let written = 0;
    for (const route of routes) {
      const { html: appHtml, helmet } = render(route);
      const pageHtml = bareTemplate
        .replace('</head>', `${helmetToHtml(helmet)}\n  </head>`)
        .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

      const outPath = path.join(DIST, route.replace(/^\//, ''), 'index.html');
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, pageHtml, 'utf-8');
      written++;
    }

    console.log(`[prerender] Wrote ${written} static pages under dist/.`);
  } finally {
    await server.close();
  }
}

main().catch((err) => {
  console.error('[prerender] Failed:', err);
  process.exit(1);
});
