import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { DarkPageWrapper } from '../ui';
import { HomeFooter } from '../home/HomeFooter';
import { useSEO } from '../../hooks/useSEO';

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalFaqItem = {
  question: string;
  answer: string;
};

interface LegalPageLayoutProps {
  title: string;
  description: string;
  canonical: string;
  eyebrow: string;
  badgeLabel: string;
  intro: string;
  effectiveDate?: string;
  sections?: LegalSection[];
  faqs?: LegalFaqItem[];
}

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  description,
  canonical,
  eyebrow,
  badgeLabel,
  intro,
  effectiveDate,
  sections = [],
  faqs = [],
}) => {
  useSEO({
    title: `${title} | PrimoBoost AI`,
    description,
    canonical,
  });

  const isChristmas = new Date().getMonth() === 11 || new Date().getMonth() === 0;

  return (
    <DarkPageWrapper showSnow={isChristmas} showSanta={isChristmas}>
      <div className="md:ml-16">
        <section className="relative pt-20 sm:pt-24 pb-10">
          <div className="container-responsive">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="max-w-5xl mx-auto"
            >
              <div className="relative overflow-hidden rounded-[28px] border border-emerald-400/20 bg-slate-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.16),transparent_28%)]" />
                <div className="relative px-6 py-10 sm:px-10 sm:py-12">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                    <span>{eyebrow}</span>
                    <span className="text-emerald-500/70">/</span>
                    <span>{badgeLabel}</span>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.8fr] lg:items-end">
                    <div>
                      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
                        {title}
                      </h1>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                        {intro}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Document Status
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-sm text-slate-200">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.65)]" />
                        <span>Live on PrimoBoost AI</span>
                      </div>
                      {effectiveDate && (
                        <p className="mt-4 text-sm text-slate-400">
                          Effective Date: <span className="text-slate-200">{effectiveDate}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="pb-20">
          <div className="container-responsive">
            <div className="mx-auto max-w-5xl space-y-6">
              {faqs.length > 0 && (
                <div className="grid gap-4">
                  {faqs.map((faq, index) => (
                    <motion.article
                      key={faq.question}
                      initial="hidden"
                      animate="visible"
                      variants={cardVariants}
                      transition={{ delay: index * 0.03 }}
                      className="rounded-3xl border border-slate-800/80 bg-slate-950/75 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)]"
                    >
                      <h2 className="text-lg font-semibold text-white sm:text-xl">{faq.question}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">{faq.answer}</p>
                    </motion.article>
                  ))}
                </div>
              )}

              {sections.map((section, index) => (
                <motion.section
                  key={section.title}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-3xl border border-slate-800/80 bg-slate-950/75 p-6 shadow-[0_18px_48px_rgba(0,0,0,0.28)] sm:p-8"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <h2 className="text-xl font-semibold text-white sm:text-2xl">{section.title}</h2>
                  </div>

                  {section.paragraphs?.length ? (
                    <div className="mt-5 space-y-4">
                      {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-7 text-slate-300 sm:text-base">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  {section.bullets?.length ? (
                    <ul className="mt-5 space-y-3">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3 text-sm leading-7 text-slate-300 sm:text-base">
                          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </motion.section>
              ))}
            </div>
          </div>
        </section>

        <HomeFooter />
      </div>
    </DarkPageWrapper>
  );
};

export default LegalPageLayout;
