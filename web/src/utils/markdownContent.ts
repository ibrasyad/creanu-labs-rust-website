import * as yaml from 'js-yaml';

export interface MarkdownSection {
  id: string;
  title: string;
  body: string;
}

export interface ParsedMarkdownDocument<TFrontmatter = Record<string, any>> {
  frontmatter: TFrontmatter;
  body: string;
  sections: MarkdownSection[];
}

function slugifyHeading(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses an Astro-style Markdown file with optional YAML frontmatter (`--- ... ---`)
 * and splits top-level `## Heading` blocks so pages can lay out sections cleanly.
 */
export function parseMarkdownDocument<TFrontmatter = Record<string, any>>(
  raw: string
): ParsedMarkdownDocument<TFrontmatter> {
  const normalized = raw.replace(/\r\n/g, '\n');
  let frontmatter = {} as TFrontmatter;
  let body = normalized;

  if (normalized.startsWith('---\n')) {
    const endMarkerIdx = normalized.indexOf('\n---\n', 4);
    if (endMarkerIdx !== -1) {
      const fmRaw = normalized.slice(4, endMarkerIdx);
      try {
        frontmatter = ((yaml.load(fmRaw) as TFrontmatter) ?? {}) as TFrontmatter;
      } catch (err) {
        console.error('Failed to parse markdown frontmatter:', err);
      }
      body = normalized.slice(endMarkerIdx + 5).trim();
    }
  }

  const sections: MarkdownSection[] = [];
  const lines = body.split('\n');
  let currentTitle: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentTitle !== null) {
        sections.push({
          id: slugifyHeading(currentTitle),
          title: currentTitle,
          body: currentLines.join('\n').trim(),
        });
      }
      currentTitle = line.slice(3).trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  }

  if (currentTitle !== null) {
    sections.push({
      id: slugifyHeading(currentTitle),
      title: currentTitle,
      body: currentLines.join('\n').trim(),
    });
  }

  return { frontmatter, body, sections };
}
