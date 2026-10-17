import type { NavSection } from "@/lib/content-types";
import { GithubIcon } from "./github-icon";
import { MobileNav } from "./mobile-nav";
import { Search } from "./search";
import { SmartLink } from "./smart-link";
import { ThemeToggle } from "./theme-toggle";

const navLinkClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";

export function Header(props: { nav?: NavSection[] | undefined }) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand/0 via-brand/70 to-brand-2/60"
      />
      <div className="mx-auto flex h-14 w-full max-w-[90rem] items-center gap-2 px-4 sm:px-6">
        {props.nav !== undefined ? (
          <MobileNav nav={props.nav} />
        ) : (
          <div className="size-9 min-[64rem]:hidden" aria-hidden="true" />
        )}
        <SmartLink
          href="/"
          className="mr-1 flex items-center gap-2 rounded-md px-2 py-1.5 font-semibold tracking-tight"
        >
          <img src="/logo.svg" alt="" width={22} height={22} />
          <span>Moons</span>
        </SmartLink>
        <nav className="hidden items-center gap-1 min-[64rem]:flex" aria-label="Primary">
          <SmartLink href="/getting-started/installation" className={navLinkClass}>
            Docs
          </SmartLink>
          <a
            href="https://github.com/moonsjs/cookbook"
            target="_blank"
            rel="noreferrer"
            className={navLinkClass}
          >
            Cookbook
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Search />
          <a
            href="https://github.com/moonsjs"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubIcon className="size-4" />
          </a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
