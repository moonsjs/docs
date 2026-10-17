/** Shapes produced by `scripts/prepare-content.ts` (src/generated/content.json). */

export interface TocEntry {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface NavItem {
  title: string;
  href: string;
  planned: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface PageData {
  slug: string;
  title: string;
  description: string;
  planned: boolean;
  html: string;
  toc: TocEntry[];
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}

export interface SearchRecord {
  href: string;
  title: string;
  section: string;
  description: string;
  headings: string[];
  body: string;
}

export interface DocsContent {
  version: string;
  nav: NavSection[];
  pages: Record<string, PageData>;
}
