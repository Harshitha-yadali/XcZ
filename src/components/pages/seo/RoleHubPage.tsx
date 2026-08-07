import { Link } from 'react-router-dom';
import { Seo } from '../../../seo/Seo';
import { webPageSchema } from '../../../seo/schema';
import { RESUME_ROLES } from '../../../data/seo/roles';
import { Breadcrumbs } from '../../seo/Breadcrumbs';

const CATEGORY_ORDER = Array.from(new Set(RESUME_ROLES.map((r) => r.category)));

export function RoleHubPage() {
  const path = '/resume-for';
  const title = 'Resume Examples & ATS Tips by Job Role';
  const description = 'Browse role-specific resume guidance for 60+ job titles in India — skills, ATS keywords and sample bullet points for engineering, data, design, business, sales, finance and more.';

  return (
    <>
      <Seo
        title={title}
        description={description}
        canonicalPath={path}
        jsonLd={webPageSchema({ path, name: title, description, breadcrumb: [{ name: 'Resume for Roles', path }] })}
      />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-5xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: 'Resume for Roles', path }]} />
          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold">Resume Guidance by Job Role</h1>
            <p className="text-lg text-ink-muted max-w-2xl">
              Pick your role to see the exact skills, ATS keywords and resume structure recruiters look for — then
              check your resume's score for free.
            </p>
          </header>

          {CATEGORY_ORDER.map((category) => (
            <section key={category} aria-labelledby={`cat-${category}`} className="space-y-3">
              <h2 id={`cat-${category}`} className="text-xl font-semibold text-brand-500">{category}</h2>
              <div className="flex flex-wrap gap-2">
                {RESUME_ROLES.filter((r) => r.category === category).map((role) => (
                  <Link
                    key={role.slug}
                    to={`/resume-for/${role.slug}`}
                    className="text-sm px-3.5 py-2 rounded-full bg-surface text-ink hover:text-brand-500 hover:bg-surface/80 transition-colors"
                  >
                    Resume for {role.title}
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
