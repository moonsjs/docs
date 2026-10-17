#!/usr/bin/env bun
// Postbuild: sitemap + llms.txt for the static export. The deploy points at
// `dist/client` (see wrangler.jsonc); `dist/server` stays intact for
// `moons start`.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const clientDir = join(repoRoot, "dist", "client");
const generated = join(repoRoot, "src", "generated", "content.json");

if (!existsSync(join(clientDir, "index.html"))) {
  throw new Error("[docs] dist/client/index.html missing — run `moons build` first");
}
if (!existsSync(generated)) {
  throw new Error("[docs] src/generated/content.json missing — run `bun run content` first");
}

const SITE = "https://docs.devmoon.net";
const content = JSON.parse(readFileSync(generated, "utf8")) as {
  pages: Record<string, { title: string; description: string }>;
};
const urls = ["/", ...Object.keys(content.pages).map((slug) => `/${slug}`)];
const rootLlms = join(repoRoot, "llms.txt");

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${SITE}${url}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
writeFileSync(join(clientDir, "sitemap.xml"), sitemap);

if (!existsSync(rootLlms)) {
  throw new Error("[docs] llms.txt missing — run `bun run content` first");
}
writeFileSync(join(clientDir, "llms.txt"), readFileSync(rootLlms, "utf8"));

console.log(`[docs] postbuild: sitemap.xml + llms.txt (${urls.length} URLs)`);
