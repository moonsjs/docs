declare module "*.css";

declare module "virtual:moons-docs-content" {
  import type { DocsContent } from "../lib/content-types";
  export const content: DocsContent;
}

declare module "/pagefind/pagefind.js" {
  export function init(): Promise<void>;
  export function search(query: string): Promise<{
    results: Array<{ id: string; data(): Promise<PagefindResultData> }>;
  }>;
  export interface PagefindResultData {
    url: string;
    meta: { title?: string };
    excerpt: string;
  }
}
