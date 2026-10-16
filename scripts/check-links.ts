#!/usr/bin/env bun
// Anti-drift: setiap tautan relatif di paket AI (llms.txt + ai/** + site/**)
// harus menunjuk file yang benar-benar ada; tautan cookbook (URL GitHub blob)
// diverifikasi terhadap clone `examples/cookbook` (dipakai CI; lokal: git clone).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const COOKBOOK_BASE = "https://github.com/moonsjs/cookbook/blob/main/";
const cookbookDir = join(repoRoot, "examples", "cookbook");

const targets: string[] = [join(repoRoot, "llms.txt")];
for (const pattern of ["ai/**/*.md", "site/**/*.md", "site-en/**/*.md"]) {
  const glob = new Bun.Glob(pattern);
  for (const relative of await Array.fromAsync(glob.scan({ cwd: repoRoot }))) {
    targets.push(join(repoRoot, relative));
  }
}

const LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;
const failures: string[] = [];
let checked = 0;

for (const file of targets) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(LINK_PATTERN)) {
    const raw = (match[1] ?? "").trim();
    if (raw.length === 0 || raw.startsWith("#") || raw.startsWith("/") || raw.startsWith("mailto:")) {
      continue;
    }
    if (raw.startsWith(COOKBOOK_BASE)) {
      const withoutAnchor = (raw.split("#")[0] ?? "").slice(COOKBOOK_BASE.length);
      if (withoutAnchor.length === 0) {
        continue;
      }
      checked += 1;
      if (!existsSync(cookbookDir)) {
        failures.push(`${file.slice(repoRoot.length + 1)} → ${raw} (clone moonsjs/cookbook ke examples/cookbook)`);
        continue;
      }
      if (!existsSync(join(cookbookDir, withoutAnchor))) {
        failures.push(`${file.slice(repoRoot.length + 1)} → ${raw} (tidak ada di cookbook)`);
      }
      continue;
    }
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      continue;
    }
    const withoutAnchor = raw.split("#")[0] ?? "";
    const withoutQuery = withoutAnchor.split("?")[0] ?? "";
    if (withoutQuery.length === 0) {
      continue;
    }
    const target = resolve(dirname(file), withoutQuery);
    checked += 1;
    if (!existsSync(target)) {
      failures.push(`${file.slice(repoRoot.length + 1)} → ${raw}`);
    }
  }
}

if (failures.length > 0) {
  console.error("FAIL: tautan rusak di paket dokumentasi/AI:");
  for (const failure of failures.slice(0, 40)) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`OK check-links (${targets.length} file, ${checked} tautan diperiksa)`);
