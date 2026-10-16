#!/usr/bin/env bun
// Dokumentasi publik tidak boleh memuat rujukan internal (PRD, §, Addendum).
// Guard ini menjaga pemisahan internal vs publik setelah arsip milestone dan
// catatan keputusan tidak lagi diterbitkan di situs.
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const files: string[] = [join(repoRoot, "llms.txt"), join(repoRoot, "manifest.md")];
for (const pattern of ["site/**/*.md", "site-en/**/*.md", "ai/**/*.md", "api/**/*.md", "migration/**/*.md"]) {
  const glob = new Bun.Glob(pattern);
  for (const rel of await Array.fromAsync(glob.scan({ cwd: repoRoot }))) {
    files.push(join(repoRoot, rel));
  }
}

const FORBIDDEN = /§[0-9]|PRD|Addendum [A-E]/u;
const failures: string[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  source.split("\n").forEach((line, index) => {
    if (FORBIDDEN.test(line)) {
      failures.push(`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (failures.length > 0) {
  console.error("FAIL: dokumentasi publik memuat rujukan internal:");
  for (const failure of failures.slice(0, 20)) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log(`OK check-public (${files.length} file bebas rujukan internal)`);
