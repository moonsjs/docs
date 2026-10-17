import { Construction } from "lucide-react";
import { useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import type { NavSection, PageData } from "@/lib/content-types";
import { useClientNavigate } from "./client-navigator";
import { Header } from "./header";
import { PrevNext } from "./prev-next";
import { SidebarNav } from "./sidebar-nav";
import { Toc } from "./toc";

export function DocsPage(props: { page: PageData; nav: NavSection[]; version: string }) {
  const { page, nav, version } = props;
  const navigate = useClientNavigate();
  const articleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = articleRef.current;
    if (root === null) {
      return;
    }
    const cleanups: Array<() => void> = [];

    for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
      const listener = (): void => {
        const code = button.closest(".code-block")?.querySelector("pre code");
        const text = code?.textContent ?? "";
        void navigator.clipboard.writeText(text).then(() => {
          const previous = button.textContent;
          button.dataset["copied"] = "true";
          button.textContent = "Copied";
          window.setTimeout(() => {
            button.textContent = previous;
            delete button.dataset["copied"];
          }, 1400);
        });
      };
      button.addEventListener("click", listener);
      cleanups.push(() => button.removeEventListener("click", listener));
    }

    const onLinkClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const clicked = event.target;
      const anchor = clicked instanceof Element ? clicked.closest("a") : null;
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (href === null) {
        return;
      }
      if (href.startsWith("#")) {
        const target = document.getElementById(href.slice(1));
        if (target !== null) {
          event.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          history.replaceState(history.state, "", href);
        }
        return;
      }
      if (!href.startsWith("/") || href.startsWith("//")) {
        return;
      }
      if (anchor.getAttribute("target") === "_blank") {
        return;
      }
      event.preventDefault();
      navigate(href);
    };
    root.addEventListener("click", onLinkClick);
    cleanups.push(() => root.removeEventListener("click", onLinkClick));

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [page.slug, navigate]);

  return (
    <div className="flex min-h-svh flex-col">
      <Header nav={nav} />
      <div className="mx-auto flex w-full max-w-[90rem] flex-1 items-start">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-border scrollbar-thin min-[64rem]:block">
          <div className="flex flex-col gap-8 px-3 py-6">
            <SidebarNav nav={nav} activeHref={`/${page.slug}`} />
            <p className="border-t border-border px-3 pt-4 text-xs text-muted-foreground">
              Moons v{version} · MIT
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-10 sm:px-8 lg:px-12">
          <article className="mx-auto flex max-w-3xl flex-col">
            {page.planned ? (
              <Alert className="mb-7 border-amber-500/40 bg-amber-500/5">
                <Construction className="size-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle>Planned page</AlertTitle>
                <AlertDescription>
                  This page describes upcoming documentation. It is not complete yet.
                </AlertDescription>
              </Alert>
            ) : null}
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {page.title}
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">{page.description}</p>
            <Separator className="my-8" />
            <div
              ref={articleRef}
              className="docs-prose prose prose-neutral max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
            <PrevNext prev={page.prev} next={page.next} />
          </article>
        </main>
        <Toc entries={page.toc} />
      </div>
    </div>
  );
}
