// src/components/common/RichText.tsx
import React, { useMemo } from 'react';

/**
 * Renders admin-authored job content (markdown, sometimes pasted HTML) as
 * formatted React nodes. No dependencies and no dangerouslySetInnerHTML —
 * everything is emitted as escaped React elements.
 */

interface RichTextProps {
  content?: string | null;
  className?: string;
}

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'rule' }
  | { type: 'list'; ordered: boolean; items: { text: string; depth: number }[] };

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const RULE_RE = /^(?:-{3,}|\*{3,}|_{3,})$/;
const BULLET_RE = /^(\s*)(?:[-*•]|•)\s+(.*)$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

/** Converts the common HTML tags that sneak in from copy-paste into markdown. */
const htmlToMarkdown = (raw: string): string => {
  if (!/<[a-z][^>]*>/i.test(raw)) return raw;

  return raw
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|li|ul|ol|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n* ')
    .replace(/<\s*h([1-6])[^>]*>/gi, (_m, level: string) => `\n${'#'.repeat(Number(level))} `)
    .replace(/<\s*\/?\s*(?:strong|b)\s*>/gi, '**')
    .replace(/<\s*\/?\s*(?:em|i)\s*>/gi, '*')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
};

const parseBlocks = (raw: string): Block[] => {
  const lines = htmlToMarkdown(raw).replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let quote: string[] = [];
  // True while a wrapped line should be folded back into the open list item.
  let inListItem = false;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  const flushQuote = () => {
    if (quote.length) {
      blocks.push({ type: 'quote', text: quote.join(' ') });
      quote = [];
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushQuote();
  };

  const pushItem = (ordered: boolean, indent: string, text: string) => {
    flushAll();
    inListItem = true;
    const depth = Math.min(Math.floor(indent.replace(/\t/g, '  ').length / 2), 2);
    const last = blocks[blocks.length - 1];
    if (last && last.type === 'list' && last.ordered === ordered) {
      last.items.push({ text, depth });
      return;
    }
    blocks.push({ type: 'list', ordered, items: [{ text, depth }] });
  };

  /** Folds a wrapped line back into the list item it belongs to. */
  const appendToOpenItem = (text: string): boolean => {
    if (!inListItem || paragraph.length) return false;
    const last = blocks[blocks.length - 1];
    if (!last || last.type !== 'list') return false;
    last.items[last.items.length - 1].text += ` ${text}`;
    return true;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushAll();
      inListItem = false;
      continue;
    }

    if (RULE_RE.test(trimmed)) {
      flushAll();
      inListItem = false;
      blocks.push({ type: 'rule' });
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      flushAll();
      inListItem = false;
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    const bullet = line.match(BULLET_RE);
    if (bullet) {
      pushItem(false, bullet[1], bullet[2].trim());
      continue;
    }

    const ordered = line.match(ORDERED_RE);
    if (ordered) {
      pushItem(true, ordered[1], ordered[2].trim());
      continue;
    }

    const quoted = trimmed.match(QUOTE_RE);
    if (quoted) {
      flushParagraph();
      inListItem = false;
      quote.push(quoted[1].trim());
      continue;
    }

    if (appendToOpenItem(trimmed)) continue;

    flushQuote();
    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
};

// Bold, italic, inline code, markdown links and bare URLs.
const INLINE_RE =
  /(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(`[^`\n]+`)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+)/g;

const linkClass = 'text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-words';

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (match[1] || match[2]) {
      nodes.push(
        <strong key={key} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (match[3]) {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (match[4]) {
      nodes.push(
        <code key={key} className="px-1.5 py-0.5 rounded bg-slate-900/70 text-cyan-200 text-[0.9em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    } else if (match[5]) {
      const linkParts = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      const href = linkParts?.[2] ?? '';
      const safe = /^(https?:|mailto:)/i.test(href);
      nodes.push(
        safe ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {linkParts?.[1]}
          </a>
        ) : (
          <React.Fragment key={key}>{linkParts?.[1]}</React.Fragment>
        )
      );
    } else {
      nodes.push(
        <a key={key} href={token} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {token}
        </a>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const headingClass = (level: number): string => {
  if (level <= 2) return 'text-[17px] font-bold text-white mt-6 mb-2 first:mt-0';
  if (level === 3) return 'text-[15px] font-bold text-white mt-5 mb-2 first:mt-0';
  return 'text-[15px] font-semibold text-slate-100 mt-4 mb-1.5 first:mt-0';
};

const indentClass = (depth: number): string =>
  depth === 0 ? '' : depth === 1 ? 'ml-5' : 'ml-10';

export const RichText: React.FC<RichTextProps> = ({ content, className = '' }) => {
  const blocks = useMemo(() => (content ? parseBlocks(content) : []), [content]);

  if (!blocks.length) return null;

  return (
    <div className={`text-slate-300 leading-relaxed text-[15px] ${className}`.trim()}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        switch (block.type) {
          case 'heading': {
            const Tag = (block.level <= 2 ? 'h3' : block.level === 3 ? 'h4' : 'h5') as 'h3' | 'h4' | 'h5';
            return (
              <Tag key={key} className={headingClass(block.level)}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }

          case 'rule':
            return <hr key={key} className="my-5 border-slate-700/50" />;

          case 'quote':
            return (
              <blockquote
                key={key}
                className="my-4 pl-4 border-l-2 border-emerald-500/50 text-slate-400 italic"
              >
                {renderInline(block.text, key)}
              </blockquote>
            );

          case 'list': {
            const ListTag = block.ordered ? 'ol' : 'ul';
            return (
              <ListTag key={key} className="my-3 space-y-1.5">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={`${key}-${itemIndex}`}
                    className={`flex gap-2.5 ${indentClass(item.depth)}`.trim()}
                  >
                    <span
                      className={`flex-shrink-0 ${
                        block.ordered
                          ? 'text-emerald-400 font-semibold tabular-nums'
                          : 'text-emerald-400 leading-[1.6]'
                      }`}
                    >
                      {block.ordered ? `${itemIndex + 1}.` : '•'}
                    </span>
                    <span className="flex-1">{renderInline(item.text, `${key}-${itemIndex}`)}</span>
                  </li>
                ))}
              </ListTag>
            );
          }

          default:
            return (
              <p key={key} className="my-3 first:mt-0 last:mb-0">
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
};

export default RichText;
