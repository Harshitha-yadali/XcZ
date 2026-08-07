import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async';
import { RoleHubPage } from './components/pages/seo/RoleHubPage';
import { RoleResumePage } from './components/pages/seo/RoleResumePage';
import { CompanyHubPage } from './components/pages/seo/CompanyHubPage';
import { CompanyResumePage } from './components/pages/seo/CompanyResumePage';
import { ComparisonHubPage } from './components/pages/seo/ComparisonHubPage';
import { ComparisonPage } from './components/pages/seo/ComparisonPage';
import { SeoLandingPage } from './components/pages/seo/SeoLandingPage';
import { SEO_LANDING_PAGES } from './data/seo/landingPages';

/**
 * Server-only render entry used exclusively by scripts/prerender.mjs (via Vite's
 * ssrLoadModule, at build time — never shipped to the browser). Deliberately renders
 * ONLY the static-data-driven SEO page tree, not the full <App/> shell, since App's
 * Header/Nav/Auth/payment state depends on Supabase, browser storage and other
 * client-only context that isn't safe (or meaningful) to execute during a Node build.
 * Real visitors always get the full interactive SPA — this only produces the initial
 * static HTML crawlers and social-share unfurlers see before/without JS executing.
 */
export interface ServerRenderResult {
  html: string;
  helmet: HelmetServerState;
}

export function render(url: string): ServerRenderResult {
  const helmetContext: { helmet?: HelmetServerState } = {};

  const html = renderToStaticMarkup(
    <StaticRouter location={url}>
      <HelmetProvider context={helmetContext}>
        <Routes>
          <Route path="/resume-for" element={<RoleHubPage />} />
          <Route path="/resume-for/:roleSlug" element={<RoleResumePage />} />
          <Route path="/resume-for-company" element={<CompanyHubPage />} />
          <Route path="/resume-for-company/:companySlug" element={<CompanyResumePage />} />
          <Route path="/compare" element={<ComparisonHubPage />} />
          <Route path="/compare/:comparisonSlug" element={<ComparisonPage />} />
          {SEO_LANDING_PAGES.map((page) => (
            <Route key={page.slug} path={page.path} element={<SeoLandingPage slug={page.slug} />} />
          ))}
        </Routes>
      </HelmetProvider>
    </StaticRouter>
  );

  if (!helmetContext.helmet) {
    throw new Error(`[entry-server] Helmet context was not populated while rendering "${url}"`);
  }

  return { html, helmet: helmetContext.helmet };
}
