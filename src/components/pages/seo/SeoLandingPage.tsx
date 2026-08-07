import { Link, Navigate } from 'react-router-dom';
import { Seo } from '../../../seo/Seo';
import { faqPageSchema, webPageSchema, howToSchema } from '../../../seo/schema';
import { getLandingPageBySlug, SEO_LANDING_PAGES } from '../../../data/seo/landingPages';
import { Breadcrumbs } from '../../seo/Breadcrumbs';
import { ContextualLinks } from '../../seo/ContextualLinks';
import { landingContextualLinks } from '../../../seo/internalLinks';

interface SeoLandingPageProps {
  /** Static slug for pages wired individually in App.tsx (keeps one clean URL per page for prerendering). */
  slug: string;
}

export function SeoLandingPage({ slug }: SeoLandingPageProps) {
  const page = getLandingPageBySlug(slug);
  if (!page) return <Navigate to="/" replace />;

  const jsonLd = [
    webPageSchema({
      path: page.path,
      name: page.title,
      description: page.metaDescription,
      breadcrumb: [{ name: page.h1, path: page.path }],
    }),
    ...(page.faqs.length ? [faqPageSchema(page.faqs)] : []),
    // Sections read naturally as ordered steps for how-to style guidance pages.
    howToSchema({
      name: page.h1,
      description: page.metaDescription,
      steps: page.sections.map((s) => ({ name: s.heading, text: (s.paragraphs?.[0] || s.bullets?.join('; ') || s.heading) })),
    }),
  ];

  return (
    <>
      <Seo title={page.title} description={page.metaDescription} canonicalPath={page.path} keywords={page.keywords} jsonLd={jsonLd} />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-3xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: page.h1, path: page.path }]} />

          <header className="space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold">{page.h1}</h1>
            <p className="text-lg text-ink-muted leading-relaxed">{page.heroParagraph}</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to={page.primaryCta.path} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 text-surface-deep font-semibold hover:opacity-90 transition-opacity">
                {page.primaryCta.label}
              </Link>
              <Link to={page.secondaryCta.path} className="px-5 py-2.5 rounded-lg border border-surface hover:border-brand-500/50 transition-colors font-medium">
                {page.secondaryCta.label}
              </Link>
            </div>
          </header>

          {page.sections.map((section) => (
            <section key={section.heading} aria-labelledby={section.heading} className="space-y-3">
              <h2 id={section.heading} className="text-xl font-semibold">{section.heading}</h2>
              {section.paragraphs?.map((p, i) => (
                <p key={i} className="text-ink leading-relaxed">{p}</p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 pt-1">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-ink bg-surface-sunken/60 border border-surface rounded-lg p-3">
                      <span className="text-brand-500 mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {page.faqs.length > 0 && (
            <section aria-labelledby="faq-heading" className="space-y-3">
              <h2 id="faq-heading" className="text-xl font-semibold">Frequently asked questions</h2>
              <div className="space-y-3">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="group bg-surface-sunken/60 border border-surface rounded-lg p-4">
                    <summary className="font-medium cursor-pointer text-slate-100">{faq.question}</summary>
                    <p className="mt-2 text-ink-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <ContextualLinks title="Keep going" links={landingContextualLinks()} />

          <section aria-labelledby="more-guides-heading" className="space-y-3">
            <h2 id="more-guides-heading" className="text-xl font-semibold">More guides</h2>
            <div className="flex flex-wrap gap-2">
              {SEO_LANDING_PAGES.filter((p) => p.slug !== page.slug).map((p) => (
                <Link key={p.slug} to={p.path} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink hover:text-brand-500 transition-colors">
                  {p.h1}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
