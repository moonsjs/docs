#!/usr/bin/env bun
// Pipeline konten docs Moons:
//   markdown (site/**, id/**, api/**, migration/**, manifest.md, ai/**)
//     → HTML (marked + shiki dual-theme) + TOC + sidebar + prev/next
//     → src/generated/content.json  (dibaca lewat virtual:moons-docs-content, SSR saja)
//     → public/raw/**, public/llms.txt, public/llms-full.txt, public/_redirects
// Tautan internal divalidasi di sini (fail-fast): link rusak = build gagal.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Marked, type Tokens } from "marked";
import { createHighlighter } from "shiki";

const SITE = "https://docs.devmoon.net";
const repoRoot = resolve(import.meta.dir, "..");

// Guard runtime: bun 1.2.x tidak bisa mem-parse kode minified React 19.3
// (label `else a: if` → SyntaxError saat prerender). Cloudflare Pages memakai
// image dengan bun 1.2.15 → set env BUN_VERSION=1.4.2 di sana.
{
  const [major = 0, minor = 0] = Bun.version.split(".").map((part) => Number(part));
  if (major < 1 || (major === 1 && minor < 4)) {
    throw new Error(
      `[docs] butuh bun >= 1.4 (sekarang ${Bun.version}). ` +
        "Di Cloudflare Pages set environment variable BUN_VERSION=1.4.2 (Production & Preview).",
    );
  }
}

/* ---------------------------------- util ---------------------------------- */

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      result.push(full);
    }
  }
  return result.sort();
}

const toPosix = (p: string): string => p.split(sep).join("/");

function slugCore(rel: string): string {
  const withoutSite = rel.startsWith("site/") ? rel.slice("site/".length) : rel;
  const lowered = withoutSite.toLowerCase();
  return lowered.endsWith("readme.md")
    ? lowered.slice(0, -"readme.md".length) + "index.md"
    : lowered;
}

function routeSlug(rel: string): string {
  return slugCore(rel).replace(/\.md$/, "").replace(/\/index$/, "") || "index";
}

function headingSlug(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^a-z0-9\u00c0-\u024f]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "section";
}

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/* --------------------------------- sumber --------------------------------- */

interface Source {
  locale: "en" | "id";
  /** repoRel asli: `site/start/quickstart.md`, `id/api/core.md`. */
  repoRel: string;
  /** slug route tanpa locale: `start/quickstart`, `api/core`. */
  slug: string;
  text: string;
}

const sources: Source[] = [];
const SKIPPED = new Set(["site/index.md", "id/site/index.md"]);

for (const dir of ["site", "ai", "api", "migration"]) {
  for (const file of walk(join(repoRoot, dir))) {
    const repoRel = toPosix(relative(repoRoot, file));
    if (SKIPPED.has(repoRel)) {
      continue;
    }
    sources.push({ locale: "en", repoRel, slug: routeSlug(repoRel), text: readFileSync(file, "utf8") });
  }
}
for (const file of [join(repoRoot, "manifest.md")]) {
  sources.push({ locale: "en", repoRel: "manifest.md", slug: "manifest", text: readFileSync(file, "utf8") });
}

for (const dir of ["id/site", "id/api", "id/migration"]) {
  for (const file of walk(join(repoRoot, dir))) {
    const repoRel = toPosix(relative(repoRoot, file));
    if (SKIPPED.has(repoRel)) {
      continue;
    }
    const inner = repoRel.slice("id/".length);
    sources.push({
      locale: "id",
      repoRel,
      slug: routeSlug(inner),
      text: readFileSync(file, "utf8"),
    });
  }
}
sources.push({
  locale: "id",
  repoRel: "id/manifest.md",
  slug: "manifest",
  text: readFileSync(join(repoRoot, "id", "manifest.md"), "utf8"),
});

sources.sort((a, b) => a.repoRel.localeCompare(b.repoRel));

const byRepoRel = new Map(sources.map((source) => [source.repoRel, source]));
const slugSet = {
  en: new Set(sources.filter((s) => s.locale === "en").map((s) => s.slug)),
  id: new Set(sources.filter((s) => s.locale === "id").map((s) => s.slug)),
};

/* ------------------------------- markdown --------------------------------- */

const highlighter = await createHighlighter({
  themes: ["vitesse-light", "vitesse-dark"],
  langs: [
    "ts",
    "tsx",
    "js",
    "jsx",
    "bash",
    "sh",
    "json",
    "jsonc",
    "html",
    "css",
    "md",
    "markdown",
    "diff",
    "yaml",
    "sql",
    "ini",
    "docker",
  ],
});

interface TocEntry {
  depth: number;
  id: string;
  text: string;
}

function resolveRelativeRepoRel(fromRepoRel: string, target: string): string {
  const fromDir = fromRepoRel.split("/").slice(0, -1).join("/");
  const parts: string[] = [];
  for (const part of `${fromDir}/${target}`.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

/** `.md` relatif → route URL; sisanya apa adanya. */
function resolveHref(fromRepoRel: string, href: string): string {
  if (
    href.startsWith("http") ||
    href.startsWith("/") ||
    href.startsWith("#") ||
    href.startsWith("mailto:")
  ) {
    return href;
  }
  const [path, hash = ""] = href.split("#") as [string, string?];
  if (path === undefined || !path.endsWith(".md")) {
    return href;
  }
  const resolved = resolveRelativeRepoRel(fromRepoRel, path);
  const target = byRepoRel.get(resolved);
  if (target === undefined) {
    throw new Error(`[docs] tautan .md tidak ditemukan: ${fromRepoRel} → ${href}`);
  }
  const prefix = target.locale === "en" ? "" : "/id";
  const suffix = hash === undefined || hash.length === 0 ? "" : `#${hash}`;
  return `${prefix}/${target.slug}${suffix}`;
}

interface RenderResult {
  html: string;
  toc: TocEntry[];
  /** Judul dari H1 pertama (bila ada); dipakai saat frontmatter tanpa title. */
  title?: string;
}

/** Satu blok kode → HTML shiki (dual theme). */
async function highlightCode(lang: string, code: string): Promise<string> {
  const requested = lang.trim().split(/\s+/)[0] ?? "";
  const loaded = highlighter.getLoadedLanguages();
  const language = loaded.includes(requested) ? requested : "text";
  try {
    return highlighter.codeToHtml(code, {
      lang: language,
      themes: { light: "vitesse-light", dark: "vitesse-dark" },
    });
  } catch {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
}

/**
 * Ganti setiap fenced code block dengan fence penanda `moons-code` + indeks.
 * Highlighting di-precompute (sinkron untuk marked) — renderer TIDAK async,
 * sehingga tidak ada `[object Promise]` yang bisa bocor ke HTML.
 */
async function precompileFences(
  body: string,
): Promise<{ body: string; blocks: Map<number, string> }> {
  const lines = body.split("\n");
  const out: string[] = [];
  const blocks = new Map<number, string>();
  let index = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const open = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(lines[i] as string);
    if (open === null) {
      out.push(lines[i] as string);
      continue;
    }
    const fenceChar = (open[1] as string)[0] as string;
    const close = new RegExp(`^ {0,3}\\${fenceChar}{3,}\\s*$`);
    const content: string[] = [];
    let j = i + 1;
    while (j < lines.length && !close.test(lines[j] as string)) {
      content.push(lines[j] as string);
      j += 1;
    }
    blocks.set(index, await highlightCode(open[2] ?? "", content.join("\n")));
    out.push("```moons-code", String(index), "```");
    index += 1;
    i = j;
  }
  return { body: out.join("\n"), blocks };
}

async function renderMarkdown(source: Source, body: string): Promise<RenderResult> {
  const toc: TocEntry[] = [];
  const usedIds = new Set<string>();
  const marked = new Marked({ gfm: true });
  const { body: prepared, blocks } = await precompileFences(body);

  marked.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inline = this.parser.parseInline(tokens);
        const plain = inline.replace(/<[^>]+>/g, "");
        let id = headingSlug(plain);
        let counter = 2;
        while (usedIds.has(id)) {
          id = `${headingSlug(plain)}-${counter}`;
          counter += 1;
        }
        usedIds.add(id);
        if (depth >= 2 && depth <= 3) {
          toc.push({ depth, id, text: plain });
        }
        return `<h${depth} id="${id}">${inline}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        if ((lang ?? "").trim() === "moons-code") {
          const highlighted = blocks.get(Number(text.trim()));
          if (highlighted === undefined) {
            throw new Error(`[docs] blok kode tanpa hasil highlight di ${source.repoRel}`);
          }
          return `<div class="code-block"><button type="button" data-code-copy>Copy</button>${highlighted}</div>\n`;
        }
        return `<div class="code-block"><button type="button" data-code-copy>Copy</button><pre><code>${escapeHtml(text)}</code></pre></div>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const resolved = resolveHref(source.repoRel, href);
        const titleAttr = title === null || title === undefined ? "" : ` title="${escapeHtml(title)}"`;
        const external = resolved.startsWith("http");
        return `<a href="${resolved}"${titleAttr}${external ? ' target="_blank" rel="noreferrer"' : ""}>${text}</a>`;
      },
    },
  });

  // H1 pertama dipakai sebagai title halaman (dibuang dari body).
  const lines = prepared.split("\n");
  let inCode = false;
  const h1Index = lines.findIndex((line) => {
    if (line.startsWith("```")) {
      inCode = !inCode;
    }
    return !inCode && /^#\s+\S/.test(line);
  });
  let title: string | null = null;
  if (h1Index !== -1) {
    title = (lines[h1Index] as string).replace(/^#\s+/, "").trim();
    lines.splice(h1Index, 1);
  }

  const html = marked.parse(lines.join("\n")) as string;
  if (html.includes("[object Promise]")) {
    throw new Error(`[docs] artefak [object Promise] di HTML hasil render ${source.repoRel}`);
  }
  return { html, toc, ...(title === null ? {} : { title }) };
}

/* ----------------------------- frontmatter -------------------------------- */

interface ParsedFile {
  title: string | null;
  description: string | null;
  body: string;
}

function parseFile(text: string): ParsedFile {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) {
    return { title: null, description: null, body: text };
  }
  const yaml = match[1] as string;
  const read = (key: string): string | null => {
    const line = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(yaml);
    if (line === null) {
      return null;
    }
    let value = (line[1] as string).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replaceAll('\\"', '"');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    return value;
  };
  return { title: read("title"), description: read("description"), body: text.slice(match[0].length) };
}

function deriveDescription(markdown: string, fallback: string): string {
  const lines = markdown.split("\n");
  let inCode = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || line.length === 0) {
      continue;
    }
    if (/^(#|>|\||[-*]|\d+\.|---)/.test(line)) {
      continue;
    }
    const plain = line
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
    if (plain.length >= 40) {
      return plain.length > 160 ? `${plain.slice(0, 157).trimEnd()}…` : plain;
    }
  }
  return fallback;
}

/* ------------------------------ render pages ------------------------------ */

interface PageData {
  slug: string;
  title: string;
  description: string;
  html: string;
  toc: TocEntry[];
}

const pages: Record<"en" | "id", Record<string, PageData>> = { en: {}, id: {} };

for (const source of sources) {
  const parsed = parseFile(source.text);
  const rendered = await renderMarkdown(source, parsed.body);
  const title = parsed.title ?? rendered.title ?? source.slug;
  const description = parsed.description ?? deriveDescription(parsed.body, title);
  pages[source.locale][source.slug] = {
    slug: source.slug,
    title,
    description,
    html: rendered.html,
    toc: rendered.toc,
  };
  console.log(`  render ${source.locale} ${source.slug} (${rendered.toc.length} heading)`);
}

/* -------------------------------- sidebar --------------------------------- */

interface SidebarConfigItem {
  slug?: string;
  label?: string;
  labelId?: string;
  href?: string;
  enOnly?: boolean;
}
interface SidebarConfigGroup {
  label: string;
  labelId: string;
  items: SidebarConfigItem[];
}

const recipes = Object.keys(pages.en)
  .filter((slug) => slug.startsWith("ai/recipes/") && slug !== "ai/recipes")
  .sort();

const SIDEBAR: SidebarConfigGroup[] = [
  {
    label: "Get started",
    labelId: "Mulai",
    items: [
      { slug: "start/quickstart", label: "Quickstart", labelId: "Mulai cepat" },
      {
        slug: "start/project-structure",
        label: "Project structure",
        labelId: "Struktur proyek",
      },
    ],
  },
  {
    label: "Concepts",
    labelId: "Konsep",
    items: [
      { slug: "concepts/zero-trust", label: "Zero-trust model", labelId: "Model zero-trust" },
      { slug: "concepts/routing", label: "Routing" },
      { slug: "concepts/loaders", label: "Loaders", labelId: "Loader" },
      { slug: "concepts/server-fn", label: "serverFn" },
      { slug: "concepts/context-env", label: "Context & env", labelId: "Konteks & env" },
      {
        slug: "concepts/navigation",
        label: "Navigation & URL params",
        labelId: "Navigasi & parameter URL",
      },
      { slug: "concepts/meta", label: "Meta & SEO" },
      { slug: "concepts/errors", label: "Errors, redirect & 404", labelId: "Error, redirect & 404" },
    ],
  },
  {
    label: "Guides",
    labelId: "Panduan",
    items: [
      {
        slug: "guides/two-sided-validation",
        label: "Two-sided validation",
        labelId: "Validasi dua sisi",
      },
      { slug: "guides/auth-csrf", label: "Auth & CSRF" },
      { slug: "guides/rate-limit", label: "Rate limiting", labelId: "Rate limit" },
      { slug: "guides/api-routes", label: "API routes (src/api)", labelId: "Endpoint API (src/api)" },
      { slug: "guides/prerender-isr", label: "Prerendering & ISR", labelId: "Prerender & ISR" },
      { slug: "guides/uploads", label: "File uploads", labelId: "Upload file" },
      {
        slug: "guides/caching-headers",
        label: "Caching & HTTP headers",
        labelId: "Cache & header HTTP",
      },
      { slug: "guides/testing", label: "Testing", labelId: "Pengujian" },
      {
        slug: "guides/plugins",
        label: "Plugins & lifecycle",
        labelId: "Plugin & siklus hidup",
      },
      { slug: "guides/deploy", label: "Build & deploy" },
    ],
  },
  {
    label: "Reference",
    labelId: "Referensi",
    items: [
      { slug: "api", label: "Packages overview", labelId: "Ikhtisar paket" },
      { slug: "api/core", label: "Core" },
      { slug: "api/server", label: "Server" },
      { slug: "api/react", label: "React" },
      { slug: "api/vite", label: "Vite" },
      { slug: "api/cli", label: "CLI" },
      { slug: "api/mcp", label: "MCP & agent context", labelId: "MCP & konteks agen" },
    ],
  },
  {
    label: "Architecture",
    labelId: "Arsitektur",
    items: [{ slug: "manifest", label: "Manifest" }],
  },
  {
    label: "Migration",
    labelId: "Migrasi",
    items: [
      { slug: "migration/next", label: "Migrating from Next.js", labelId: "Migrasi dari Next.js" },
      { slug: "migration/remix", label: "Migrating from Remix", labelId: "Migrasi dari Remix" },
    ],
  },
  {
    label: "AI agents",
    labelId: "Agen AI",
    items: [
      { slug: "ai/context", label: "Agent context", labelId: "Konteks agen", enOnly: true },
      { slug: "ai/cli-json", label: "CLI JSON contract", labelId: "Kontrak CLI JSON", enOnly: true },
      ...recipes.map((slug) => ({
        slug,
        label: pages.en[slug]?.title ?? slug.replace("ai/recipes/", ""),
        enOnly: true,
      })),
    ],
  },
  {
    label: "Examples",
    labelId: "Contoh",
    items: [{ href: "https://github.com/moonsjs/cookbook", label: "Cookbook (repo)" }],
  },
];

interface JsonSidebarItem {
  label: string;
  slug?: string;
  href?: string;
}
interface JsonSidebarGroup {
  label: string;
  items: JsonSidebarItem[];
}

function buildSidebar(locale: "en" | "id"): JsonSidebarGroup[] {
  const groups: JsonSidebarGroup[] = [];
  for (const group of SIDEBAR) {
    const items: JsonSidebarItem[] = [];
    for (const item of group.items) {
      if (item.href !== undefined) {
        items.push({ label: item.label ?? item.href, href: item.href });
        continue;
      }
      const slug = item.slug as string;
      if (locale === "en") {
        const page = pages.en[slug];
        if (page === undefined) {
          throw new Error(`[docs] sidebar EN menunjuk slug tak ada: ${slug}`);
        }
        items.push({ label: item.label ?? page.title, slug });
      } else if (item.enOnly === true) {
        items.push({ label: item.label ?? slug, href: `/${slug}` });
      } else {
        const page = pages.id[slug];
        if (page === undefined) {
          throw new Error(`[docs] sidebar ID menunjuk slug tak ada: ${slug}`);
        }
        items.push({ label: item.labelId ?? page.title, slug });
      }
    }
    groups.push({ label: locale === "en" ? group.label : group.labelId, items });
  }
  return groups;
}

/** prev/next dari urutan sidebar (hanya item slug, mengikuti locale). */
function buildPrevNext(locale: "en" | "id"): Record<string, { prev?: { label: string; href: string }; next?: { label: string; href: string } }> {
  const flat: Array<{ label: string; href: string; slug: string }> = [];
  for (const group of buildSidebar(locale)) {
    for (const item of group.items) {
      if (item.slug === undefined) {
        continue;
      }
      const prefix = locale === "en" ? "" : "/id";
      flat.push({ label: item.label, href: `${prefix}/${item.slug}`, slug: item.slug });
    }
  }
  const result: Record<string, { prev?: { label: string; href: string }; next?: { label: string; href: string } }> = {};
  flat.forEach((item, index) => {
    const prev = index > 0 ? flat[index - 1] : undefined;
    const next = index < flat.length - 1 ? flat[index + 1] : undefined;
    result[item.slug] = {
      ...(prev === undefined ? {} : { prev: { label: prev.label, href: prev.href } }),
      ...(next === undefined ? {} : { next: { label: next.label, href: next.href } }),
    };
  });
  return result;
}

/* ----------------------------- validasi tautan ---------------------------- */

for (const source of sources) {
  const html = pages[source.locale][source.slug]?.html ?? "";
  for (const match of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
    const href = match[1] as string;
    if (href.startsWith("/raw/") || href.startsWith("/pagefind/") || href.startsWith("/assets/")) {
      continue;
    }
    if (/\.[a-z0-9]{2,5}$/i.test(href)) {
      continue;
    }
    const parts = href.split("/").filter((part) => part.length > 0);
    const isId = parts[0] === "id";
    const slug = (isId ? parts.slice(1) : parts).join("/");
    const known = slug.length === 0 || (isId ? slugSet.id.has(slug) : slugSet.en.has(slug));
    if (!known) {
      throw new Error(`[docs] tautan internal tak dikenal di ${source.repoRel}: ${href}`);
    }
  }
}

/* ------------------------------- content.json ----------------------------- */

const content = {
  en: { pages: pages.en, sidebar: buildSidebar("en"), prevNext: buildPrevNext("en") },
  id: { pages: pages.id, sidebar: buildSidebar("id"), prevNext: buildPrevNext("id") },
};

mkdirSync(join(repoRoot, "src", "generated"), { recursive: true });
writeFileSync(
  join(repoRoot, "src", "generated", "content.json"),
  `${JSON.stringify(content)}\n`,
);

/* ------------------------------ public files ------------------------------ */

// raw/** — markdown asli (tautan .md → URL situs absolut agar tetap terbaca).
rmSync(join(repoRoot, "public", "raw"), { recursive: true, force: true });
for (const source of sources) {
  const dest = join(repoRoot, "public", "raw", source.repoRel);
  mkdirSync(dirname(dest), { recursive: true });
  const rewritten = source.text.replaceAll(
    /\]\((\.\/)?([A-Za-z0-9._/[\].-]+\.md)(#[^)]*)?\)/g,
    (match, _dot: string | undefined, target: string, hash: string | undefined) => {
      if (target.startsWith("http")) {
        return match;
      }
      const resolved = resolveRelativeRepoRel(source.repoRel, target);
      const found = byRepoRel.get(resolved);
      if (found === undefined) {
        return match;
      }
      const prefix = found.locale === "en" ? "" : "/id";
      return `](${SITE}${prefix}/${found.slug}${hash ?? ""})`;
    },
  );
  writeFileSync(dest, rewritten);
}

// llms.txt (sumber → absolut ke /raw/**) + bundel full.
const llmsSource = readFileSync(join(repoRoot, "llms.txt"), "utf8");
let llms = llmsSource.replaceAll(
  /\]\((site|ai|api|migration)\/([^)]+)\.md\)/g,
  (_match, dir: string, path: string) => `](${SITE}/raw/${dir}/${path}.md)`,
);
llms = llms.replaceAll("](manifest.md)", `](${SITE}/raw/manifest.md)`);
llms =
  llms.trimEnd() +
  `\n\n## Bundles\n\n- [llms-full.txt](${SITE}/llms-full.txt): seluruh dokumentasi dalam satu file\n`;
writeFileSync(join(repoRoot, "public", "llms.txt"), `${llms.trimEnd()}\n`);

const fullParts: string[] = [
  "# Moons — full documentation bundle",
  "",
  `> Generated file (do not edit). Sources: ${SITE}/raw/**`,
  "",
];
for (const source of sources) {
  fullParts.push(`\n\n---\n\n<!-- source: /raw/${source.repoRel} -->\n\n`);
  fullParts.push(source.text.trimEnd());
}
fullParts.push("\n");
writeFileSync(join(repoRoot, "public", "llms-full.txt"), fullParts.join(""));

// _redirects — URL lama (slug ID + /en/** + raw) → lokasi baru.
const OLD_TO_NEW: Record<string, string> = {
  "keamanan.md": "concepts/zero-trust.md",
  "mulai/mulai-cepat.md": "start/quickstart.md",
  "mulai/struktur-proyek.md": "start/project-structure.md",
  "dasar/routing.md": "concepts/routing.md",
  "dasar/loader.md": "concepts/loaders.md",
  "dasar/server-fn.md": "concepts/server-fn.md",
  "dasar/context-env.md": "concepts/context-env.md",
  "dasar/navigasi.md": "concepts/navigation.md",
  "dasar/meta.md": "concepts/meta.md",
  "dasar/error.md": "concepts/errors.md",
  "panduan/validasi-dua-sisi.md": "guides/two-sided-validation.md",
  "panduan/auth-dan-csrf.md": "guides/auth-csrf.md",
  "panduan/rate-limit.md": "guides/rate-limit.md",
  "panduan/api-routes.md": "guides/api-routes.md",
  "panduan/prerender.md": "guides/prerender-isr.md",
  "panduan/upload.md": "guides/uploads.md",
  "panduan/cache-dan-http.md": "guides/caching-headers.md",
  "panduan/testing.md": "guides/testing.md",
  "panduan/plugin.md": "guides/plugins.md",
  "panduan/deploy.md": "guides/deploy.md",
};

const toUrl = (rel: string, prefix: string): string => {
  const trimmed = rel
    .replace(/\.md$/, "")
    .replace(/\/index$/, "")
    .replace(/^index$/, "");
  return `${prefix}${trimmed.length === 0 ? "" : `/${trimmed}`}/`;
};

const redirects = ["# Generated by scripts/prepare-content.ts — jangan diubah manual.", "/en/ / 301"];
for (const [oldPath, newPath] of Object.entries(OLD_TO_NEW)) {
  redirects.push(`${toUrl(oldPath, "")} ${toUrl(newPath, "/id")} 301`);
  redirects.push(`${toUrl(oldPath, "/en")} ${toUrl(newPath, "")} 301`);
  redirects.push(`/raw/site/${oldPath} /raw/id/site/${newPath} 301`);
  redirects.push(`/raw/site-en/${oldPath} /raw/site/${newPath} 301`);
}
writeFileSync(join(repoRoot, "public", "_redirects"), `${redirects.join("\n")}\n`);

// sitemap.xml + robots.txt (EN root + /id/**).
const urls: string[] = [`${SITE}/`, `${SITE}/id/`];
for (const slug of Object.keys(pages.en)) {
  urls.push(`${SITE}/${slug}/`);
}
for (const slug of Object.keys(pages.id)) {
  urls.push(`${SITE}/id/${slug}/`);
}
urls.sort();
writeFileSync(
  join(repoRoot, "public", "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n") +
    `\n</urlset>\n`,
);
writeFileSync(
  join(repoRoot, "public", "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

console.log(
  `OK prepare-content (en ${Object.keys(pages.en).length} · id ${Object.keys(pages.id).length} halaman + raw + llms + redirects)`,
);
