import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { breadcrumbListSchema, type BreadcrumbItem } from '../../seo/schema';
import { safeJsonLdString } from '../../seo/jsonLdSafety';

interface BreadcrumbsProps {
  /** Ordered list of ancestor items; the current page is passed as the last item and is not linked. */
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Visual + machine-readable breadcrumb trail. Renders BreadcrumbList JSON-LD via its
 * own <Helmet> so it composes with whatever <Seo jsonLd={...}> the page already renders.
 */
export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const trail: BreadcrumbItem[] = [{ name: 'Home', path: '/' }, ...items];

  return (
    <>
      <Helmet>
        <script type="application/ld+json">{safeJsonLdString(breadcrumbListSchema(trail))}</script>
      </Helmet>
      <nav aria-label="Breadcrumb" className={`text-sm ${className}`}>
        <ol className="flex flex-wrap items-center gap-1.5 text-ink-muted">
          {trail.map((item, index) => {
            const isLast = index === trail.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                {isLast ? (
                  <span className="text-brand-500 font-medium" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link to={item.path} className="hover:text-brand-500 transition-colors flex items-center gap-1">
                    {index === 0 && <Home className="w-3.5 h-3.5" aria-hidden="true" />}
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
