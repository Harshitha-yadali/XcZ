import { List } from 'lucide-react';

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Runs client-side only (uses DOMParser). Walks the post's rendered HTML for h2/h3 tags,
 * assigns anchor ids (de-duplicated), and returns both the id-annotated HTML to render and
 * the flat list of headings to drive the on-page table of contents.
 */
export function processContentHeadings(html: string): { html: string; toc: TocItem[] } {
  if (typeof window === 'undefined' || !html) return { html, toc: [] };

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings = doc.querySelectorAll('h2, h3');
  const toc: TocItem[] = [];
  const usedIds = new Set<string>();

  headings.forEach((heading) => {
    const text = heading.textContent?.trim() || '';
    if (!text) return;
    let id = slugify(text);
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${slugify(text)}-${suffix++}`;
    }
    usedIds.add(id);
    heading.id = id;
    toc.push({ id, text, level: heading.tagName === 'H2' ? 2 : 3 });
  });

  return { html: doc.body.innerHTML, toc };
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length < 2) return null;

  return (
    <nav aria-label="Table of contents" className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-700/50 p-6 mb-8">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
        <List className="w-4 h-4" /> Table of contents
      </h2>
      <ul className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'ml-4' : ''}>
            <a href={`#${item.id}`} className="text-slate-400 hover:text-emerald-400 transition-colors">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
