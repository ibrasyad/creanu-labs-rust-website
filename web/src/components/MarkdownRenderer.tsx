import React from 'react';
import { ThemeConfig } from '../types/theme';

interface MarkdownRendererProps {
  content: string;
  theme: ThemeConfig;
  className?: string;
}

const SAFE_URL_PROTOCOLS = ['https:', 'http:', 'mailto:'];

function sanitizeHref(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return SAFE_URL_PROTOCOLS.includes(parsed.protocol) ? trimmed : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${partIdx++}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code key={key} className="font-mono font-medium">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderInline(token.slice(2, -2), key)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), key)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, rawHref] = linkMatch;
        const safeHref = sanitizeHref(rawHref);
        if (safeHref) {
          const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
          nodes.push(
            <a
              key={key}
              href={safeHref}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="underline underline-offset-2 text-emerald-600 dark:text-emerald-400 hover:opacity-80"
            >
              {label}
            </a>
          );
        } else {
          nodes.push(label);
        }
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Pure-React Markdown renderer (no raw HTML injection) designed for strict CSP safety.
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  theme,
  className = '',
}) => {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === '---') {
      blocks.push(<hr key={blockKey++} className={`border-t ${theme.borderClass}`} />);
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre
          key={blockKey++}
          className={`p-3 rounded border ${theme.borderClass} bg-black/5 dark:bg-white/5 font-mono text-[11px] overflow-x-auto`}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      blocks.push(
        <h3 key={blockKey++} className="text-xs font-bold uppercase tracking-wider pt-1">
          {renderInline(trimmed.slice(4), `h3-${blockKey}`)}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(
        <h2 key={blockKey++} className="text-sm font-bold uppercase tracking-wider pt-2">
          {renderInline(trimmed.slice(3), `h2-${blockKey}`)}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      blocks.push(
        <h1 key={blockKey++} className="text-xl font-bold tracking-tight">
          {renderInline(trimmed.slice(2), `h1-${blockKey}`)}
        </h1>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))
      ) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={blockKey++} className={`space-y-1.5 text-xs ${theme.mutedClass}`}>
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span aria-hidden="true">&bull;</span>
              <span>{renderInline(item, `li-${blockKey}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      lines[i].trim() !== '---' &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('- ') &&
      !lines[i].trim().startsWith('* ') &&
      !lines[i].trim().startsWith('```')
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    const paragraph = paraLines.join(' ');
    blocks.push(
      <p key={blockKey++} className={`text-xs leading-relaxed ${theme.mutedClass}`}>
        {renderInline(paragraph, `p-${blockKey}`)}
      </p>
    );
  }

  return <div className={`space-y-2.5 ${className}`.trim()}>{blocks}</div>;
};
