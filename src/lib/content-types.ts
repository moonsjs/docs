export interface TocEntry {
  depth: number;
  id: string;
  text: string;
}

export interface PageData {
  slug: string;
  title: string;
  description: string;
  html: string;
  toc: TocEntry[];
}

export interface SidebarItem {
  label: string;
  /** slug internal (href dihitung dari locale). */
  slug?: string;
  /** tautan absolut/luar (mis. cookbook, halaman EN untuk locale ID). */
  href?: string;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export interface NavNeighbor {
  label: string;
  href: string;
}

export interface LocaleContent {
  pages: Record<string, PageData>;
  sidebar: SidebarGroup[];
  prevNext: Record<string, { prev?: NavNeighbor; next?: NavNeighbor }>;
}

export interface DocsContent {
  en: LocaleContent;
  id: LocaleContent;
}
