#!/usr/bin/env bun
// Postbuild docs:
// 1) Pagefind mengindeks seluruh HTML statis hasil prerender;
// 2) `dist/` disusun ulang menjadi tree statis siap deploy — Cloudflare Pages
//    memakai output `dist` tanpa perubahan setelan.
import { existsSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const clientDir = join(repoRoot, "dist", "client");

if (!existsSync(join(clientDir, "index.html"))) {
  throw new Error("[docs] dist/client/index.html tidak ada — jalankan `moons build` dulu");
}

const pagefind = join(repoRoot, "node_modules", ".bin", "pagefind");
const result = Bun.spawnSync([pagefind, "--site", "dist/client"], {
  cwd: repoRoot,
  stdout: "inherit",
  stderr: "inherit",
});
if (result.exitCode !== 0) {
  throw new Error(`[docs] pagefind gagal (exit ${result.exitCode})`);
}

const staging = join(repoRoot, "dist-static");
rmSync(staging, { recursive: true, force: true });
renameSync(clientDir, staging);
rmSync(join(repoRoot, "dist"), { recursive: true, force: true });
renameSync(staging, join(repoRoot, "dist"));

console.log("OK postbuild (pagefind + dist = static tree)");
