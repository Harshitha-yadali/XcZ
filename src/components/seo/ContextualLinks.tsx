import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { InternalLink } from '../../seo/internalLinks';

interface ContextualLinksProps {
  title?: string;
  links: InternalLink[];
  className?: string;
}

/**
 * Renders a contextual internal-linking block. This is the visual half of the
 * internal linking engine (see src/seo/internalLinks.ts for the link registry) —
 * used on role/company/comparison/landing pages and blog posts so every generated
 * page links out to real tools and content instead of being a dead end for crawlers.
 */
export function ContextualLinks({ title = 'Keep going', links, className = '' }: ContextualLinksProps) {
  if (!links.length) return null;

  return (
    <section className={`rounded-2xl border border-surface bg-surface-sunken/60 p-6 ${className}`} aria-label={title}>
      <h2 className="text-lg font-semibold text-slate-100 mb-4">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.path}>
            <Link
              to={link.path}
              className="group flex items-start justify-between gap-3 rounded-xl border border-surface bg-surface/50 p-4 hover:border-brand-500/50 hover:bg-surface transition-colors"
            >
              <span>
                <span className="block font-medium text-slate-100 group-hover:text-brand-500 transition-colors">
                  {link.label}
                </span>
                <span className="block text-sm text-ink-muted mt-0.5">{link.description}</span>
              </span>
              <ArrowRight className="w-4 h-4 mt-1 shrink-0 text-ink-muted group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
