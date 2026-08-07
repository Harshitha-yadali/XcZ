import { useParams, Link, Navigate } from 'react-router-dom';
import { CheckCircle2, Sparkles, Tag } from 'lucide-react';
import { Seo } from '../../../seo/Seo';
import { faqPageSchema, webPageSchema } from '../../../seo/schema';
import { getRoleBySlug, getRelatedRoles } from '../../../data/seo/roles';
import { Breadcrumbs } from '../../seo/Breadcrumbs';
import { ContextualLinks } from '../../seo/ContextualLinks';
import { roleContextualLinks } from '../../../seo/internalLinks';

function buildSampleBullets(skills: string[], title: string): string[] {
  const [a, b, c] = skills;
  return [
    `Delivered ${title.toLowerCase()} work using ${a} and ${b}, contributing directly to project/team goals.`,
    `Applied ${c || a} to improve reliability, quality or turnaround time on a real project — quantify this with your own numbers (e.g. "%", "hours saved", "users impacted").`,
    `Collaborated cross-functionally to ship features/deliverables end-to-end, from requirement to review.`,
  ];
}

export function RoleResumePage() {
  const { roleSlug } = useParams<{ roleSlug: string }>();
  const role = roleSlug ? getRoleBySlug(roleSlug) : undefined;

  if (!role) {
    return <Navigate to="/resume-for" replace />;
  }

  const path = `/resume-for/${role.slug}`;
  const title = `Resume for ${role.title} — Free ATS Score Check`;
  const description = `Build an ATS-friendly resume for a ${role.title} role in India. See the exact skills, keywords and resume structure recruiters and ATS software look for, then check your score for free.`;
  const sampleBullets = buildSampleBullets(role.skills, role.title);
  const relatedRoles = getRelatedRoles(role);

  const faqs = [
    { question: `What skills should a ${role.title} resume highlight?`, answer: `Focus on ${role.skills.slice(0, 4).join(', ')}, backed by real projects or work you can speak to in an interview — a skills list alone won't pass a recruiter's second look.` },
    ...role.faqs,
    { question: `Is this resume format free to check?`, answer: `Yes — PrimoBoost AI's Resume Score Checker gives a free ATS compatibility score, and the JD Resume Optimizer tailors your resume to a specific ${role.title} job description.` },
  ];

  const jsonLd = [
    webPageSchema({
      path,
      name: title,
      description,
      breadcrumb: [
        { name: 'Resume for Roles', path: '/resume-for' },
        { name: role.title, path },
      ],
    }),
    faqPageSchema(faqs),
  ];

  return (
    <>
      <Seo title={title} description={description} canonicalPath={path} jsonLd={jsonLd} keywords={[role.title, ...role.keywords, `${role.title} resume format`, `ATS resume for ${role.title}`].join(', ')} />
      <main className="min-h-screen bg-surface-deep text-slate-100 px-4 sm:px-6 py-10 md:pl-20">
        <div className="max-w-4xl mx-auto space-y-10">
          <Breadcrumbs items={[{ name: 'Resume for Roles', path: '/resume-for' }, { name: role.title, path }]} />

          <header className="space-y-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand-500 bg-brand-500/10 px-3 py-1 rounded-full">
              <Tag className="w-3.5 h-3.5" /> {role.category}
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold">Resume for {role.title}</h1>
            <p className="text-lg text-ink-muted leading-relaxed">
              Here's exactly what recruiters and ATS software scan for on a {role.title} resume in the Indian job
              market ({role.experienceLevels}), plus a free way to check where yours currently stands.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/score-checker" className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-brand-500 to-cyan-500 text-surface-deep font-semibold hover:opacity-90 transition-opacity">
                Check My Resume Score Free
              </Link>
              <Link to="/optimizer" className="px-5 py-2.5 rounded-lg border border-surface hover:border-brand-500/50 transition-colors font-medium">
                Tailor My Resume to a {role.title} JD
              </Link>
            </div>
          </header>

          <section aria-labelledby="skills-heading" className="space-y-3">
            <h2 id="skills-heading" className="text-xl font-semibold">Skills recruiters look for in a {role.title} resume</h2>
            <ul className="grid sm:grid-cols-2 gap-2.5">
              {role.skills.map((skill) => (
                <li key={skill} className="flex items-start gap-2 text-ink">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand-500 mt-0.5 shrink-0" />
                  <span>{skill}</span>
                </li>
              ))}
            </ul>
          </section>

          {role.keywords.length > 0 && (
            <section aria-labelledby="keywords-heading" className="space-y-3">
              <h2 id="keywords-heading" className="text-xl font-semibold">ATS keywords to include</h2>
              <p className="text-ink-muted">
                Beyond your core skill list, ATS parsers for {role.title} roles commonly match on:
              </p>
              <div className="flex flex-wrap gap-2">
                {role.keywords.map((kw) => (
                  <span key={kw} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink">{kw}</span>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="bullets-heading" className="space-y-3">
            <h2 id="bullets-heading" className="text-xl font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-500" /> Sample resume bullet structure
            </h2>
            <p className="text-ink-muted">Use these as a starting structure, then replace with your own real numbers and outcomes:</p>
            <ul className="space-y-2.5">
              {sampleBullets.map((bullet, i) => (
                <li key={i} className="text-ink bg-surface-sunken/60 border border-surface rounded-lg p-3.5">{bullet}</li>
              ))}
            </ul>
          </section>

          {role.altTitles.length > 0 && (
            <section aria-labelledby="alt-titles-heading" className="space-y-2">
              <h2 id="alt-titles-heading" className="text-xl font-semibold">This resume also matches job titles like</h2>
              <p className="text-ink">{role.altTitles.join(' · ')}</p>
            </section>
          )}

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

          <ContextualLinks title={`Next steps for your ${role.title} resume`} links={roleContextualLinks()} />

          {relatedRoles.length > 0 && (
            <section aria-labelledby="related-roles-heading" className="space-y-3">
              <h2 id="related-roles-heading" className="text-xl font-semibold">Related role resumes</h2>
              <div className="flex flex-wrap gap-2">
                {relatedRoles.map((r) => (
                  <Link key={r.slug} to={`/resume-for/${r.slug}`} className="text-sm px-3 py-1.5 rounded-full bg-surface text-ink hover:text-brand-500 hover:bg-surface/80 transition-colors">
                    Resume for {r.title}
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
