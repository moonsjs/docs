# Moons documentation

The official documentation site for Moons, built with Moons itself and deployed
to **docs.devmoon.net**.

- **Framework**: Moons (`@moonsjs/*` — published packages)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Motion**: `motion/react` (lazy features), `shiki-magic-move`, a small custom
  typing terminal, and one lazy-loaded confetti easter egg
- **Content**: markdown under `content/`, compiled by `scripts/prepare-content.ts`
- **Output**: static export in `dist/client` (including `404.html`) plus
  `dist/server` for `moons start`

## Development

```bash
bun install
bun run dev        # content pipeline, then the dev server on :3000 (PORT=… to override)
```

`bun run dev` and `bun run build` both run `bun run content` first, which compiles
`content/**/*.md` into `src/generated/` (gitignored):

- `content.json` — navigation + rendered pages (only ever loaded by the server)
- `search.json` — the client-side search index (loaded lazily when ⌘K opens)
- `showcase.json` — precompiled magic-move tokens for the landing code morph

## Verify

```bash
bun run check      # content → guard → typegen → tsc → client+server builds → prerender
bun run build      # build + postbuild (sitemap.xml, llms.txt)
bun run smoke      # Playwright + axe checks against dist/client (run `bun run build` first)
bun run lighthouse # Lighthouse CI budgets (auto-discovers Playwright Chromium)
```

`bun run check` includes the public-content guard: it rejects internal references
(design docs, section numbers, internal paths) and absolute internal links that
point at pages that do not exist.

`bun run smoke` covers the landing, client navigation without reload, sidebar and
table of contents, ⌘K search, theme persistence, code copy, pagination, planned
pages, 404, the mobile sheet, the typing terminal, the showcase code morph, the
verification-card easter egg, an axe accessibility gate (no serious/critical
violations), and bundle-size budgets (≤ 80 KB gzip per chunk, ≤ 240 KB total).

## Deploy

The site ships as a static export. `wrangler.jsonc` points Cloudflare Workers
static assets at `./dist/client` with `404-page` handling:

```bash
bun run build
wrangler deploy
```

- `public/_redirects` keeps old URLs (including the former Indonesian pages)
  working with 301s.
- `public/_headers` marks hashed assets immutable and keeps `robots.txt`,
  `sitemap.xml`, and `llms.txt` briefly cacheable.
- `/llms.txt` and `/sitemap.xml` are generated from `content/` by
  `scripts/postbuild.ts`.

## Project structure

```
content/                    markdown pages (frontmatter: title, description, planned)
scripts/prepare-content.ts  markdown → JSON pipeline (marked + shiki + magic-move tokens + llms.txt)
scripts/check-content.ts    public-content guard (internal references + broken links)
scripts/postbuild.ts        sitemap.xml + llms.txt
scripts/smoke.ts            end-to-end checks against dist/ (Playwright + axe)
lighthouserc.json           Lighthouse CI budgets
src/routes/                 file-based routes (index, catch-all docs route, _layout, _404, _error)
src/components/             layout + chrome (header, sidebar, table of contents, search, …)
src/components/ui/          shadcn/ui components
src/lib/showcase-code.ts    landing code snippets shared by the pipeline and the page
src/styles/global.css       Tailwind v4 theme + documentation typography
ai/                         AI context pack bundled into the CLI (not built into the site)
llms.txt                    generated from content/ by prepare-content; shipped in the CLI bundle
```

## Writing documentation

1. Add `content/<section>/<page>.md` with frontmatter:

   ```md
   ---
   title: Page title
   description: One-sentence summary.
   ---
   ```

2. Register the page in the `NAV` array in `scripts/prepare-content.ts`.
3. Use `planned: true` for placeholder pages.
4. Internal links are absolute paths (`/core-concepts/routing`) and navigate
   client-side. Code fences with a language tag get syntax highlighting, a
   language label, and a copy button automatically.

## Motion & accessibility rules

- **Content is visible without JavaScript.** Entrance animations arm only after
  hydration and are disabled under `prefers-reduced-motion`.
- **The hero animates transforms only** (no opacity) so the largest contentful
  paint is not delayed; fonts ship with a metric-compatible fallback so the text
  swap causes no layout shift.
- **Code blocks use the `github-light-default` / `github-dark-default` shiki
  themes** on dedicated code surfaces — the axe gate verifies token contrast.
- **Do not attach `@formkit/auto-animate` to cmdk's command list** (or similar
  measured list components): the observer loop crashes React with "maximum
  update depth exceeded". Keep list transitions CSS-driven.
