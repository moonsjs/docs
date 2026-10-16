#!/usr/bin/env bun
// Generate proyek Starlight dari sumber markdown repo ini:
//   site/**      → halaman ID (slug tanpa prefix)
//   site-en/**   → terjemahan EN (slug `en/**`)
//   ai/**, api/**, migration/**, manifest.md → referensi & konteks agen
// Output: src/content/docs/**, public/raw/**, public/llms.txt, public/llms-full.txt.
// Sumber: scripts/build.ts (adaptasi scripts/mirror/build-docs-site.ts).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const SITE = "https://docs.devmoon.net";
const repoRoot = resolve(import.meta.dir, "..");

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

interface Source {
  /** Path relatif repo: `site/mulai/mulai-cepat.md`, `manifest.md`. */
  repoRel: string;
  /** Path raw publik: `site/mulai/mulai-cepat.md`, `ai/CONTEXT.md`. */
  rawRel: string;
  /** Path konten Starlight: `mulai/mulai-cepat.md`, `en/mulai/mulai-cepat.md`. */
  slugRel: string;
  text: string;
}

function toPosix(p: string): string {
  return p.split(sep).join("/");
}

function slugFor(rawRel: string): string {
  // Halaman manusia berada di `site/**` — prefix dibuang dari URL.
  const withoutSite = rawRel.startsWith("site/") ? rawRel.slice("site/".length) : rawRel;
  const lowered = withoutSite.toLowerCase();
  return lowered.endsWith("readme.md")
    ? lowered.slice(0, -"readme.md".length) + "index.md"
    : lowered;
}

function yamlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** URL situs untuk sebuah slug konten: `api/core.md` → `/api/core/`, `api/index.md` → `/api/`. */
function slugUrl(slugRel: string): string {
  const withoutExt = slugRel.replace(/\.md$/, "");
  const trimmed = withoutExt.replace(/\/index$/, "").replace(/^index$/, "");
  return trimmed.length === 0 ? "/" : `/${trimmed}/`;
}

/** Rewrite link `.md` relatif (mis. `./m1.md`, `recipes/x.md`) ke URL situs absolut. */
function rewriteRelativeMdLinks(
  text: string,
  fromRepoRel: string,
  byRepoRel: Map<string, Source>,
  prefix: string,
): string {
  const fromDir = fromRepoRel.split("/").slice(0, -1).join("/");
  return text.replaceAll(
    /\]\((\.\/)?([A-Za-z0-9._/-]+\.md)(#[^)]*)?\)/g,
    (match, _dot: string | undefined, target: string, anchor: string | undefined) => {
      if (target.startsWith("http") || target.startsWith("/")) {
        return match;
      }
      const segments: string[] = [];
      for (const part of `${fromDir}/${target}`.split("/")) {
        if (part === "." || part.length === 0) {
          continue;
        }
        if (part === "..") {
          segments.pop();
          continue;
        }
        segments.push(part);
      }
      const resolved = segments.join("/");
      const source = byRepoRel.get(resolved);
      if (source === undefined) {
        return match;
      }
      return `](${prefix}${slugUrl(source.slugRel)}${anchor ?? ""})`;
    },
  );
}

/** Pisahkan frontmatter YAML di awal berkas (jika ada) dari body. */
function splitFrontmatter(text: string): { yaml: string | null; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (match === null) {
    return { yaml: null, body: text };
  }
  return { yaml: match[1] as string, body: text.slice(match[0].length) };
}

function unquoteYaml(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('\\"', '"').replaceAll("\\\\", "\\");
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }
  return trimmed;
}

/** Ambil (dan buang) H1 pertama sebagai title. */
function titleFromH1(body: string): { title: string | null; body: string } {
  const lines = body.split("\n");
  const index = lines.findIndex((line) => /^#\s+\S/.test(line));
  if (index === -1) {
    return { title: null, body };
  }
  const title = (lines[index] as string).replace(/^#\s+/, "").trim();
  const rest = [...lines.slice(0, index), ...lines.slice(index + 1)].join("\n").trimStart();
  return { title, body: rest };
}

/** Ringkasan satu baris dari paragraf pertama body — meta description per halaman. */
function deriveDescription(body: string): string | null {
  const lines = body.split("\n");
  const excluded = (line: string): boolean => /^(#|```|>|\||-|\*|\d+\.|---)/.test(line);
  let inCode = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] as string).trim();
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || line.length === 0 || excluded(line)) continue;
    const paragraph: string[] = [line];
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = (lines[next] as string).trim();
      if (candidate.length === 0 || excluded(candidate) || candidate.startsWith("```")) break;
      paragraph.push(candidate);
    }
    const plain = paragraph
      .join(" ")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (plain.length < 40 || plain.endsWith(":")) continue;
    return truncateDescription(plain);
  }
  return null;
}

/** Potong ~160 char pada batas kata, tanpa kata gantung. */
function truncateDescription(text: string, max = 160): string {
  if (text.length <= max) {
    return text;
  }
  let cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) {
    cut = cut.slice(0, lastSpace);
  }
  cut = cut.replace(/[\s—:;,.\-]+$/u, "");
  const words = cut.split(" ");
  const last = words[words.length - 1];
  if (last !== undefined && /^(dan|atau|yang|di|ke|dari|untuk|dengan|pada|ini|itu)$/.test(last)) {
    words.pop();
    cut = words.join(" ");
  }
  return `${cut}…`;
}

/** Siapkan halaman Starlight: title dari frontmatter → H1 → fallback; H1 dibuang. */
function preparePage(
  text: string,
  fallback: string,
): { title: string; yaml: string | null; body: string; description: string | null } {
  const { yaml, body } = splitFrontmatter(text);
  const fromH1 = titleFromH1(body);
  const hasDescription = yaml !== null && /^description:\s*\S/m.test(yaml);
  const description = hasDescription ? null : deriveDescription(fromH1.body);
  if (yaml !== null) {
    const titleMatch = /^title:\s*(.+)$/m.exec(yaml);
    const title =
      titleMatch === null ? (fromH1.title ?? fallback) : unquoteYaml(titleMatch[1] as string);
    const cleanBody = fromH1.body.replace(/^\n+/, "");
    return { title, yaml, body: cleanBody, description };
  }
  return { title: fromH1.title ?? fallback, yaml: null, body: fromH1.body, description };
}

// 1) Kumpulkan sumber
const sources: Source[] = [];
for (const dir of ["site", "ai", "api", "migration"]) {
  for (const file of walk(join(repoRoot, dir))) {
    const rel = toPosix(relative(repoRoot, file));
    sources.push({
      repoRel: rel,
      rawRel: rel,
      slugRel: slugFor(rel),
      text: readFileSync(file, "utf8"),
    });
  }
}
const manifestPath = join(repoRoot, "manifest.md");
if (existsSync(manifestPath)) {
  sources.push({
    repoRel: "manifest.md",
    rawRel: "manifest.md",
    slugRel: "manifest.md",
    text: readFileSync(manifestPath, "utf8"),
  });
}
const siteEnRoot = join(repoRoot, "site-en");
if (existsSync(siteEnRoot)) {
  for (const file of walk(siteEnRoot)) {
    const rel = toPosix(relative(siteEnRoot, file));
    sources.push({
      repoRel: `site-en/${rel}`,
      rawRel: `site-en/${rel}`,
      slugRel: `en/${rel}`,
      text: readFileSync(file, "utf8"),
    });
  }
}
sources.sort((a, b) => a.rawRel.localeCompare(b.rawRel));

if (sources.length === 0) {
  throw new Error("tidak ada markdown sumber di repo ini");
}
if (!sources.some((source) => source.slugRel === "index.md")) {
  throw new Error("site/index.md (landing) tidak ditemukan");
}
if (!sources.some((source) => source.slugRel === "en/index.md")) {
  throw new Error("site-en/index.md (landing EN) tidak ditemukan");
}

// 2) Halaman Starlight (frontmatter title + H1 dihapus)
const byRepoRel = new Map(sources.map((source) => [source.repoRel, source]));
const contentRoot = join(repoRoot, "src", "content", "docs");
rmSync(join(repoRoot, "src", "content"), { recursive: true, force: true });
for (const source of sources) {
  const { title, yaml, body, description } = preparePage(source.text, source.rawRel);
  const dest = join(contentRoot, source.slugRel);
  mkdirSync(dirname(dest), { recursive: true });
  const descriptionLine = description === null ? "" : `description: ${yamlString(description)}\n`;
  const frontmatter =
    yaml === null
      ? `---\ntitle: ${yamlString(title)}\n${descriptionLine}---`
      : /^title:\s*\S/m.test(yaml)
        ? `---\n${yaml}\n${descriptionLine}---`
        : `---\ntitle: ${yamlString(title)}\n${yaml}\n${descriptionLine}---`;
  writeFileSync(
    dest,
    `${frontmatter}\n\n${rewriteRelativeMdLinks(body, source.repoRel, byRepoRel, "")}\n`,
  );
}

// 3) Markdown mentah untuk agen (case asli; link internal diarahkan ke situs)
for (const source of sources) {
  const dest = join(repoRoot, "public", "raw", source.rawRel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, rewriteRelativeMdLinks(source.text, source.repoRel, byRepoRel, SITE));
}

// 4) llms.txt situs (tautan dibuat absolut ke /raw/**)
const llmsSource = join(repoRoot, "llms.txt");
if (existsSync(llmsSource)) {
  let llms = readFileSync(llmsSource, "utf8");
  llms = llms.replaceAll(
    /\]\((site|ai|api|migration)\/([^)]+)\.md\)/g,
    (_match, dir: string, path: string) => `](${SITE}/raw/${dir}/${path}.md)`,
  );
  llms = llms.replaceAll("](manifest.md)", `](${SITE}/raw/manifest.md)`);
  llms =
    llms.trimEnd() +
    `\n\n## Bundles\n\n- [llms-full.txt](${SITE}/llms-full.txt): seluruh dokumentasi dalam satu file\n`;
  mkdirSync(join(repoRoot, "public"), { recursive: true });
  writeFileSync(join(repoRoot, "public", "llms.txt"), llms);
}

// 5) llms-full.txt (gabungan mekanis — nol drift)
const fullParts: string[] = [
  "# Moons — full documentation bundle",
  "",
  `> Generated file (do not edit). Sources: ${SITE}/raw/**`,
  "",
];
for (const source of sources) {
  fullParts.push(`\n\n---\n\n<!-- source: /raw/${source.rawRel} -->\n\n`);
  fullParts.push(source.text.trimEnd());
}
fullParts.push("\n");
mkdirSync(join(repoRoot, "public"), { recursive: true });
writeFileSync(join(repoRoot, "public", "llms-full.txt"), fullParts.join(""));

console.log(`OK build docs (${sources.length} halaman + raw + llms)`);
