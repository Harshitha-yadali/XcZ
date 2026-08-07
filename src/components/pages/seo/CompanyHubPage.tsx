import { Link } from 'react-router-dom';
import { Seo } from '../../../seo/Seo';
import { webPageSchema } from '../../../seo/schema';
import { RESUME_COMPANIES } from '../../../data/seo/companies';
import { Breadcrumbs } from '../../seo/Breadcrumbs';

const TYPE_ORDER = Array.from(new Set(RESUME_COMPANIES.map((c) => c.type)));

export function CompanyHubPage() {
  const path = '/resume-for-company';
  const title = 'Resume Tips by Company — TCS, Infosys, Amazon, Google & More';
  const description = 'Company-specific resume advice for India\'s top tech employers: what each ATS scans for, resume formatting tips, and typical interview rounds.';

  return (
    <>
      <Seo
        title={title}
        description={description}
        canonicalPath={path}
        jsonLd={webPageSchema({ path, name: title, description, breadcrumb: [{ name: 'Resume for Companies', path }] })}
      />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: 'Resume for Companies', path }]} />
          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold">Resume Tips by Company</h1>
            <p className="text-lg text-ink-muted max-w-2xl">
              Every company's ATS and recruiters scan for slightly different signals. Pick a company to see exactly
              what to tailor before you apply.
            </p>
          </header>

          {TYPE_ORDER.map((type) => (
            <section key={type} aria-labelledby={`type-${type}`} className="space-y-3">
              <h2 id={`type-${type}`} className="text-xl font-semibold text-brand-500">{type}</h2>
              <div className="flex flex-wrap gap-2">
                {RESUME_COMPANIES.filter((c) => c.type === type).map((company) => (
                  <Link
                    key={company.slug}
                    to={`/resume-for-company/${company.slug}`}
                    className="text-sm px-3.5 py-2 rounded-full bg-surface text-ink hover:text-brand-500 hover:bg-surface/80 transition-colors"
                  >
                    Resume for {company.name}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
