#!/usr/bin/env bun
// W1-01 (MOONS-STRATEGY): contoh shell/CI di dokumentasi tidak boleh memakai
// perintah `moons` telanjang — `moons` hanya devDependency lokal, sehingga
// "command not found" di shell/CI biasa. Gunakan `bun run <script>` (bila ada)
// atau `bunx moons <cmd>`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const contentDir = join(repoRoot, "content");

const BARE_MOONS =
  /^[ \t]*(?:-[ \t]*)?(?:(?:PORT|MOONS_TEST_PORT|MOONS_SERVER)=[^\s]+[ \t]+)*moons[ \t]+(dev|build|start|check|test|audit|typegen|routes|fns|errors|doctor)\b/;

const SHELL_FENCE = /^(?:sh|bash|shell|console|yaml|yml)?$/;

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

const violations: string[] = [];
for (const file of walk(contentDir)) {
  const lines = readFileSync(file, "utf8").split("\n");
  let inFence = false;
  let fenceLang = "";
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fence = /^```(\S*)/.exec(line);
    if (fence !== null) {
      if (inFence) {
        inFence = false;
        fenceLang = "";
      } else {
        inFence = true;
        fenceLang = (fence[1] ?? "").toLowerCase();
      }
      continue;
    }
    if (!inFence || !SHELL_FENCE.test(fenceLang)) {
      continue;
    }
    if (BARE_MOONS.test(line)) {
      violations.push(`${relative(repoRoot, file)}:${index + 1}: ${line.trim()}`);
    }
  }
}

if (violations.length > 0) {
  console.error("[docs] lint-commands: bare `moons` command in shell/CI examples:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error("Use `bun run <script>` or `bunx moons <cmd>` instead.");
  process.exit(1);
}
console.log("[docs] lint-commands OK");
