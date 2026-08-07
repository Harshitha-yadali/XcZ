import { Link } from 'react-router-dom';
import { Seo } from '../../../seo/Seo';
import { webPageSchema } from '../../../seo/schema';
import { RESUME_COMPARISONS } from '../../../data/seo/comparisons';
import { Breadcrumbs } from '../../seo/Breadcrumbs';

export function ComparisonHubPage() {
  const path = '/compare';
  const title = 'Resume Tool Comparisons';
  const description = 'Straight comparisons to help you decide: ATS checker vs manual review, AI optimizer vs templates, tailored vs generic resumes, and more.';

  return (
    <>
      <Seo
        title={title}
        description={description}
        canonicalPath={path}
        jsonLd={webPageSchema({ path, name: title, description, breadcrumb: [{ name: 'Comparisons', path }] })}
      />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <Breadcrumbs items={[{ name: 'Comparisons', path }]} />
          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold">Resume Tool Comparisons</h1>
            <p className="text-lg text-ink-muted max-w-2xl">
              Clear, practical comparisons for the decisions job seekers actually face while preparing a resume.
            </p>
          </header>
          <div className="grid sm:grid-cols-2 gap-3">
            {RESUME_COMPARISONS.map((c) => (
              <Link
                key={c.slug}
                to={`/compare/${c.slug}`}
                className="rounded-xl border border-surface bg-surface-sunken/60 p-4 hover:border-brand-500/50 transition-colors"
              >
                <h2 className="font-medium text-slate-100">{c.title}</h2>
                <p className="text-sm text-ink-muted mt-1">{c.metaDescription}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
