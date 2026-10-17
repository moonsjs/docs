import { useEffect, useState, type MouseEvent } from "react";
import type { TocEntry } from "@/lib/content-types";
import { cn } from "@/lib/utils";

export function Toc(props: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState<string | null>(props.entries[0]?.id ?? null);

  // Hash links fire popstate in the browser, and the router treats popstate as
  // back/forward navigation (restoring scroll to 0). Scroll manually and
  // update the URL with replaceState instead.
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string): void => {
    const target = document.getElementById(id);
    if (target === null) {
      return;
    }
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(history.state, "", `#${id}`);
    setActiveId(id);
  };

  useEffect(() => {
    const headings = props.entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    if (headings.length === 0) {
      return;
    }
    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first !== undefined) {
          setActiveId(first.target.id);
        }
      },
      { rootMargin: "-72px 0px -68% 0px", threshold: [0, 1] },
    );
    for (const heading of headings) {
      observer.observe(heading);
    }
    return () => observer.disconnect();
  }, [props.entries]);

  if (props.entries.length === 0) {
    return null;
  }

  return (
    <nav aria-label="On this page" className="sticky top-14 hidden max-h-[calc(100svh-3.5rem)] w-56 shrink-0 overflow-y-auto pt-12 pl-2 scrollbar-thin min-[80rem]:block">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="mt-3 flex flex-col border-l border-border">
        {props.entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={(event) => handleClick(event, entry.id)}
              className={cn(
                "-ml-px flex border-l py-1 pl-3 text-[13px] leading-snug transition-colors",
                entry.depth === 3 && "pl-6",
                activeId === entry.id
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
