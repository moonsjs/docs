import type { LocaleContent, NavNeighbor, PageData } from "../lib/content-types";
import { Header } from "./Header";
import { PrevNext } from "./PrevNext";
import { Sidebar } from "./Sidebar";
import { Toc } from "./Toc";

export interface DocsPageData {
  page: PageData;
  sidebar: LocaleContent["sidebar"];
  nav: { prev?: NavNeighbor; next?: NavNeighbor };
}

export function DocsPage(props: { locale: "en" | "id"; data: DocsPageData }) {
  const { page, sidebar, nav } = props.data;
  return (
    <div className="docs-shell">
      <Header locale={props.locale} slug={page.slug} />
      <div className="shell docs-grid">
        <aside className="docs-sidebar">
          <Sidebar locale={props.locale} groups={sidebar} current={page.slug} />
        </aside>
        <main className="docs-article">
          <h1>{page.title}</h1>
          <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
          <PrevNext prev={nav.prev} next={nav.next} />
        </main>
        <aside className="docs-toc-wrap">
          <Toc entries={page.toc} />
        </aside>
      </div>
    </div>
  );
}
