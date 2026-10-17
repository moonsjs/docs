#!/usr/bin/env bun
// Public docs guard: internal references are forbidden in public docs, and
// every absolute internal link must point at a rendered page.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const contentDir = join(repoRoot, "content");
const generated = join(repoRoot, "src", "generated", "content.json");

// The zero-trust corpus (`quality/e2e/**`) and the benchmarks (`quality/bench/**`)
// are published evidence: the docs link to them and document their run commands.
// Other `quality/` paths stay internal references.
const FORBIDDEN =
  /§\d|\bPRD\b|Addendum\b|\bdecision \d{3,4}\b|\bdocs\/ai\b|\bquality\/(?!e2e\/|bench\/)|\bagent context\b|\bdefinition of done\b|Starlight/u;

const files: string[] = [];
function walk(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith(".md")) {
      files.push(full);
    }
  }
}
walk(contentDir);

if (!existsSync(generated)) {
  console.error("[docs] src/generated/content.json missing — run `bun run content` first");
  process.exit(1);
}
const content = JSON.parse(readFileSync(generated, "utf8")) as {
  pages: Record<string, { title: string }>;
};
const valid = new Set<string>(["/"]);
for (const slug of Object.keys(content.pages)) {
  valid.add(`/${slug}`);
}

const failures: string[] = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  source.split("\n").forEach((line, index) => {
    if (FORBIDDEN.test(line)) {
      failures.push(`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
    }
  });
  for (const match of source.matchAll(/\]\((\/[^)#\s]*)[^)]*\)/g)) {
    const raw = match[1] ?? "";
    const url = raw.replace(/\/+$/, "") || "/";
    if (!valid.has(url)) {
      failures.push(`${relative(repoRoot, file)} → ${url} (no such page)`);
    }
  }
}

if (failures.length > 0) {
  console.error("FAIL: check-content:");
  for (const failure of failures.slice(0, 20)) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`OK check-content (${files.length} files · ${valid.size} pages)`);
