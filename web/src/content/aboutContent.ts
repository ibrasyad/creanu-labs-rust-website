import aboutMdRaw from './about.md?raw';
import { parseMarkdownDocument } from '../utils/markdownContent';

export interface AboutFrontmatter {
  kicker: string[];
  title: string;
  lead: string;
  ctaPrimary: string;
  ctaSecondary: string;
}

export const ABOUT_CONTENT = parseMarkdownDocument<AboutFrontmatter>(aboutMdRaw);
