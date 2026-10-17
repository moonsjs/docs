#!/usr/bin/env bun
/**
 * Builds the documentation content bundle.
 *
 *   content/**\/*.md  →  src/generated/content.json  (server-only: nav + pages)
 *                        src/generated/search.json   (client-safe: search index)
 *
 * Run via `bun run content` (also wired into `dev`/`build`/`check`).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { marked, type Tokens } from "marked";
import { createHighlighter } from "shiki";
import { codeToKeyedTokens } from "shiki-magic-move/core";
import type { NavSection, PageData, SearchRecord, TocEntry } from "../src/lib/content-types";
import { SHOWCASE_CLIENT_CODE, SHOWCASE_SERVER_CODE } from "../src/lib/showcase-code";

const root = new URL("..", import.meta.url).pathname;
const contentDir = join(root, "content");
const outDir = join(root, "src", "generated");

/** Sidebar structure — order of sections and pages is defined here. */
const NAV: Array<{ title: string; slugs: string[] }> = [
  {
    title: "Get Started",
    slugs: ["getting-started/installation", "getting-started/first-app"],
  },
  {
    title: "Core Concepts",
    slugs: [
      "core-concepts/zero-trust",
      "core-concepts/routing",
      "core-concepts/server-fn",
      "core-concepts/loaders",
      "core-concepts/context-and-environment",
      "core-concepts/navigation",
      "core-concepts/error-handling",
    ],
  },
  {
    title: "Guides",
    slugs: [
      "guides/authentication",
      "guides/databases",
      "guides/api-routes",
      "guides/middleware",
      "guides/forms",
      "guides/deployment",
      "guides/prerender-and-isr",
      "guides/testing",
      "guides/migrating-from-nextjs",
      "guides/migrating-from-remix",
    ],
  },
  {
    title: "API Reference",
    slugs: ["api/core", "api/server", "api/react", "api/vite", "api/cli", "api/mcp"],
  },
  {
    title: "Recipes",
    slugs: ["recipes/notes-app", "recipes/protected-route", "recipes/forms-revalidation"],
  },
  {
    title: "Architecture",
    slugs: ["architecture"],
  },
];

const highlighter = await createHighlighter({
  themes: ["github-light-default", "github-dark-default"],
  langs: ["ts", "tsx", "bash", "json", "html", "css", "markdown", "text"],
});

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

interface RendererThis {
  parser: { parseInline(tokens: Tokens.Generic[] | undefined): string };
}

const toc: TocEntry[] = [];

marked.use({
  gfm: true,
  renderer: {
    heading(this: RendererThis, { tokens, depth }: Tokens.Heading): string {
      const inline = this.parser.parseInline(tokens);
      const plain = inline.replace(/<[^>]+>/g, "").trim();
      const id = slugify(plain);
      if (depth === 2 || depth === 3) {
        toc.push({ id, text: plain, depth });
      }
      return `<h${depth} id="${esc(id)}">${inline}</h${depth}>\n`;
    },
    code({ text, lang }: Tokens.Code): string {
      const requested = (lang ?? "").trim().split(/\s+/)[0] ?? "";
      const loaded = highlighter.getLoadedLanguages();
      const language = loaded.includes(requested) ? requested : "text";
      const html = highlighter.codeToHtml(text, {
        lang: language,
        themes: { light: "github-light-default", dark: "github-dark-default" },
      });
      return `<div class="code-block not-prose" data-lang="${esc(language)}"><div class="code-block__bar"><span>${esc(language)}</span><button type="button" class="code-copy" data-copy>Copy</button></div>${html}</div>\n`;
    },
    link(this: RendererThis, { href, title, tokens }: Tokens.Link): string {
      const text = this.parser.parseInline(tokens);
      const titleAttr = title === null || title === undefined ? "" : ` title="${esc(title)}"`;
      const external = /^https?:\/\//.test(href);
      return external
        ? `<a href="${esc(href)}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`
        : `<a href="${esc(href)}"${titleAttr}>${text}</a>`;
    },
  },
});

interface Frontmatter {
  title: string;
  description: string;
  planned: boolean;
}

function parseFrontmatter(source: string, file: string): { meta: Frontmatter; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  const meta: Record<string, string> = {};
  if (match !== null) {
    for (const line of (match[1] ?? "").split(/\r?\n/)) {
      const index = line.indexOf(":");
      if (index > 0) {
        const key = line.slice(0, index).trim();
        let value = line.slice(index + 1).trim();
        const quoted =
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"));
        if (quoted && value.length >= 2) {
          value = value.slice(1, -1);
        }
        meta[key] = value;
      }
    }
  }
  const title = meta["title"];
  const description = meta["description"];
  if (title === undefined || description === undefined) {
    throw new Error(`[docs] ${file}: frontmatter must define "title" and "description"`);
  }
  return {
    meta: { title, description, planned: meta["planned"] === "true" },
    body: match === null ? source : source.slice(match[0].length),
  };
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCoreVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("@moonsjs/core");
    const pkg = JSON.parse(readFileSync(join(entry, "..", "..", "package.json"), "utf8")) as {
      version?: string;
    };
    return pkg.version ?? "0.1.0";
  } catch {
    return "0.1.0";
  }
}

const pages: Record<string, PageData> = {};
const nav: NavSection[] = [];
const search: SearchRecord[] = [];

for (const section of NAV) {
  const items: NavSection["items"] = [];
  for (const slug of section.slugs) {
    const file = join(contentDir, `${slug}.md`);
    let source: string;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      throw new Error(`[docs] missing content file: content/${slug}.md`);
    }
    const { meta, body } = parseFrontmatter(source, `content/${slug}.md`);

    toc.length = 0;
    const html = marked.parse(body) as string;
    if (html.includes("[object Promise]")) {
      throw new Error(`[docs] async leak in rendered HTML for content/${slug}.md`);
    }

    const href = `/${slug}`;
    items.push({ title: meta.title, href, planned: meta.planned });
    pages[slug] = {
      slug,
      title: meta.title,
      description: meta.description,
      planned: meta.planned,
      html,
      toc: [...toc],
    };
    search.push({
      href,
      title: meta.title,
      section: section.title,
      description: meta.description,
      headings: toc.map((entry) => entry.text),
      body: plainText(html).slice(0, 280),
    });
  }
  nav.push({ title: section.title, items });
}

// Previous / next links follow the flat navigation order.
const flat = nav.flatMap((section) => section.items);
flat.forEach((item, index) => {
  const slug = item.href.replace(/^\//, "");
  const page = pages[slug];
  if (page === undefined) {
    return;
  }
  const prev = flat[index - 1];
  const next = flat[index + 1];
  if (prev !== undefined) {
    page.prev = { title: prev.title, href: prev.href };
  }
  if (next !== undefined) {
    page.next = { title: next.title, href: next.href };
  }
});

mkdirSync(outDir, { recursive: true });
const version = readCoreVersion();

// Landing showcase: precompile keyed tokens at build time so the browser
// never needs a shiki highlighter (the renderer only replays the tokens).
const showcaseThemes = {
  themes: { light: "github-light-default", dark: "github-dark-default" },
  defaultColor: false,
} as const;
const showcase = {
  server: codeToKeyedTokens(highlighter, SHOWCASE_SERVER_CODE, {
    lang: "ts",
    ...showcaseThemes,
  }),
  client: codeToKeyedTokens(highlighter, SHOWCASE_CLIENT_CODE, {
    lang: "ts",
    ...showcaseThemes,
  }),
};
writeFileSync(
  join(outDir, "content.json"),
  JSON.stringify({ version, nav, pages }),
);
writeFileSync(join(outDir, "search.json"), JSON.stringify(search));
writeFileSync(join(outDir, "showcase.json"), JSON.stringify(showcase));

// Root llms.txt: agent entry point. Postbuild copies it into dist/client, and
// the CLI bundle ships the same file.
const sectionBlocks = nav.map((section) =>
  [
    `## ${section.title}`,
    ...section.items.map((item) => {
      const page = pages[item.href.slice(1)];
      return page === undefined
        ? `- [${item.title}](https://docs.devmoon.net${item.href})`
        : `- [${item.title}](https://docs.devmoon.net${item.href}): ${page.description}`;
    }),
    "",
  ].join("\n"),
);
const llms = [
  "# Moons",
  "",
  "> Moons is a full-stack TypeScript framework (file routing, SSR, React hydration)",
  "> whose single guarantee is zero-trust: `*.server.ts` modules become typed RPC",
  "> stubs, and leaking server code fails the build.",
  "",
  "Site: https://docs.devmoon.net",
  "Agent context bundled with the CLI: `node_modules/@moonsjs/cli/docs/ai/CONTEXT.md`",
  "(also used by `moons-mcp` `search_docs`).",
  "",
  ...sectionBlocks,
  "## Packages",
  "",
  "`@moonsjs/core` · `@moonsjs/server` · `@moonsjs/react` · `@moonsjs/vite` ·",
  "`@moonsjs/cli` · `@moonsjs/mcp` — developed in the open at github.com/moonsjs.",
  "",
].join("\n");
writeFileSync(join(root, "llms.txt"), llms);

const planned = Object.values(pages).filter((page) => page.planned).length;
console.log(
  `[docs] content ready — ${flat.length} pages (${planned} planned) · version ${version} · search ${search.length}`,
);
