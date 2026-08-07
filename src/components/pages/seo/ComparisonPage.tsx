import { useParams, Link, Navigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Scale } from 'lucide-react';
import { Seo } from '../../../seo/Seo';
import { faqPageSchema, webPageSchema } from '../../../seo/schema';
import { getComparisonBySlug, RESUME_COMPARISONS } from '../../../data/seo/comparisons';
import { Breadcrumbs } from '../../seo/Breadcrumbs';
import { ContextualLinks } from '../../seo/ContextualLinks';
import { landingContextualLinks } from '../../../seo/internalLinks';

function ComparisonColumn({ side }: { side: { name: string; points: string[] } }) {
  return (
    <div className="rounded-2xl border border-surface bg-surface-sunken/60 p-5 space-y-3">
      <h3 className="font-semibold text-lg text-brand-500">{side.name}</h3>
      <ul className="space-y-2">
        {side.points.map((point, i) => {
          const isDownside = /\b(cannot|won't|doesn't|less flexible|slower|varies|misses|no cost)\b/i.test(point) && i >= side.points.length - 2;
          const Icon = isDownside ? XCircle : CheckCircle2;
          return (
            <li key={point} className="flex items-start gap-2 text-sm text-ink">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isDownside ? 'text-amber-400' : 'text-brand-500'}`} />
              <span>{point}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ComparisonPage() {
  const { comparisonSlug } = useParams<{ comparisonSlug: string }>();
  const comparison = comparisonSlug ? getComparisonBySlug(comparisonSlug) : undefined;

  if (!comparison) {
    return <Navigate to="/compare" replace />;
  }

  const path = `/compare/${comparison.slug}`;
  const jsonLd = [
    webPageSchema({
      path,
      name: comparison.title,
      description: comparison.metaDescription,
      breadcrumb: [{ name: 'Comparisons', path: '/compare' }, { name: comparison.title, path }],
    }),
    faqPageSchema([
      { question: `Which is better: ${comparison.optionA.name} or ${comparison.optionB.name}?`, answer: comparison.verdict },
      ...comparison.faqs,
    ]),
  ];

  const related = RESUME_COMPARISONS.filter((c) => c.slug !== comparison.slug).slice(0, 3);

  return (
    <>
      <Seo title={comparison.title} description={comparison.metaDescription} canonicalPath={path} jsonLd={jsonLd} />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: 'Comparisons', path: '/compare' }, { name: comparison.title, path }]} />

          <header className="space-y-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-500 bg-brand-500/10 px-3 py-1 rounded-full">
              <Scale className="w-3.5 h-3.5" /> Comparison
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold">{comparison.title}</h1>
            <p className="text-lg text-ink-muted leading-relaxed">{comparison.intro}</p>
          </header>

          <section aria-label="Comparison" className="grid sm:grid-cols-2 gap-4">
            <ComparisonColumn side={comparison.optionA} />
            <ComparisonColumn side={comparison.optionB} />
          </section>

          <section aria-labelledby="verdict-heading" className="space-y-2 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
            <h2 id="verdict-heading" className="text-lg font-semibold text-brand-500">Bottom line</h2>
            <p className="text-ink">{comparison.verdict}</p>
          </section>

          <div className="flex flex-wrap gap-3">
            <Link to="/score-checker" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 text-surface-deep font-semibold hover:opacity-90 transition-opacity">
              Check My Resume Score Free
            </Link>
            <Link to="/optimizer" className="px-5 py-2.5 rounded-lg border border-surface hover:border-brand-500/50 transition-colors font-medium">
              Try the JD Resume Optimizer
            </Link>
          </div>

          {comparison.faqs.length > 0 && (
            <section aria-labelledby="faq-heading" className="space-y-3">
              <h2 id="faq-heading" className="text-xl font-semibold">Frequently asked questions</h2>
              <div className="space-y-3">
                {comparison.faqs.map((faq) => (
                  <details key={faq.question} className="group bg-surface-sunken/60 border border-surface rounded-lg p-4">
                    <summary className="font-medium cursor-pointer text-slate-100">{faq.question}</summary>
                    <p className="mt-2 text-ink-muted">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <ContextualLinks title="Related resources" links={landingContextualLinks()} />

          {related.length > 0 && (
            <section aria-labelledby="related-heading" className="space-y-3">
              <h2 id="related-heading" className="text-xl font-semibold">More comparisons</h2>
              <div className="flex flex-wrap gap-2">
                {related.map((c) => (
                  <Link key={c.slug} to={`/compare/${c.slug}`} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink hover:text-brand-500 transition-colors">
                    {c.title}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
