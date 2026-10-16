import { HomeLink } from "./DocLink";
import { Search } from "./Search";

/**
 * Header bersama untuk halaman docs & landing.
 * Ikon = SVG inline (tanpa emoji); tombol tema ditangani script di index.html.
 */
export function Header(props: { locale: "en" | "id"; slug?: string }) {
  const other = props.locale === "en" ? "id" : "en";
  const otherHref =
    other === "en"
      ? "/"
      : props.slug === undefined
        ? "/id"
        : `/id/${props.slug}`;
  const currentHref =
    props.locale === "en" ? (props.slug === undefined ? "/" : `/${props.slug}`) : undefined;

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <button className="nav-toggle" type="button" data-nav-toggle aria-label="Toggle navigation">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinecap="round" />
          </svg>
        </button>

        <HomeLink locale={props.locale}>
          <img src="/logo.svg" alt="" width={22} height={22} />
          <span>Moons</span>
        </HomeLink>

        <nav className="header-links" aria-label="Primary">
          <a
            href={currentHref ?? (props.locale === "en" ? "/" : "/id")}
            className="header-link"
          >
            Docs
          </a>
          <a className="header-link" href="https://github.com/moonsjs/cookbook">
            Cookbook
          </a>
        </nav>

        <div className="header-actions">
          <Search />
          <a className="lang-switch" href={otherHref} aria-label={`Switch to ${other}`}>
            {other.toUpperCase()}
          </a>
          <button className="icon-button" type="button" data-theme-toggle aria-label="Toggle theme">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <a className="icon-button" href="https://github.com/moonsjs" aria-label="GitHub">
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
