// Generates dist/sitemap.xml after `vite build`. Loads the TS data files that back the
// programmatic SEO pages via Vite's SSR module loader (no extra ts-node/tsx dependency
// needed), and best-effort fetches published blog slugs from Supabase — if that fails
// (no network/env vars during a local build), the sitemap still comes out complete for
// every static + programmatic route, it just skips blog URLs and warns instead of failing.
import { createServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://primoboost.ai';
const OUT_DIR = path.join(ROOT, 'dist');

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/optimizer', changefreq: 'weekly', priority: 0.9 },
  { path: '/score-checker', changefreq: 'weekly', priority: 0.9 },
  { path: '/ats-16-parameter', changefreq: 'weekly', priority: 0.8 },
  { path: '/ats-16-parameter-advanced', changefreq: 'weekly', priority: 0.7 },
  { path: '/guided-builder', changefreq: 'weekly', priority: 0.8 },
  { path: '/linkedin-generator', changefreq: 'weekly', priority: 0.7 },
  { path: '/portfolio-builder', changefreq: 'weekly', priority: 0.7 },
  { path: '/mock-interview', changefreq: 'weekly', priority: 0.8 },
  { path: '/resume-interview', changefreq: 'monthly', priority: 0.5 },
  { path: '/realistic-interview', changefreq: 'monthly', priority: 0.5 },
  { path: '/smart-interview', changefreq: 'monthly', priority: 0.5 },
  { path: '/about', changefreq: 'monthly', priority: 0.4 },
  { path: '/contact', changefreq: 'monthly', priority: 0.4 },
  { path: '/faq', changefreq: 'monthly', priority: 0.5 },
  { path: '/privacy-policy', changefreq: 'yearly', priority: 0.2 },
  { path: '/terms-and-conditions', changefreq: 'yearly', priority: 0.2 },
  { path: '/tutorials', changefreq: 'monthly', priority: 0.5 },
  { path: '/all-tools', changefreq: 'weekly', priority: 0.6 },
  { path: '/pricing', changefreq: 'monthly', priority: 0.6 },
  { path: '/careers', changefreq: 'weekly', priority: 0.5 },
  { path: '/jobs', changefreq: 'daily', priority: 0.7 },
  { path: '/gaming', changefreq: 'monthly', priority: 0.4 },
  { path: '/pathfinder', changefreq: 'monthly', priority: 0.3 },
  { path: '/cognitive-pathfinder', changefreq: 'monthly', priority: 0.3 },
  { path: '/key-finder', changefreq: 'monthly', priority: 0.3 },
  { path: '/bubble-selection', changefreq: 'monthly', priority: 0.3 },
  { path: '/spatial-reasoning', changefreq: 'monthly', priority: 0.3 },
  { path: '/session', changefreq: 'monthly', priority: 0.5 },
  { path: '/referrals', changefreq: 'weekly', priority: 0.6 },
  { path: '/blog', changefreq: 'daily', priority: 0.8 },
  { path: '/webinars', changefreq: 'weekly', priority: 0.5 },
  { path: '/resume-for', changefreq: 'weekly', priority: 0.7 },
  { path: '/resume-for-company', changefreq: 'weekly', priority: 0.7 },
  { path: '/compare', changefreq: 'monthly', priority: 0.6 },
  { path: '/resume-keywords', changefreq: 'monthly', priority: 0.6 },
  { path: '/resume-templates', changefreq: 'monthly', priority: 0.6 },
  { path: '/resume-examples', changefreq: 'monthly', priority: 0.6 },
  { path: '/campus-placement-resume', changefreq: 'monthly', priority: 0.6 },
  { path: '/referral-message-templates', changefreq: 'monthly', priority: 0.6 },
  { path: '/jd-resume-optimizer', changefreq: 'monthly', priority: 0.6 },
  { path: '/interview-questions', changefreq: 'monthly', priority: 0.6 },
];

async function loadSeoData() {
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const [{ RESUME_ROLES }, { RESUME_COMPANIES }, { RESUME_COMPARISONS }] = await Promise.all([
      server.ssrLoadModule('/src/data/seo/roles.ts'),
      server.ssrLoadModule('/src/data/seo/companies.ts'),
      server.ssrLoadModule('/src/data/seo/comparisons.ts'),
    ]);
    return { RESUME_ROLES, RESUME_COMPANIES, RESUME_COMPARISONS };
  } finally {
    await server.close();
  }
}

async function fetchBlogSlugs() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[sitemap] VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY not set — skipping blog post URLs.');
    return [];
  }
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('blog_posts')
      .select('slug, updated_at')
      .eq('status', 'published');
    if (error) throw error;
    return (data || []).map((row) => ({ path: `/blog/${row.slug}`, lastmod: row.updated_at }));
  } catch (err) {
    console.warn('[sitemap] Could not fetch blog posts, skipping blog URLs:', err.message || err);
    return [];
  }
}

function toUrlEntry({ path: routePath, changefreq, priority, lastmod }) {
  const loc = `${SITE_URL}${routePath}`;
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${new Date(lastmod).toISOString().split('T')[0]}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority !== undefined ? `    <priority>${priority.toFixed(1)}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const { RESUME_ROLES, RESUME_COMPANIES, RESUME_COMPARISONS } = await loadSeoData();
  const blogUrls = await fetchBlogSlugs();

  const roleUrls = RESUME_ROLES.map((r) => ({ path: `/resume-for/${r.slug}`, changefreq: 'monthly', priority: 0.6 }));
  const companyUrls = RESUME_COMPANIES.map((c) => ({ path: `/resume-for-company/${c.slug}`, changefreq: 'monthly', priority: 0.6 }));
  const comparisonUrls = RESUME_COMPARISONS.map((c) => ({ path: `/compare/${c.slug}`, changefreq: 'monthly', priority: 0.5 }));

  const allUrls = [...STATIC_ROUTES, ...roleUrls, ...companyUrls, ...comparisonUrls, ...blogUrls.map((b) => ({ ...b, changefreq: 'monthly', priority: 0.6 }))];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${allUrls
    .map(toUrlEntry)
    .join('\n')}\n</urlset>\n`;

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf-8');
  console.log(`[sitemap] Wrote ${allUrls.length} URLs to dist/sitemap.xml (${blogUrls.length} from blog).`);
}

main().catch((err) => {
  console.error('[sitemap] Failed to generate sitemap:', err);
  process.exit(1);
});
