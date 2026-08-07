import { useParams, Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Building2, ListChecks } from 'lucide-react';
import { Seo } from '../../../seo/Seo';
import { faqPageSchema, webPageSchema } from '../../../seo/schema';
import { getCompanyBySlug, getRelatedCompanies } from '../../../data/seo/companies';
import { Breadcrumbs } from '../../seo/Breadcrumbs';
import { ContextualLinks } from '../../seo/ContextualLinks';
import { companyContextualLinks } from '../../../seo/internalLinks';

export function CompanyResumePage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const company = companySlug ? getCompanyBySlug(companySlug) : undefined;

  if (!company) {
    return <Navigate to="/resume-for-company" replace />;
  }

  const path = `/resume-for-company/${company.slug}`;
  const title = `Resume for ${company.name} — Format, Tips & Free ATS Check`;
  const description = `How to format and tailor your resume for ${company.name}: what recruiters and their applicant tracking system look for, common interview rounds, and a free ATS score check.`;
  const relatedCompanies = getRelatedCompanies(company);

  const faqs = [
    { question: `Does ${company.name} use an ATS to screen resumes?`, answer: company.atsNotes },
    ...company.faqs,
    { question: `What are ${company.name}'s typical interview rounds?`, answer: `Most candidates go through: ${company.commonRounds.join(' → ')}.` },
  ];

  const jsonLd = [
    webPageSchema({
      path,
      name: title,
      description,
      breadcrumb: [
        { name: 'Resume for Companies', path: '/resume-for-company' },
        { name: company.name, path },
      ],
    }),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <Seo title={title} description={description} canonicalPath={path} jsonLd={jsonLd} keywords={`resume for ${company.name}, ${company.name} resume format, ${company.name} ATS resume, ${company.name} interview preparation`} />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: 'Resume for Companies', path: '/resume-for-company' }, { name: company.name, path }]} />

          <header className="space-y-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-500 bg-brand-500/10 px-3 py-1 rounded-full">
              <Building2 className="w-3.5 h-3.5" /> {company.type}
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold">Resume for {company.name}</h1>
            <p className="text-lg text-ink-muted leading-relaxed">
              {company.name} commonly hires for {company.hiringFocus.slice(0, 3).join(', ')} and more. Here's how to
              format and tailor your resume so it clears their screening process — plus a free way to check your score.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/optimizer" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 text-surface-deep font-semibold hover:opacity-90 transition-opacity">
                Tailor My Resume for {company.name}
              </Link>
              <Link to="/score-checker" className="px-5 py-2.5 rounded-lg border border-surface hover:border-brand-500/50 transition-colors font-medium">
                Check My ATS Score Free
              </Link>
            </div>
          </header>

          <section aria-labelledby="hiring-heading" className="space-y-3">
            <h2 id="hiring-heading" className="text-xl font-semibold">Roles {company.name} commonly hires for</h2>
            <div className="flex flex-wrap gap-2">
              {company.hiringFocus.map((role) => (
                <span key={role} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink">{role}</span>
              ))}
            </div>
          </section>

          <section aria-labelledby="tips-heading" className="space-y-3">
            <h2 id="tips-heading" className="text-xl font-semibold flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-brand-500" /> Resume tips for {company.name}
            </h2>
            <ul className="space-y-2.5">
              {company.resumeTips.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-ink bg-surface-sunken/60 border border-surface rounded-lg p-3.5">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand-500 mt-0.5 shrink-0" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="rounds-heading" className="space-y-3">
            <h2 id="rounds-heading" className="text-xl font-semibold">Typical interview process</h2>
            <ol className="flex flex-wrap items-center gap-2 text-ink">
              {company.commonRounds.map((round, i) => (
                <li key={round} className="flex items-center gap-2">
                  <span className="text-sm px-3 py-1.5 rounded-full bg-surface">{round}</span>
                  {i < company.commonRounds.length - 1 && <span className="text-ink-muted">→</span>}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="faq-heading" className="space-y-3">
            <h2 id="faq-heading" className="text-xl font-semibold">Frequently asked questions</h2>
            <div className="space-y-3">
              {faqs.map((faq) => (
                <details key={faq.question} className="group bg-surface-sunken/60 border border-surface rounded-lg p-4">
                  <summary className="font-medium cursor-pointer text-slate-100">{faq.question}</summary>
                  <p className="mt-2 text-ink-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>

          <ContextualLinks title={`Next steps for ${company.name}`} links={companyContextualLinks()} />

          {relatedCompanies.length > 0 && (
            <section aria-labelledby="related-companies-heading" className="space-y-3">
              <h2 id="related-companies-heading" className="text-xl font-semibold">Related company resumes</h2>
              <div className="flex flex-wrap gap-2">
                {relatedCompanies.map((c) => (
                  <Link key={c.slug} to={`/resume-for-company/${c.slug}`} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink hover:text-brand-500 hover:bg-surface/80 transition-colors">
                    Resume for {c.name}
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
