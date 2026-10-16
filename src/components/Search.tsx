import { useEffect, useRef, useState } from "react";

interface PagefindModule {
  init?: () => Promise<void>;
  search: (
    query: string,
  ) => Promise<{
    results: Array<{
      data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }>;
    }>;
  }>;
}

interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
}

/**
 * Pencarian statis via Pagefind (diindeks saat postbuild dari HTML di dist/).
 * Modul Pagefind dimuat saat dialog pertama dibuka — bukan bagian bundle.
 */
export function Search() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [ready, setReady] = useState(false);
  const pagefind = useRef<PagefindModule | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    inputRef.current?.focus();
    if (pagefind.current !== null) {
      return;
    }
    void (async () => {
      try {
        const url = "/pagefind/pagefind.js";
        const module = (await import(/* @vite-ignore */ url)) as PagefindModule;
        await module.init?.();
        pagefind.current = module;
        setReady(true);
      } catch {
        setReady(false);
      }
    })();
  }, [open]);

  async function runSearch(value: string) {
    setQuery(value);
    const module = pagefind.current;
    if (module === null || value.trim().length === 0) {
      setResults([]);
      return;
    }
    const found = await module.search(value);
    const top = await Promise.all(found.results.slice(0, 8).map((item) => item.data()));
    setResults(
      top.map((item) => ({
        url: item.url,
        title: item.meta.title ?? item.url,
        excerpt: item.excerpt,
      })),
    );
  }

  return (
    <>
      <button className="search-button" type="button" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <span>Search</span>
        <kbd>⌘K</kbd>
      </button>

      {open ? (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
          <button className="search-backdrop" type="button" aria-label="Close search" onClick={() => setOpen(false)} />
          <div className="search-panel">
            <input
              ref={inputRef}
              className="search-input"
              type="search"
              placeholder={ready ? "Search the docs…" : "Loading index…"}
              value={query}
              onChange={(event) => void runSearch(event.target.value)}
            />
            <ul className="search-results">
              {results.map((result) => (
                <li key={result.url}>
                  <a href={result.url}>
                    <span className="search-title">{result.title}</span>
                    <span className="search-excerpt" dangerouslySetInnerHTML={{ __html: result.excerpt }} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
