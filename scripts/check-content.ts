#!/usr/bin/env bun
// Guard dokumen publik:
// 1) rujukan internal (PRD/§/Addendum) dilarang di dokumentasi publik;
// 2) tautan cookbook (URL GitHub absolut) diverifikasi terhadap clone
//    `examples/cookbook` bila ada (CI selalu meng-clone).
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const COOKBOOK_BASE = "https://github.com/moonsjs/cookbook/blob/main/";
const cookbookDir = process.env["COOKBOOK_DIR"] ?? join(repoRoot, "..", "moons-cookbook");

const files: string[] = [
  join(repoRoot, "llms.txt"),
  join(repoRoot, "manifest.md"),
  join(repoRoot, "id", "manifest.md"),
];
for (const pattern of [
  "site/**/*.md",
  "id/**/*.md",
  "ai/**/*.md",
  "api/**/*.md",
  "migration/**/*.md",
]) {
  const glob = new Bun.Glob(pattern);
  for (const rel of await Array.fromAsync(glob.scan({ cwd: repoRoot }))) {
    files.push(join(repoRoot, rel));
  }
}

const FORBIDDEN =
  /§[0-9]|PRD\b|Addendum [A-E]|\bdocs\/(decisions|milestones|site|site-en)\b|\.\.\/decisions\/\d|\bscripts\/(m\d|ai|cookbook)\b|\bexamples\/(basic|m2-leak|m8|m9-static|demo)\b|\bpackages\/[a-z-]+\/|\bStarlight\b/u;
const LINK_PATTERN = /\[[^\]]*\]\(([^)]+)\)/g;
const failures: string[] = [];
let cookbookChecked = 0;

for (const file of files) {
  const source = readFileSync(file, "utf8");
  source.split("\n").forEach((line, index) => {
    if (FORBIDDEN.test(line)) {
      failures.push(`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
    }
  });
  for (const match of source.matchAll(LINK_PATTERN)) {
    const raw = (match[1] ?? "").trim();
    if (!raw.startsWith(COOKBOOK_BASE)) {
      continue;
    }
    const target = (raw.split("#")[0] ?? "").slice(COOKBOOK_BASE.length);
    if (target.length === 0) {
      continue;
    }
    cookbookChecked += 1;
    if (existsSync(cookbookDir) && !existsSync(join(cookbookDir, target))) {
      failures.push(`${relative(repoRoot, file)} → ${raw} (tidak ada di cookbook)`);
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

console.log(
  `OK check-content (${files.length} file · ${cookbookChecked} tautan cookbook${existsSync(cookbookDir) ? "" : " — clone cookbook tak ada, hanya dicek polanya"})`,
);
